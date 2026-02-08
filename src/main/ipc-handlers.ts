import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CopilotService } from './copilot-service';
import { StatsService, SessionStats } from './stats-service';

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

  ipcMain.handle('copilot:sendMessage', async (_event, prompt: string, attachments?: { path: string }[]) => {
    try {
      await copilot.sendMessage(prompt, (event) => {
        mainWindow.webContents.send('copilot:event', event);
      }, attachments);
    } catch (err) {
      console.error('[IPC] copilot:sendMessage error:', err);
      mainWindow.webContents.send('copilot:event', { type: 'session.idle' });
    }
  });

  ipcMain.handle('copilot:abort', async () => {
    await copilot.abort();
  });

  ipcMain.handle('stats:getTopSessions', (_event, limit: number) => {
    return stats.getTopSessions(limit);
  });

  ipcMain.handle('stats:getAllTimeBests', () => {
    return stats.getAllTimeBests();
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

  ipcMain.handle('git:commit', async (_event, message: string, _files: string[]) => {
    // TODO: Implement git commit via child_process
    console.log(`[IPC] git:commit: ${message}`);
    return { success: false, hash: undefined };
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
}
