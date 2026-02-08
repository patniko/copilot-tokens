import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CopilotService, loadMCPServers } from './copilot-service';
import { StatsService, SessionStats } from './stats-service';
import { PermissionService } from './permission-service';
import * as auth from './auth-service';
import * as packs from './pack-service';

function parseNumstat(stdout: string): { filesChanged: number; linesAdded: number; linesRemoved: number; files: string[] } {
  const lines = stdout.trim().split('\n').filter(Boolean);
  let linesAdded = 0;
  let linesRemoved = 0;
  const files: string[] = [];
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const added = parseInt(parts[0], 10);
      const removed = parseInt(parts[1], 10);
      if (!isNaN(added)) linesAdded += added;
      if (!isNaN(removed)) linesRemoved += removed;
      files.push(parts[2]);
    }
  }
  return { filesChanged: files.length, linesAdded, linesRemoved, files };
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const copilot = CopilotService.getInstance();
  const stats = new StatsService();

  // Set initial CWD and model from persisted store
  const savedCwd = stats.getCwd();
  if (savedCwd) {
    copilot.setWorkingDirectory(savedCwd);
  }
  const savedModel = stats.getModel();
  if (savedModel) {
    copilot.setModel(savedModel);
  }

  // Permission bridge: main → renderer → main
  const permissions = new PermissionService();
  let pendingPermission: { resolve: (decision: 'allow' | 'deny' | 'always') => void } | null = null;

  copilot.setPermissionHandler(async (request) => {
    const cwd = stats.getCwd();
    const evalResult = permissions.evaluate(request, cwd);
    if (evalResult === 'allow') return 'allow';

    // Need to ask user
    return new Promise<'allow' | 'deny' | 'always'>((resolve) => {
      pendingPermission = { resolve };
      mainWindow.webContents.send('copilot:permissionRequest', { ...request, cwd });
    });
  });

  ipcMain.handle('copilot:permissionResponse', (_event, decision: 'allow' | 'deny' | 'always') => {
    if (pendingPermission) {
      pendingPermission.resolve(decision);
      pendingPermission = null;
    }
  });

  // Called by renderer when user clicks "Always Allow" — persists the rule
  ipcMain.handle('copilot:addPermissionRule', (_event, kind: string, pathPrefix: string) => {
    permissions.addRule({ kind, pathPrefix });
  });

  ipcMain.handle('copilot:getPermissionRules', () => {
    return permissions.getRules();
  });

  ipcMain.handle('copilot:removePermissionRule', (_event, index: number) => {
    permissions.removeRule(index);
  });

  ipcMain.handle('copilot:clearPermissionRules', () => {
    permissions.clearRules();
  });

  ipcMain.handle('copilot:setYoloMode', (_event, enabled: boolean) => {
    permissions.yoloMode = enabled;
  });

  ipcMain.handle('copilot:getYoloMode', () => {
    return permissions.yoloMode;
  });

  ipcMain.handle('copilot:sendMessage', async (_event, prompt: string, attachments?: { path: string }[], panelId?: string) => {
    const pid = panelId || 'main';
    try {
      await copilot.sendMessage(prompt, (event) => {
        mainWindow.webContents.send(`copilot:event:${pid}`, event);
      }, attachments, pid);
    } catch (err) {
      console.error('[IPC] copilot:sendMessage error:', err);
      mainWindow.webContents.send(`copilot:event:${pid}`, { type: 'session.idle' });
    }
  });

  ipcMain.handle('copilot:abort', async (_event, panelId?: string) => {
    const pid = panelId || 'main';
    await copilot.abort(pid);
    mainWindow.webContents.send(`copilot:event:${pid}`, { type: 'session.idle' });
  });

  ipcMain.handle('copilot:destroySession', async (_event, panelId: string) => {
    await copilot.destroySession(panelId);
  });

  ipcMain.handle('stats:getTopSessions', (_event, limit: number) => {
    return stats.getTopSessions(limit);
  });

  ipcMain.handle('stats:getAllTimeBests', () => {
    return stats.getAllTimeBests();
  });

  ipcMain.handle('stats:getAllSessions', () => {
    return stats.getAllSessions();
  });

  ipcMain.handle('stats:recordSession', (_event, sessionStats: SessionStats) => {
    stats.recordSession(sessionStats);
  });

  ipcMain.handle('stats:getLifetimeStats', () => {
    return stats.getLifetimeStats();
  });

  ipcMain.handle('stats:getCurrentSessionRank', (_event, totalTokens: number) => {
    return stats.getCurrentSessionRank(totalTokens);
  });

  ipcMain.handle('stats:getAchievements', () => {
    return stats.getAchievements();
  });

  ipcMain.handle('stats:addAchievement', (_event, achievement: { milestoneId: string; label: string; emoji: string; unlockedAt: number }) => {
    stats.addAchievement(achievement);
  });

  ipcMain.handle('stats:clearAchievements', () => {
    stats.clearAchievements();
  });

  ipcMain.handle('stats:saveSessionEvents', (_event, sessionTimestamp: number, events: unknown[]) => {
    stats.saveSessionEvents(sessionTimestamp, events as import('./stats-service').SessionEvent[]);
  });

  ipcMain.handle('stats:getSessionEvents', () => {
    return stats.getSessionEvents();
  });

  ipcMain.handle('stats:getSessionEventLog', (_event, sessionTimestamp: number) => {
    return stats.getSessionEventLog(sessionTimestamp);
  });

  ipcMain.handle('stats:getLevelProgress', () => {
    return stats.getLevelProgress();
  });

  ipcMain.handle('stats:setLevelProgress', (_event, progress: import('./stats-service').LevelProgressData) => {
    stats.setLevelProgress(progress);
  });

  ipcMain.handle('stats:recordReactionTime', (_event, timeMs: number) => {
    return stats.recordReactionTime(timeMs);
  });

  ipcMain.handle('stats:getCommitBests', () => {
    return stats.getCommitBests();
  });

  ipcMain.handle('git:commit', async (_event, message: string, _files: string[]) => {
    const cwd = stats.getCwd();
    if (!cwd) return { success: false, hash: undefined };

    // Stage all changes, then commit
    return new Promise<{ success: boolean; hash?: string }>((resolve) => {
      execFile('git', ['-C', cwd, 'add', '-A'], (addErr) => {
        if (addErr) {
          console.error('[git:commit] add failed:', addErr);
          resolve({ success: false });
          return;
        }
        execFile('git', ['-C', cwd, 'commit', '-m', message], (commitErr, stdout) => {
          if (commitErr) {
            console.error('[git:commit] commit failed:', commitErr);
            resolve({ success: false });
            return;
          }
          // Extract short hash from output like "[main abc1234] message"
          const hashMatch = stdout.match(/\[[\w/-]+ ([a-f0-9]+)\]/);

          // Record commit stats for all-time bests
          execFile('git', ['-C', cwd, 'show', '--numstat', '--format=', 'HEAD'], (numErr, numOut) => {
            if (!numErr && numOut) {
              const { linesAdded, linesRemoved } = parseNumstat(numOut);
              stats.recordCommitBests(linesAdded, linesRemoved);
            }
            resolve({ success: true, hash: hashMatch?.[1] });
          });
        });
      });
    });
  });

  ipcMain.handle('git:diff', async () => {
    const cwd = stats.getCwd();
    if (!cwd) return '';
    return new Promise<string>((resolve) => {
      execFile('git', ['-C', cwd, 'diff', 'HEAD'], { maxBuffer: 1024 * 1024 * 5 }, (err, stdout) => {
        if (err) {
          // Try without HEAD (new repo)
          execFile('git', ['-C', cwd, 'diff'], { maxBuffer: 1024 * 1024 * 5 }, (err2, stdout2) => {
            resolve(err2 ? '' : stdout2);
          });
          return;
        }
        resolve(stdout);
      });
    });
  });

  ipcMain.handle('cwd:get', () => {
    return stats.getCwd();
  });

  ipcMain.handle('cwd:set', (_event, dir: string) => {
    stats.setCwd(dir);
    copilot.setWorkingDirectory(dir);
  });

  ipcMain.handle('cwd:getRecent', () => {
    return stats.getRecentCwds();
  });

  ipcMain.handle('cwd:browse', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Working Directory',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const dir = result.filePaths[0];
      stats.setCwd(dir);
      copilot.setWorkingDirectory(dir);
      return dir;
    }
    return null;
  });

  ipcMain.handle('cwd:gitInfo', async (_event, dir: string) => {
    if (!dir) return { isRepo: false };
    return new Promise<{ isRepo: boolean; branch?: string }>((resolve) => {
      execFile('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], (err, stdout) => {
        if (err) {
          resolve({ isRepo: false });
        } else {
          resolve({ isRepo: true, branch: stdout.trim() });
        }
      });
    });
  });

  ipcMain.handle('cwd:gitStats', async (_event, dir: string) => {
    if (!dir) return { filesChanged: 0, linesAdded: 0, linesRemoved: 0, files: [] as string[] };
    return new Promise<{ filesChanged: number; linesAdded: number; linesRemoved: number; files: string[] }>((resolve) => {
      // Include both staged and unstaged changes
      execFile('git', ['-C', dir, 'diff', '--numstat', 'HEAD'], (err, stdout) => {
        if (err) {
          // Try without HEAD (new repo, no commits yet)
          execFile('git', ['-C', dir, 'diff', '--numstat'], (err2, stdout2) => {
            if (err2) {
              resolve({ filesChanged: 0, linesAdded: 0, linesRemoved: 0, files: [] });
              return;
            }
            resolve(parseNumstat(stdout2));
          });
          return;
        }
        resolve(parseNumstat(stdout));
      });
    });
  });

  let tempCounter = 0;
  ipcMain.handle('util:saveTempImage', async (_event, buffer: Buffer, ext: string) => {
    const tmpDir = app.getPath('temp');
    const filename = `github-tokens-paste-${Date.now()}-${tempCounter++}.${ext || 'png'}`;
    const filePath = join(tmpDir, filename);
    await writeFile(filePath, buffer);
    return filePath;
  });

  ipcMain.handle('util:openInVSCode', (_event, dir: string) => {
    if (dir) execFile('code', [dir], { env: process.env });
  });

  ipcMain.handle('util:openCopilotShell', (_event, dir: string) => {
    if (!dir) return;
    const script = `tell application "Terminal" to do script "cd ${dir.replace(/"/g, '\\"')} && copilot"`;
    execFile('osascript', ['-e', script]);
  });

  ipcMain.handle('mcp:list', () => {
    const servers = loadMCPServers();
    return Object.entries(servers).map(([name, cfg]) => ({
      name,
      type: ('type' in cfg && cfg.type) ? cfg.type : 'stdio',
      command: ('command' in cfg ? cfg.command : ('url' in cfg ? cfg.url : '')),
    }));
  });

  ipcMain.handle('model:get', () => {
    return stats.getModel();
  });

  ipcMain.handle('model:set', (_event, model: string) => {
    stats.setModel(model);
    copilot.setModel(model);
  });

  ipcMain.handle('model:list', async () => {
    return copilot.listModels();
  });

  ipcMain.handle('model:refresh', async () => {
    return copilot.refreshModels();
  });

  // ── Auth ──

  ipcMain.handle('auth:getCliUser', async () => {
    return auth.getCliUser();
  });

  ipcMain.handle('auth:getOAuthUser', () => {
    return auth.getPersistedOAuthUser();
  });

  let activeDeviceCode: { deviceCode: string; interval: number } | null = null;

  ipcMain.handle('auth:startOAuth', async () => {
    const resp = await auth.startDeviceFlow();
    activeDeviceCode = { deviceCode: resp.device_code, interval: resp.interval };
    // Open the verification URL in the default browser
    shell.openExternal(resp.verification_uri);
    return { userCode: resp.user_code, verificationUri: resp.verification_uri };
  });

  ipcMain.handle('auth:pollOAuth', async () => {
    if (!activeDeviceCode) throw new Error('No active device flow');
    const token = await auth.pollForToken(activeDeviceCode.deviceCode, activeDeviceCode.interval);
    activeDeviceCode = null;
    const user = await auth.fetchUser(token);
    auth.persistOAuth(token, user);
    auth.setActiveSource('oauth');
    return user;
  });

  ipcMain.handle('auth:setActiveSource', (_event, source: 'cli' | 'oauth') => {
    auth.setActiveSource(source);
  });

  ipcMain.handle('auth:getActiveSource', () => {
    return auth.getActiveSource();
  });

  ipcMain.handle('auth:logoutOAuth', () => {
    auth.clearOAuth();
  });

  // ── Packs ──

  ipcMain.handle('packs:milestone:list', () => packs.getMilestonePacks());
  ipcMain.handle('packs:milestone:save', (_e, pack) => packs.saveMilestonePack(pack));
  ipcMain.handle('packs:milestone:delete', (_e, id: string) => packs.deleteMilestonePack(id));
  ipcMain.handle('packs:milestone:setActive', (_e, id: string, active: boolean) => packs.setMilestonePackActive(id, active));

  ipcMain.handle('packs:sound:list', () => packs.getSoundPacks());
  ipcMain.handle('packs:sound:save', (_e, pack) => packs.saveSoundPack(pack));
  ipcMain.handle('packs:sound:delete', (_e, id: string) => packs.deleteSoundPack(id));
  ipcMain.handle('packs:sound:setActive', (_e, id: string) => packs.setSoundPackActive(id));

  ipcMain.handle('packs:theme:list', () => packs.getThemePacks());
  ipcMain.handle('packs:theme:save', (_e, pack) => packs.saveThemePack(pack));
  ipcMain.handle('packs:theme:delete', (_e, id: string) => packs.deleteThemePack(id));
}
