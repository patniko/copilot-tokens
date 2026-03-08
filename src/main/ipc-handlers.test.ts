import { describe, it, expect, vi, beforeAll, beforeEach, type Mock } from 'vitest';

// ── Capture registered IPC handlers ──

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const mockIpcMain = {
  handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  }),
};

// ── Mock: electron ──

const mockWebContents = { send: vi.fn() };
const mockMainWindow = { webContents: mockWebContents } as unknown as import('electron').BrowserWindow;

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: vi.fn(),
  dialog: { showOpenDialog: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp'), getAppPath: vi.fn(() => '/app') },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
}));

// ── Mock: copilot-service ──

const mockCopilot = {
  sendMessage: vi.fn(),
  abort: vi.fn(),
  destroySession: vi.fn(),
  setWorkingDirectory: vi.fn(),
  setWorkingDirectoryForPanels: vi.fn(),
  setModel: vi.fn(),
  listModels: vi.fn().mockResolvedValue([{ id: 'm1' }]),
  refreshModels: vi.fn().mockResolvedValue([]),
  setPermissionHandler: vi.fn(),
  setUserInputHandler: vi.fn(),
  setDelegateHandler: vi.fn(),
  setCelebrateHandler: vi.fn(),
  getFeatures: vi.fn().mockReturnValue({ streaming: true }),
  setFeatures: vi.fn(),
  getReasoningEffort: vi.fn().mockReturnValue(null),
  setReasoningEffort: vi.fn(),
  setExcludedTools: vi.fn(),
  getExcludedTools: vi.fn().mockReturnValue([]),
  getCustomToolNames: vi.fn().mockResolvedValue(['tool-a', 'tool-b']),
  listSessions: vi.fn().mockResolvedValue([{ id: 's1' }]),
  resumeSession: vi.fn().mockResolvedValue({ sessionId: 's1' }),
  getCustomAgents: vi.fn().mockReturnValue([]),
  setCustomAgents: vi.fn(),
  getCompactionThresholds: vi.fn().mockReturnValue({ background: 0.80, bufferExhaustion: 0.95 }),
  setCompactionThresholds: vi.fn(),
  getSkillDirectories: vi.fn().mockReturnValue([]),
  setSkillDirectories: vi.fn(),
  getDisabledSkills: vi.fn().mockReturnValue([]),
  setDisabledSkills: vi.fn(),
  getSystemPrompt: vi.fn().mockReturnValue(null),
  setSystemPrompt: vi.fn(),
  getCliMode: vi.fn().mockReturnValue(null),
  setCliMode: vi.fn(),
  restartClient: vi.fn().mockResolvedValue(undefined),
  applyProfile: vi.fn().mockResolvedValue(undefined),
  setPanelProfile: vi.fn(),
  getPanelProfile: vi.fn().mockReturnValue(null),
};

vi.mock('./copilot-service', () => ({
  CopilotService: { getInstance: vi.fn(() => mockCopilot) },
  loadMCPServers: vi.fn(() => ({
    server1: { command: 'node', args: ['srv.js'] },
  })),
}));

// ── Mock: stats-service ──

const mockStats = {
  getTopSessions: vi.fn().mockReturnValue([{ ts: 1, tokens: 100 }]),
  getAllTimeBests: vi.fn().mockReturnValue({ maxTokens: 500 }),
  getAllSessions: vi.fn().mockReturnValue([]),
  recordSession: vi.fn(),
  getLifetimeStats: vi.fn().mockReturnValue({ totalTokens: 9999 }),
  getCurrentSessionRank: vi.fn().mockReturnValue(3),
  getAchievements: vi.fn().mockReturnValue([{ milestoneId: 'a1' }]),
  addAchievement: vi.fn(),
  clearAchievements: vi.fn(),
  saveSessionEvents: vi.fn(),
  getSessionEvents: vi.fn().mockReturnValue([]),
  getSessionEventLog: vi.fn().mockReturnValue([]),
  saveConversationLog: vi.fn(),
  getConversationLog: vi.fn().mockReturnValue([]),
  getLevelProgress: vi.fn().mockReturnValue({ level: 5 }),
  setLevelProgress: vi.fn(),
  recordReactionTime: vi.fn(),
  getCommitBests: vi.fn().mockReturnValue({}),
  recordCommitBests: vi.fn(),
  getCwd: vi.fn().mockReturnValue('/projects/test'),
  setCwd: vi.fn(),
  getRecentCwds: vi.fn().mockReturnValue(['/projects/test']),
  getModel: vi.fn().mockReturnValue('gpt-4'),
  setModel: vi.fn(),
};

