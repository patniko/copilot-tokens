import { ipcMain, BrowserWindow, dialog } from 'electron';
import { execFile } from 'node:child_process';
import { CopilotService } from './copilot-service';
import { StatsService, SessionStats } from './stats-service';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const copilot = CopilotService.getInstance();
  const stats = new StatsService();

  // Set initial CWD from persisted store
  const savedCwd = stats.getCwd();
  if (savedCwd) {
    copilot.setWorkingDirectory(savedCwd);
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
}
