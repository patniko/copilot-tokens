import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('copilotAPI', {
  sendMessage(prompt: string, attachments?: { path: string }[]): void {
    ipcRenderer.invoke('copilot:sendMessage', prompt, attachments);
  },
  abort(): void {
    ipcRenderer.invoke('copilot:abort');
  },
  onEvent(callback: (event: unknown) => void): () => void {
    const listener = (_ipcEvent: Electron.IpcRendererEvent, event: unknown) => {
      callback(event);
    };
    ipcRenderer.on('copilot:event', listener);
    return () => {
      ipcRenderer.removeListener('copilot:event', listener);
    };
  },
  onPermissionRequest(callback: (request: unknown) => void): () => void {
    const listener = (_ipcEvent: Electron.IpcRendererEvent, request: unknown) => {
      callback(request);
    };
    ipcRenderer.on('copilot:permissionRequest', listener);
    return () => {
      ipcRenderer.removeListener('copilot:permissionRequest', listener);
    };
  },
  respondPermission(decision: string, rulePathPrefix?: string): void {
    ipcRenderer.invoke('copilot:permissionResponse', decision, rulePathPrefix);
  },
  addPermissionRule(kind: string, pathPrefix: string): Promise<void> {
    return ipcRenderer.invoke('copilot:addPermissionRule', kind, pathPrefix);
  },
  getPermissionRules(): Promise<{ kind: string; pathPrefix: string }[]> {
    return ipcRenderer.invoke('copilot:getPermissionRules');
  },
  removePermissionRule(index: number): Promise<void> {
    return ipcRenderer.invoke('copilot:removePermissionRule', index);
  },
  clearPermissionRules(): Promise<void> {
    return ipcRenderer.invoke('copilot:clearPermissionRules');
  },
  setYoloMode(enabled: boolean): Promise<void> {
    return ipcRenderer.invoke('copilot:setYoloMode', enabled);
  },
  getYoloMode(): Promise<boolean> {
    return ipcRenderer.invoke('copilot:getYoloMode');
  },
});

contextBridge.exposeInMainWorld('statsAPI', {
  getTopSessions(limit: number): Promise<unknown[]> {
    return ipcRenderer.invoke('stats:getTopSessions', limit);
  },
  getAllTimeBests(): Promise<Record<string, number>> {
    return ipcRenderer.invoke('stats:getAllTimeBests');
  },
  recordSession(stats: unknown): Promise<void> {
    return ipcRenderer.invoke('stats:recordSession', stats);
  },
  getLifetimeStats(): Promise<{ lifetimeTokens: number; totalSessions: number; longestStreak: number; currentStreak: number; fastestResponse: number }> {
    return ipcRenderer.invoke('stats:getLifetimeStats');
  },
  getCurrentSessionRank(totalTokens: number): Promise<number> {
    return ipcRenderer.invoke('stats:getCurrentSessionRank', totalTokens);
  },
});

contextBridge.exposeInMainWorld('gitAPI', {
  commit(message: string, files: string[]): Promise<{ success: boolean; hash?: string }> {
    return ipcRenderer.invoke('git:commit', message, files);
  },
});

contextBridge.exposeInMainWorld('utilAPI', {
  saveTempImage(buffer: ArrayBuffer, ext: string): Promise<string> {
    return ipcRenderer.invoke('util:saveTempImage', Buffer.from(buffer), ext);
  },
  openInVSCode(dir: string): void {
    ipcRenderer.invoke('util:openInVSCode', dir);
  },
  openCopilotShell(dir: string): void {
    ipcRenderer.invoke('util:openCopilotShell', dir);
  },
});

contextBridge.exposeInMainWorld('modelAPI', {
  get(): Promise<string> {
    return ipcRenderer.invoke('model:get');
  },
  set(model: string): Promise<void> {
    return ipcRenderer.invoke('model:set', model);
  },
  list(): Promise<{ id: string; name: string; contextWindow: number }[]> {
    return ipcRenderer.invoke('model:list');
  },
});

contextBridge.exposeInMainWorld('cwdAPI', {
  get(): Promise<string> {
    return ipcRenderer.invoke('cwd:get');
  },
  set(dir: string): Promise<void> {
    return ipcRenderer.invoke('cwd:set', dir);
  },
  getRecent(): Promise<string[]> {
    return ipcRenderer.invoke('cwd:getRecent');
  },
  browse(): Promise<string | null> {
    return ipcRenderer.invoke('cwd:browse');
  },
  gitInfo(dir: string): Promise<{ isRepo: boolean; branch?: string }> {
    return ipcRenderer.invoke('cwd:gitInfo', dir);
  },
  gitStats(dir: string): Promise<{ filesChanged: number; linesAdded: number; linesRemoved: number; files: string[] }> {
    return ipcRenderer.invoke('cwd:gitStats', dir);
  },
});