vi.mock('./stats-service', () => {
  const MockStatsService = vi.fn(function () { return mockStats; });
  return {
    StatsService: MockStatsService,
    SessionStats: {},
  };
});

// ── Mock: permission-service ──

const mockPermissions = {
  evaluate: vi.fn().mockReturnValue('allow'),
  addRule: vi.fn(),
  getRules: vi.fn().mockReturnValue([{ kind: 'read', pathPrefix: '/src' }]),
  removeRule: vi.fn(),
  clearRules: vi.fn(),
  yoloMode: false,
};

vi.mock('./permission-service', () => {
  const MockPermissionService = vi.fn(function () { return mockPermissions; });
  return { PermissionService: MockPermissionService };
});

// ── Mock: scheduler-service ──

const mockScheduler = {
  start: vi.fn(),
  listTasks: vi.fn().mockReturnValue([{ id: 't1', name: 'Daily backup' }]),
  addTask: vi.fn().mockReturnValue({ id: 't2' }),
  updateTask: vi.fn().mockReturnValue(true),
  deleteTask: vi.fn().mockReturnValue(true),
  setTaskEnabled: vi.fn().mockReturnValue(true),
  getRunHistory: vi.fn().mockReturnValue([]),
  getNextFireTime: vi.fn().mockReturnValue(new Date('2025-01-01')),
  runNow: vi.fn().mockResolvedValue(undefined),
};

vi.mock('./scheduler-service', () => {
  const MockSchedulerService = vi.fn(function () { return mockScheduler; });
  return { SchedulerService: MockSchedulerService };
});

// ── Mock: auth-service ──

vi.mock('./auth-service', () => ({
  getCliUser: vi.fn().mockResolvedValue({ login: 'octocat' }),
  getPersistedOAuthUser: vi.fn().mockReturnValue(null),
  startDeviceFlow: vi.fn().mockResolvedValue({
    device_code: 'dc1',
    user_code: 'UC-1234',
    verification_uri: 'https://github.com/login/device',
    interval: 5,
  }),
  pollForToken: vi.fn().mockResolvedValue('tok_abc'),
  fetchUser: vi.fn().mockResolvedValue({ login: 'octocat' }),
  persistOAuth: vi.fn(),
  clearOAuth: vi.fn(),
  getActiveSource: vi.fn().mockReturnValue('cli'),
  setActiveSource: vi.fn(),
}));

// ── Mock: pack-service ──

vi.mock('./pack-service', () => ({
  getMilestonePacks: vi.fn().mockReturnValue([{ id: 'mp1' }]),
  saveMilestonePack: vi.fn(),
  deleteMilestonePack: vi.fn(),
  setMilestonePackActive: vi.fn(),
  getSoundPacks: vi.fn().mockReturnValue([]),
  saveSoundPack: vi.fn(),
  deleteSoundPack: vi.fn(),
  setSoundPackActive: vi.fn(),
  getThemePacks: vi.fn().mockReturnValue([]),
  saveThemePack: vi.fn(),
  deleteThemePack: vi.fn(),
}));

// ── Mock: profile-service ──

vi.mock('./profile-service', () => ({
  listProfiles: vi.fn().mockReturnValue([{ id: 'p1', name: 'Default' }]),
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  createProfile: vi.fn().mockReturnValue({ id: 'p-new' }),
  deleteProfile: vi.fn(),
  getActiveProfileId: vi.fn().mockReturnValue('p1'),
  setActiveProfileId: vi.fn(),
  getActiveProfile: vi.fn().mockReturnValue({ id: 'p1', name: 'Default' }),
  fetchProviderModels: vi.fn().mockResolvedValue([]),
}));

// ── Mock: node:child_process ──

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// ── Mock: node:fs/promises ──

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// ── Patch ipcMain.handle to our capture map before importing ──

import { ipcMain, shell, dialog, app } from 'electron';
import * as auth from './auth-service';
import * as packs from './pack-service';
import * as profiles from './profile-service';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

