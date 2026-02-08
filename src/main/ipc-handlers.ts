import { ipcMain, BrowserWindow } from 'electron';
import { CopilotService } from './copilot-service';
import { StatsService, SessionStats } from './stats-service';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const copilot = CopilotService.getInstance();
  const stats = new StatsService();

  ipcMain.handle('copilot:sendMessage', async (_event, prompt: string) => {
    try {
      await copilot.sendMessage(prompt, (event) => {
        mainWindow.webContents.send('copilot:event', event);
      });
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
}
