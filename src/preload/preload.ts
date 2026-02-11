import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('copilotAPI', {
  sendMessage(prompt: string, attachments?: { path: string }[], panelId?: string): void {
    ipcRenderer.invoke('copilot:sendMessage', prompt, attachments, panelId);
  },
  abort(panelId?: string): void {
    ipcRenderer.invoke('copilot:abort', panelId);
  },
  destroySession(panelId: string): void {
    ipcRenderer.invoke('copilot:destroySession', panelId);
  },
  onEvent(callback: (event: unknown) => void, panelId?: string): () => void {
    const channel = `copilot:event:${panelId || 'main'}`;
    const listener = (_ipcEvent: Electron.IpcRendererEvent, event: unknown) => {
      callback(event);
    };
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
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
  onAskUserRequest(callback: (request: { question: string; choices?: string[]; allowFreeform?: boolean }) => void): () => void {
    const listener = (_ipcEvent: Electron.IpcRendererEvent, request: { question: string; choices?: string[]; allowFreeform?: boolean }) => {
      callback(request);
    };
    ipcRenderer.on('copilot:askUserRequest', listener);
    return () => {
      ipcRenderer.removeListener('copilot:askUserRequest', listener);
    };
  },
  respondAskUser(answer: string, wasFreeform: boolean): void {
    ipcRenderer.invoke('copilot:askUserResponse', answer, wasFreeform);
  },
});

contextBridge.exposeInMainWorld('statsAPI', {
  getAllSessions(): Promise<{ timestamp: number; cwd?: string; inputTokens: number; outputTokens: number; messagesCount: number; filesChanged: number; toolCalls: number; durationMs: number }[]> {
    return ipcRenderer.invoke('stats:getAllSessions');
  },
  getTopSessions(limit: number): Promise<unknown[]> {
    return ipcRenderer.invoke('stats:getTopSessions', limit);
  },
  getAllTimeBests(): Promise<Record<string, number>> {
    return ipcRenderer.invoke('stats:getAllTimeBests');
  },
  recordSession(stats: unknown, timestamp?: number): Promise<void> {
    return ipcRenderer.invoke('stats:recordSession', stats, timestamp);
  },
  getLifetimeStats(): Promise<{ lifetimeTokens: number; totalSessions: number; longestStreak: number; currentStreak: number; fastestResponse: number }> {
    return ipcRenderer.invoke('stats:getLifetimeStats');
  },
  getCurrentSessionRank(totalTokens: number): Promise<number> {
    return ipcRenderer.invoke('stats:getCurrentSessionRank', totalTokens);
  },
  getAchievements(): Promise<{ milestoneId: string; label: string; emoji: string; unlockedAt: number }[]> {
    return ipcRenderer.invoke('stats:getAchievements');
  },
  addAchievement(achievement: { milestoneId: string; label: string; emoji: string; unlockedAt: number }): Promise<void> {
    return ipcRenderer.invoke('stats:addAchievement', achievement);
  },
  clearAchievements(): Promise<void> {
    return ipcRenderer.invoke('stats:clearAchievements');
  },
  saveSessionEvents(sessionTimestamp: number, events: { type: string; timestamp: number; data?: Record<string, unknown> }[]): Promise<void> {
    return ipcRenderer.invoke('stats:saveSessionEvents', sessionTimestamp, events);
  },
  getSessionEvents(): Promise<{ sessionTimestamp: number; events: { type: string; timestamp: number; data?: Record<string, unknown> }[] }[]> {
    return ipcRenderer.invoke('stats:getSessionEvents');
  },
  getSessionEventLog(sessionTimestamp: number): Promise<{ sessionTimestamp: number; events: { type: string; timestamp: number; data?: Record<string, unknown> }[] } | undefined> {
    return ipcRenderer.invoke('stats:getSessionEventLog', sessionTimestamp);
  },
  saveConversationLog(sessionTimestamp: number, events: Record<string, unknown>[]): Promise<void> {
    return ipcRenderer.invoke('stats:saveConversationLog', sessionTimestamp, events);
  },
  getConversationLog(sessionTimestamp: number): Promise<{ sessionTimestamp: number; events: Record<string, unknown>[] } | undefined> {
    return ipcRenderer.invoke('stats:getConversationLog', sessionTimestamp);
  },
  getCommitBests(): Promise<{ linesAdded: number; linesRemoved: number }> {
    return ipcRenderer.invoke('stats:getCommitBests');
  },
  getLevelProgress(): Promise<{ level: number; categoryProgress: { tokens: number; messages: number; toolCalls: number; files: number; lines: number } }> {
    return ipcRenderer.invoke('stats:getLevelProgress');
  },
  setLevelProgress(progress: { level: number; categoryProgress: { tokens: number; messages: number; toolCalls: number; files: number; lines: number } }): Promise<void> {
    return ipcRenderer.invoke('stats:setLevelProgress', progress);
  },
  recordReactionTime(timeMs: number): Promise<{ isNewBest: boolean; timeMs: number; previousBest: number }> {
    return ipcRenderer.invoke('stats:recordReactionTime', timeMs);
  },
});

contextBridge.exposeInMainWorld('gitAPI', {
  commit(message: string, files: string[]): Promise<{ success: boolean; hash?: string }> {
    return ipcRenderer.invoke('git:commit', message, files);
  },
  diff(): Promise<string> {
    return ipcRenderer.invoke('git:diff');
  },
  checkout(file: string): Promise<{ success: boolean }> {
    return ipcRenderer.invoke('git:checkout', file);
  },
  checkoutAll(): Promise<{ success: boolean }> {
    return ipcRenderer.invoke('git:checkoutAll');
  },
});

contextBridge.exposeInMainWorld('utilAPI', {
  saveTempImage(buffer: ArrayBuffer, ext: string): Promise<string> {
    return ipcRenderer.invoke('util:saveTempImage', Buffer.from(buffer), ext);
  },
  openInVSCode(dir: string): void {
    ipcRenderer.invoke('util:openInVSCode', dir);
  },
  openFolder(dir: string): void {
    ipcRenderer.invoke('util:openFolder', dir);
  },
  openCopilotShell(dir: string): void {
    ipcRenderer.invoke('util:openCopilotShell', dir);
  },
});

contextBridge.exposeInMainWorld('mcpAPI', {
  list(): Promise<{ name: string; type: string; command: string }[]> {
    return ipcRenderer.invoke('mcp:list');
  },
});

contextBridge.exposeInMainWorld('featuresAPI', {
  get(): Promise<{ customTools: boolean; askUser: boolean; reasoning: boolean; infiniteSessions: boolean; hooks: boolean; customAgents: boolean; sessionEvents: boolean }> {
    return ipcRenderer.invoke('features:get');
  },
  set(features: { customTools: boolean; askUser: boolean; reasoning: boolean; infiniteSessions: boolean; hooks: boolean; customAgents: boolean; sessionEvents: boolean }): Promise<void> {
    return ipcRenderer.invoke('features:set', features);
  },
  getReasoningEffort(): Promise<string | null> {
    return ipcRenderer.invoke('features:getReasoningEffort');
  },
  setReasoningEffort(effort: string | null): Promise<void> {
    return ipcRenderer.invoke('features:setReasoningEffort', effort);
  },
});

contextBridge.exposeInMainWorld('sessionsAPI', {
  list(): Promise<{ sessionId: string; startTime: string; modifiedTime: string; summary?: string }[]> {
    return ipcRenderer.invoke('sessions:list');
  },
  resume(sessionId: string, panelId?: string): Promise<void> {
    return ipcRenderer.invoke('sessions:resume', sessionId, panelId);
  },
});

contextBridge.exposeInMainWorld('agentsAPI', {
  get(): Promise<{ name: string; displayName?: string; description?: string; tools?: string[] | null; prompt: string }[]> {
    return ipcRenderer.invoke('agents:get');
  },
  set(agents: { name: string; displayName?: string; description?: string; tools?: string[] | null; prompt: string }[]): Promise<void> {
    return ipcRenderer.invoke('agents:set', agents);
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
  refresh(): Promise<{ id: string; name: string; contextWindow: number }[]> {
    return ipcRenderer.invoke('model:refresh');
  },
});

contextBridge.exposeInMainWorld('settingsAPI', {
  getSystemPrompt(): Promise<{ mode: 'append' | 'replace'; content: string }> {
    return ipcRenderer.invoke('settings:getSystemPrompt');
  },
  setSystemPrompt(config: { mode: 'append' | 'replace'; content: string }): Promise<void> {
    return ipcRenderer.invoke('settings:setSystemPrompt', config);
  },
  getCliMode(): Promise<{ type: 'bundled' } | { type: 'installed' } | { type: 'remote'; url: string }> {
    return ipcRenderer.invoke('settings:getCliMode');
  },
  setCliMode(mode: { type: 'bundled' } | { type: 'installed' } | { type: 'remote'; url: string }): Promise<void> {
    return ipcRenderer.invoke('settings:setCliMode', mode);
  },
});

contextBridge.exposeInMainWorld('authAPI', {
  getCliUser(): Promise<unknown> {
    return ipcRenderer.invoke('auth:getCliUser');
  },
  getOAuthUser(): Promise<unknown> {
    return ipcRenderer.invoke('auth:getOAuthUser');
  },
  startOAuth(): Promise<{ userCode: string; verificationUri: string }> {
    return ipcRenderer.invoke('auth:startOAuth');
  },
  pollOAuth(): Promise<unknown> {
    return ipcRenderer.invoke('auth:pollOAuth');
  },
  setActiveSource(source: string): Promise<void> {
    return ipcRenderer.invoke('auth:setActiveSource', source);
  },
  getActiveSource(): Promise<string> {
    return ipcRenderer.invoke('auth:getActiveSource');
  },
  logoutOAuth(): Promise<void> {
    return ipcRenderer.invoke('auth:logoutOAuth');
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

contextBridge.exposeInMainWorld('packAPI', {
  // Milestone packs
  listMilestonePacks(): Promise<unknown[]> {
    return ipcRenderer.invoke('packs:milestone:list');
  },
  saveMilestonePack(pack: unknown): Promise<void> {
    return ipcRenderer.invoke('packs:milestone:save', pack);
  },
  deleteMilestonePack(id: string): Promise<void> {
    return ipcRenderer.invoke('packs:milestone:delete', id);
  },
  setMilestonePackActive(id: string, active: boolean): Promise<void> {
    return ipcRenderer.invoke('packs:milestone:setActive', id, active);
  },
  // Sound packs
  listSoundPacks(): Promise<unknown[]> {
    return ipcRenderer.invoke('packs:sound:list');
  },
  saveSoundPack(pack: unknown): Promise<void> {
    return ipcRenderer.invoke('packs:sound:save', pack);
  },
  deleteSoundPack(id: string): Promise<void> {
    return ipcRenderer.invoke('packs:sound:delete', id);
  },
  setSoundPackActive(id: string): Promise<void> {
    return ipcRenderer.invoke('packs:sound:setActive', id);
  },
  // Theme packs
  listThemePacks(): Promise<unknown[]> {
    return ipcRenderer.invoke('packs:theme:list');
  },
  saveThemePack(pack: unknown): Promise<void> {
    return ipcRenderer.invoke('packs:theme:save', pack);
  },
  deleteThemePack(id: string): Promise<void> {
    return ipcRenderer.invoke('packs:theme:delete', id);
  },
});