beforeAll(async () => {
  // Redirect ipcMain.handle to our capture map
  (ipcMain.handle as Mock).mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  });

  // Import and register
  const { registerIpcHandlers } = await import('./ipc-handlers');
  registerIpcHandlers(mockMainWindow);
});

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper: invoke a captured handler with given args (first arg is always the IPC event)
function invoke(channel: string, ...args: unknown[]) {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for channel "${channel}"`);
  return handler({}, ...args);
}

// ────────────────────────────────────────────
// Stats channels
// ────────────────────────────────────────────

describe('stats channels', () => {
  it('stats:getTopSessions — returns top sessions by limit', () => {
    const result = invoke('stats:getTopSessions', 5);
    expect(mockStats.getTopSessions).toHaveBeenCalledWith(5);
    expect(result).toEqual([{ ts: 1, tokens: 100 }]);
  });

  it('stats:recordSession — records a session with optional timestamp', () => {
    const sessionData = { totalTokens: 100 };
    invoke('stats:recordSession', sessionData, 12345);
    expect(mockStats.recordSession).toHaveBeenCalledWith(sessionData, 12345);
  });

  it('stats:getLifetimeStats — returns lifetime stats', () => {
    const result = invoke('stats:getLifetimeStats');
    expect(mockStats.getLifetimeStats).toHaveBeenCalled();
    expect(result).toEqual({ totalTokens: 9999 });
  });

  it('stats:getAchievements — returns achievements list', () => {
    const result = invoke('stats:getAchievements');
    expect(mockStats.getAchievements).toHaveBeenCalled();
    expect(result).toEqual([{ milestoneId: 'a1' }]);
  });

  it('stats:addAchievement — defaults count to 1 when not provided', () => {
    const achievement = { milestoneId: 'm1', label: 'First!', emoji: '🎉', unlockedAt: Date.now() };
    invoke('stats:addAchievement', achievement);
    expect(mockStats.addAchievement).toHaveBeenCalledWith({ ...achievement, count: 1 });
  });

  it('stats:addAchievement — preserves explicit count', () => {
    const achievement = { milestoneId: 'm1', label: 'First!', emoji: '🎉', unlockedAt: Date.now(), count: 3 };
    invoke('stats:addAchievement', achievement);
    expect(mockStats.addAchievement).toHaveBeenCalledWith({ ...achievement, count: 3 });
  });

  it('stats:getLevelProgress — returns level progress', () => {
    const result = invoke('stats:getLevelProgress');
    expect(mockStats.getLevelProgress).toHaveBeenCalled();
    expect(result).toEqual({ level: 5 });
  });

  it('stats:getAllTimeBests — returns all-time bests', () => {
    const result = invoke('stats:getAllTimeBests');
    expect(mockStats.getAllTimeBests).toHaveBeenCalled();
    expect(result).toEqual({ maxTokens: 500 });
  });

  it('stats:getCurrentSessionRank — passes totalTokens', () => {
    const result = invoke('stats:getCurrentSessionRank', 250);
    expect(mockStats.getCurrentSessionRank).toHaveBeenCalledWith(250);
    expect(result).toBe(3);
  });
});

// ────────────────────────────────────────────
// Permission channels
// ────────────────────────────────────────────

describe('permission channels', () => {
  it('copilot:addPermissionRule — adds a rule with kind and pathPrefix', () => {
    invoke('copilot:addPermissionRule', 'write', '/src');
    expect(mockPermissions.addRule).toHaveBeenCalledWith({ kind: 'write', pathPrefix: '/src' });
  });

  it('copilot:getPermissionRules — returns rules array', () => {
    const result = invoke('copilot:getPermissionRules');
    expect(mockPermissions.getRules).toHaveBeenCalled();
    expect(result).toEqual([{ kind: 'read', pathPrefix: '/src' }]);
  });

  it('copilot:setYoloMode — sets yoloMode on permission service', async () => {
    await invoke('copilot:setYoloMode', true);
    expect(mockPermissions.yoloMode).toBe(true);
  });

  it('copilot:getYoloMode — returns current yoloMode value', () => {
    mockPermissions.yoloMode = false;
    const result = invoke('copilot:getYoloMode');
    expect(result).toBe(false);
  });

  it('copilot:removePermissionRule — removes rule by index', () => {
    invoke('copilot:removePermissionRule', 2);
    expect(mockPermissions.removeRule).toHaveBeenCalledWith(2);
  });

  it('copilot:clearPermissionRules — clears all rules', () => {
    invoke('copilot:clearPermissionRules');
    expect(mockPermissions.clearRules).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────
// Copilot channels
// ────────────────────────────────────────────

describe('copilot channels', () => {
  it('copilot:sendMessage — calls sendMessage with default panelId "main"', async () => {
    mockCopilot.sendMessage.mockResolvedValue(undefined);
    await invoke('copilot:sendMessage', 'Hello', undefined, undefined);
    expect(mockCopilot.sendMessage).toHaveBeenCalledWith(
      'Hello',
      expect.any(Function),
      undefined,
      'main',
      false,
      undefined,
    );
  });

  it('copilot:sendMessage — forwards events to correct panel channel', async () => {
    mockCopilot.sendMessage.mockImplementation(
      async (_prompt: string, callback: (evt: unknown) => void) => {
        callback({ type: 'content', text: 'hi' });
      },
    );
    await invoke('copilot:sendMessage', 'Hi', undefined, 'split');
    expect(mockWebContents.send).toHaveBeenCalledWith('copilot:event:split', { type: 'content', text: 'hi' });
  });

  it('copilot:sendMessage — sends idle event on error', async () => {
    mockCopilot.sendMessage.mockRejectedValue(new Error('boom'));
    await invoke('copilot:sendMessage', 'fail', undefined, 'main');
    expect(mockWebContents.send).toHaveBeenCalledWith('copilot:event:main', { type: 'session.idle' });
  });

  it('copilot:abort — calls abort and sends idle event', async () => {
    await invoke('copilot:abort', 'panel2');
    expect(mockCopilot.abort).toHaveBeenCalledWith('panel2');
    expect(mockWebContents.send).toHaveBeenCalledWith('copilot:event:panel2', { type: 'session.idle' });
  });

  it('copilot:abort — defaults panelId to "main"', async () => {
    await invoke('copilot:abort');
    expect(mockCopilot.abort).toHaveBeenCalledWith('main');
    expect(mockWebContents.send).toHaveBeenCalledWith('copilot:event:main', { type: 'session.idle' });
  });

  it('copilot:destroySession — destroys session for given panelId', async () => {
    await invoke('copilot:destroySession', 'split');
    expect(mockCopilot.destroySession).toHaveBeenCalledWith('split');
  });

  it('copilot:getCustomToolNames — returns tool names from copilot service', async () => {
    const result = await invoke('copilot:getCustomToolNames');
    expect(mockCopilot.getCustomToolNames).toHaveBeenCalled();
    expect(result).toEqual(['tool-a', 'tool-b']);
  });

  it('copilot:setExcludedTools — passes panelId and tools', async () => {
    await invoke('copilot:setExcludedTools', 'main', ['bash']);
    expect(mockCopilot.setExcludedTools).toHaveBeenCalledWith('main', ['bash']);
  });

  it('copilot:getExcludedTools — returns excluded tools for panel', () => {
    const result = invoke('copilot:getExcludedTools', 'main');
    expect(mockCopilot.getExcludedTools).toHaveBeenCalledWith('main');
    expect(result).toEqual([]);
  });
});

// ────────────────────────────────────────────
// CWD channels
// ────────────────────────────────────────────

describe('cwd channels', () => {
  it('cwd:get — returns current working directory from stats', () => {
    const result = invoke('cwd:get');
    expect(mockStats.getCwd).toHaveBeenCalled();
    expect(result).toBe('/projects/test');
  });

  it('cwd:set — sets cwd on stats and copilot (no panelIds)', () => {
    invoke('cwd:set', '/new/path');
    expect(mockStats.setCwd).toHaveBeenCalledWith('/new/path');
    expect(mockCopilot.setWorkingDirectory).toHaveBeenCalledWith('/new/path');
    expect(mockCopilot.setWorkingDirectoryForPanels).not.toHaveBeenCalled();
  });

  it('cwd:set — calls setWorkingDirectoryForPanels when panelIds provided', () => {
    invoke('cwd:set', '/new/path', ['main', 'split']);
    expect(mockStats.setCwd).toHaveBeenCalledWith('/new/path');
    expect(mockCopilot.setWorkingDirectoryForPanels).toHaveBeenCalledWith(['main', 'split'], '/new/path');
  });

  it('cwd:getRecent — returns recent cwds', () => {
    const result = invoke('cwd:getRecent');
    expect(mockStats.getRecentCwds).toHaveBeenCalled();
    expect(result).toEqual(['/projects/test']);
  });
});

// ────────────────────────────────────────────
// Model channels
// ────────────────────────────────────────────

describe('model channels', () => {
  it('model:get — returns model from stats', () => {
    const result = invoke('model:get');
    expect(mockStats.getModel).toHaveBeenCalled();
    expect(result).toBe('gpt-4');
  });

  it('model:set — sets model on both stats and copilot', () => {
    invoke('model:set', 'claude-3');
    expect(mockStats.setModel).toHaveBeenCalledWith('claude-3');
    expect(mockCopilot.setModel).toHaveBeenCalledWith('claude-3');
  });

  it('model:list — returns models from copilot service', async () => {
    const result = await invoke('model:list');
    expect(mockCopilot.listModels).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'm1' }]);
  });

  it('model:refresh — refreshes and returns models', async () => {
    const result = await invoke('model:refresh');
    expect(mockCopilot.refreshModels).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

// ────────────────────────────────────────────
// Auth channels
// ────────────────────────────────────────────

describe('auth channels', () => {
  it('auth:getCliUser — calls auth.getCliUser()', async () => {
    const result = await invoke('auth:getCliUser');
    expect(auth.getCliUser).toHaveBeenCalled();
    expect(result).toEqual({ login: 'octocat' });
  });

  it('auth:getActiveSource — returns active auth source', () => {
    const result = invoke('auth:getActiveSource');
    expect(auth.getActiveSource).toHaveBeenCalled();
    expect(result).toBe('cli');
  });

  it('auth:logoutOAuth — clears OAuth and restarts client', async () => {
    await invoke('auth:logoutOAuth');
    expect(auth.clearOAuth).toHaveBeenCalled();
    expect(mockCopilot.restartClient).toHaveBeenCalled();
  });

  it('auth:getOAuthUser — returns persisted OAuth user', () => {
    const result = invoke('auth:getOAuthUser');
    expect(auth.getPersistedOAuthUser).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('auth:setActiveSource — sets source and restarts client', async () => {
    await invoke('auth:setActiveSource', 'oauth');
    expect(auth.setActiveSource).toHaveBeenCalledWith('oauth');
    expect(mockCopilot.restartClient).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────
// Pack channels
// ────────────────────────────────────────────

describe('pack channels', () => {
  it('packs:milestone:list — returns milestone packs', () => {
    const result = invoke('packs:milestone:list');
    expect(packs.getMilestonePacks).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'mp1' }]);
  });

  it('packs:milestone:save — saves a milestone pack', () => {
    const pack = { id: 'mp2', name: 'Custom' };
    invoke('packs:milestone:save', pack);
    expect(packs.saveMilestonePack).toHaveBeenCalledWith(pack);
  });

  it('packs:sound:setActive — activates a sound pack', () => {
    invoke('packs:sound:setActive', 'sp1');
    expect(packs.setSoundPackActive).toHaveBeenCalledWith('sp1');
  });

  it('packs:milestone:delete — deletes a milestone pack', () => {
    invoke('packs:milestone:delete', 'mp1');
    expect(packs.deleteMilestonePack).toHaveBeenCalledWith('mp1');
  });

  it('packs:theme:list — returns theme packs', () => {
    invoke('packs:theme:list');
    expect(packs.getThemePacks).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────
// Profile channels
// ────────────────────────────────────────────

describe('profile channels', () => {
  it('profiles:list — returns list of profiles', () => {
    const result = invoke('profiles:list');
    expect(profiles.listProfiles).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'p1', name: 'Default' }]);
  });

  it('profiles:setActive — sets active profile, applies it, and sends event', async () => {
    (profiles.getActiveProfileId as Mock).mockReturnValue('p1');
    (profiles.getActiveProfile as Mock).mockReturnValue({ id: 'p2', name: 'Dev' });
    await invoke('profiles:setActive', 'p2');
    expect(profiles.setActiveProfileId).toHaveBeenCalledWith('p2');
    expect(mockCopilot.applyProfile).toHaveBeenCalledWith('p1');
    expect(mockWebContents.send).toHaveBeenCalledWith('profiles:changed', {
      id: 'p2',
      profile: { id: 'p2', name: 'Dev' },
    });
  });

  it('profiles:save — saves a profile', () => {
    const profile = { id: 'p1', name: 'Updated' };
    invoke('profiles:save', profile);
    expect(profiles.saveProfile).toHaveBeenCalledWith(profile);
  });

  it('profiles:getActive — returns active profile id and profile', () => {
    (profiles.getActiveProfileId as Mock).mockReturnValue('p1');
    (profiles.getActiveProfile as Mock).mockReturnValue({ id: 'p1', name: 'Default' });
    const result = invoke('profiles:getActive');
    expect(result).toEqual({ id: 'p1', profile: { id: 'p1', name: 'Default' } });
  });

  it('profiles:delete — deletes a profile', () => {
    invoke('profiles:delete', 'p1');
    expect(profiles.deleteProfile).toHaveBeenCalledWith('p1');
  });

  it('profiles:setPanelProfile — sets panel profile on copilot', () => {
    invoke('profiles:setPanelProfile', 'main', 'p2');
    expect(mockCopilot.setPanelProfile).toHaveBeenCalledWith('main', 'p2');
  });

  it('profiles:getPanelProfile — returns panel profile from copilot', () => {
    const result = invoke('profiles:getPanelProfile', 'main');
    expect(mockCopilot.getPanelProfile).toHaveBeenCalledWith('main');
    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────
// Feature channels
// ────────────────────────────────────────────

describe('feature channels', () => {
  it('features:get — returns feature flags', () => {
    const result = invoke('features:get');
    expect(mockCopilot.getFeatures).toHaveBeenCalled();
    expect(result).toEqual({ streaming: true });
  });

  it('features:setReasoningEffort — sets reasoning effort', () => {
    invoke('features:setReasoningEffort', 'high');
    expect(mockCopilot.setReasoningEffort).toHaveBeenCalledWith('high');
  });

  it('features:getReasoningEffort — returns current reasoning effort', () => {
    const result = invoke('features:getReasoningEffort');
    expect(mockCopilot.getReasoningEffort).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('features:set — sets feature flags', () => {
    invoke('features:set', { streaming: false });
    expect(mockCopilot.setFeatures).toHaveBeenCalledWith({ streaming: false });
  });
});

// ────────────────────────────────────────────
// Session & Agent channels
// ────────────────────────────────────────────

describe('session & agent channels', () => {
  it('sessions:list — returns sessions from copilot', async () => {
    const result = await invoke('sessions:list');
    expect(mockCopilot.listSessions).toHaveBeenCalled();
    expect(result).toEqual([{ id: 's1' }]);
  });

  it('sessions:resume — resumes session with default panelId', async () => {
    const result = await invoke('sessions:resume', 'sess-123');
    expect(mockCopilot.resumeSession).toHaveBeenCalledWith('sess-123', 'main');
    expect(result).toEqual({ sessionId: 's1' });
  });

  it('sessions:resume — uses explicit panelId', async () => {
    await invoke('sessions:resume', 'sess-123', 'split');
    expect(mockCopilot.resumeSession).toHaveBeenCalledWith('sess-123', 'split');
  });

  it('agents:set — sets custom agents', () => {
    const agents = [{ name: 'agent1', prompt: 'Do stuff' }];
    invoke('agents:set', agents);
    expect(mockCopilot.setCustomAgents).toHaveBeenCalledWith(agents);
  });

  it('agents:get — returns custom agents', () => {
    const result = invoke('agents:get');
    expect(mockCopilot.getCustomAgents).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

// ────────────────────────────────────────────
// Scheduler channels
// ────────────────────────────────────────────

describe('scheduler channels', () => {
  it('scheduler:list — returns scheduled tasks', () => {
    const result = invoke('scheduler:list');
    expect(mockScheduler.listTasks).toHaveBeenCalled();
    expect(result).toEqual([{ id: 't1', name: 'Daily backup' }]);
  });

  it('scheduler:add — adds a task and returns it', () => {
    const task = { name: 'New Task', cron: '0 * * * *' };
    const result = invoke('scheduler:add', task);
    expect(mockScheduler.addTask).toHaveBeenCalledWith(task);
    expect(result).toEqual({ id: 't2' });
  });

  it('scheduler:delete — deletes a task by id', () => {
    invoke('scheduler:delete', 't1');
    expect(mockScheduler.deleteTask).toHaveBeenCalledWith('t1');
  });

  it('scheduler:setEnabled — toggles task enabled', () => {
    invoke('scheduler:setEnabled', 't1', false);
    expect(mockScheduler.setTaskEnabled).toHaveBeenCalledWith('t1', false);
  });

  it('scheduler:getRunHistory — gets run history', () => {
    invoke('scheduler:getRunHistory', 't1');
    expect(mockScheduler.getRunHistory).toHaveBeenCalledWith('t1');
  });

  it('scheduler:runNow — runs a task immediately', async () => {
    await invoke('scheduler:runNow', 't1');
    expect(mockScheduler.runNow).toHaveBeenCalledWith('t1');
  });

  it('scheduler:getNextFireTime — returns next fire time for a task', () => {
    mockScheduler.listTasks.mockReturnValue([{ id: 't1', name: 'Daily backup' }]);
    const result = invoke('scheduler:getNextFireTime', 't1');
    expect(mockScheduler.getNextFireTime).toHaveBeenCalledWith({ id: 't1', name: 'Daily backup' });
    expect(result).toBe(new Date('2025-01-01').getTime());
  });

  it('scheduler:getNextFireTime — returns null for unknown task', () => {
    mockScheduler.listTasks.mockReturnValue([]);
    const result = invoke('scheduler:getNextFireTime', 'unknown');
    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────
// Utility channels
// ────────────────────────────────────────────

describe('utility channels', () => {
  it('util:saveTempImage — writes file and returns path', async () => {
    const buf = Buffer.from('png-data');
    const result = await invoke('util:saveTempImage', buf, 'png');
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/github-tokens-paste-.*\.png$/),
      buf,
    );
    expect(result).toMatch(/\.png$/);
  });

  it('util:openFolder — calls shell.openPath', () => {
    invoke('util:openFolder', '/my/folder');
    expect(shell.openPath).toHaveBeenCalledWith('/my/folder');
  });

  it('util:openInVSCode — calls execFile with code command', () => {
    invoke('util:openInVSCode', '/my/project');
    expect(execFile).toHaveBeenCalledWith('code', ['/my/project'], expect.objectContaining({ env: process.env }));
  });
});

// ────────────────────────────────────────────
// MCP channels
// ────────────────────────────────────────────

describe('mcp channels', () => {
  it('mcp:list — returns configured MCP servers', () => {
    const result = invoke('mcp:list');
    expect(result).toEqual([
      { name: 'server1', type: 'stdio', command: 'node' },
    ]);
  });
});

// ────────────────────────────────────────────
// Settings channels
// ────────────────────────────────────────────

describe('settings channels', () => {
  it('settings:getSystemPrompt — returns system prompt from copilot', () => {
    const result = invoke('settings:getSystemPrompt');
    expect(mockCopilot.getSystemPrompt).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('settings:setSystemPrompt — sets system prompt', () => {
    const config = { mode: 'append' as const, content: 'Be helpful' };
    invoke('settings:setSystemPrompt', config);
    expect(mockCopilot.setSystemPrompt).toHaveBeenCalledWith(config);
  });

  it('settings:getCliMode — returns CLI mode', () => {
    const result = invoke('settings:getCliMode');
    expect(mockCopilot.getCliMode).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('settings:setCliMode — sets CLI mode', () => {
    invoke('settings:setCliMode', 'full');
    expect(mockCopilot.setCliMode).toHaveBeenCalledWith('full');
  });
});

// ────────────────────────────────────────────
// Handler registration sanity checks
// ────────────────────────────────────────────

describe('handler registration', () => {
  it('registers a large number of channels', () => {
    expect(handlers.size).toBeGreaterThanOrEqual(60);
  });

  it('all expected channel prefixes are registered', () => {
    const prefixes = ['stats:', 'copilot:', 'cwd:', 'model:', 'auth:', 'packs:', 'profiles:', 'features:', 'sessions:', 'agents:', 'scheduler:', 'util:', 'mcp:', 'settings:', 'git:'];
    for (const prefix of prefixes) {
      const found = [...handlers.keys()].some((k) => k.startsWith(prefix));
      expect(found, `Expected at least one handler with prefix "${prefix}"`).toBe(true);
    }
  });
});
