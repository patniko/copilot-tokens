import type { SessionStats, LifetimeStats, Achievement, SessionEvent, SessionEventLog, LevelProgressData } from '../../main/stats-service';
import type { GitHubUser, AuthSource } from '../../main/auth-service';
import type { MilestonePack, SoundPack, ThemePack } from '../lib/pack-types';

interface CopilotAPI {
  sendMessage(prompt: string, attachments?: { path: string }[], panelId?: string): void;
  abort(panelId?: string): void;
  destroySession(panelId: string): void;
  onEvent(callback: (event: unknown) => void, panelId?: string): () => void;
  onPermissionRequest(callback: (request: unknown) => void): () => void;
  respondPermission(decision: string, rulePathPrefix?: string): void;
  addPermissionRule(kind: string, pathPrefix: string): Promise<void>;
  getPermissionRules(): Promise<{ kind: string; pathPrefix: string }[]>;
  removePermissionRule(index: number): Promise<void>;
  clearPermissionRules(): Promise<void>;
  setYoloMode(enabled: boolean): Promise<void>;
  getYoloMode(): Promise<boolean>;
  onAskUserRequest(callback: (request: { question: string; choices?: string[]; allowFreeform?: boolean }) => void): () => void;
  respondAskUser(answer: string, wasFreeform: boolean): void;
}

interface StatsAPI {
  getAllSessions(): Promise<(SessionStats & { timestamp: number; cwd?: string })[]>;
  getTopSessions(limit: number): Promise<unknown[]>;
  getAllTimeBests(): Promise<Partial<Record<keyof SessionStats, number>>>;
  recordSession(stats: SessionStats): Promise<void>;
  getLifetimeStats(): Promise<LifetimeStats>;
  getCurrentSessionRank(totalTokens: number): Promise<number>;
  getAchievements(): Promise<Achievement[]>;
  addAchievement(achievement: Achievement): Promise<void>;
  clearAchievements(): Promise<void>;
  saveSessionEvents(sessionTimestamp: number, events: SessionEvent[]): Promise<void>;
  getSessionEvents(): Promise<SessionEventLog[]>;
  getSessionEventLog(sessionTimestamp: number): Promise<SessionEventLog | undefined>;
  saveConversationLog(sessionTimestamp: number, events: Record<string, unknown>[]): Promise<void>;
  getConversationLog(sessionTimestamp: number): Promise<{ sessionTimestamp: number; events: Record<string, unknown>[] } | undefined>;
  getCommitBests(): Promise<{ linesAdded: number; linesRemoved: number }>;
  getLevelProgress(): Promise<LevelProgressData>;
  setLevelProgress(progress: LevelProgressData): Promise<void>;
  recordReactionTime(timeMs: number): Promise<{ isNewBest: boolean; timeMs: number; previousBest: number }>;
}

interface GitAPI {
  commit(message: string, files: string[]): Promise<{ success: boolean; hash?: string }>;
  diff(): Promise<string>;
}

interface CwdAPI {
  get(): Promise<string>;
  set(dir: string): Promise<void>;
  getRecent(): Promise<string[]>;
  browse(): Promise<string | null>;
  gitInfo(dir: string): Promise<{ isRepo: boolean; branch?: string }>;
  gitStats(dir: string): Promise<{ filesChanged: number; linesAdded: number; linesRemoved: number; files: string[] }>;
}

interface UtilAPI {
  saveTempImage(buffer: ArrayBuffer, ext: string): Promise<string>;
  openInVSCode(dir: string): void;
  openFolder(dir: string): void;
  openCopilotShell(dir: string): void;
}

interface ModelAPI {
  get(): Promise<string>;
  set(model: string): Promise<void>;
  list(): Promise<{ id: string; name: string; contextWindow: number }[]>;
  refresh(): Promise<{ id: string; name: string; contextWindow: number }[]>;
}

interface McpAPI {
  list(): Promise<{ name: string; type: string; command: string }[]>;
}

interface FeaturesAPI {
  get(): Promise<{ customTools: boolean; askUser: boolean; reasoning: boolean; infiniteSessions: boolean; hooks: boolean; customAgents: boolean; sessionEvents: boolean }>;
  set(features: { customTools: boolean; askUser: boolean; reasoning: boolean; infiniteSessions: boolean; hooks: boolean; customAgents: boolean; sessionEvents: boolean }): Promise<void>;
  getReasoningEffort(): Promise<string | null>;
  setReasoningEffort(effort: string | null): Promise<void>;
}

interface SessionsAPI {
  list(): Promise<{ sessionId: string; startTime: string; modifiedTime: string; summary?: string }[]>;
  resume(sessionId: string, panelId?: string): Promise<void>;
}

interface AgentsAPI {
  get(): Promise<{ name: string; displayName?: string; description?: string; tools?: string[] | null; prompt: string }[]>;
  set(agents: { name: string; displayName?: string; description?: string; tools?: string[] | null; prompt: string }[]): Promise<void>;
}

interface PackAPI {
  listMilestonePacks(): Promise<MilestonePack[]>;
  saveMilestonePack(pack: MilestonePack): Promise<void>;
  deleteMilestonePack(id: string): Promise<void>;
  setMilestonePackActive(id: string, active: boolean): Promise<void>;
  listSoundPacks(): Promise<SoundPack[]>;
  saveSoundPack(pack: SoundPack): Promise<void>;
  deleteSoundPack(id: string): Promise<void>;
  setSoundPackActive(id: string): Promise<void>;
  listThemePacks(): Promise<ThemePack[]>;
  saveThemePack(pack: ThemePack): Promise<void>;
  deleteThemePack(id: string): Promise<void>;
}

type CliMode =
  | { type: 'bundled' }
  | { type: 'installed' }
  | { type: 'remote'; url: string };

interface SettingsAPI {
  getSystemPrompt(): Promise<{ mode: 'append' | 'replace'; content: string }>;
  setSystemPrompt(config: { mode: 'append' | 'replace'; content: string }): Promise<void>;
  getCliMode(): Promise<CliMode>;
  setCliMode(mode: CliMode): Promise<void>;
}

interface AuthAPI {
  getCliUser(): Promise<GitHubUser | null>;
  getOAuthUser(): Promise<GitHubUser | null>;
  startOAuth(): Promise<{ userCode: string; verificationUri: string }>;
  pollOAuth(): Promise<GitHubUser>;
  setActiveSource(source: AuthSource): Promise<void>;
  getActiveSource(): Promise<AuthSource>;
  logoutOAuth(): Promise<void>;
}

declare global {
  interface Window {
    copilotAPI: CopilotAPI;
    statsAPI: StatsAPI;
    gitAPI: GitAPI;
    cwdAPI: CwdAPI;
    utilAPI: UtilAPI;
    modelAPI: ModelAPI;
    mcpAPI: McpAPI;
    packAPI: PackAPI;
    settingsAPI: SettingsAPI;
    authAPI: AuthAPI;
    featuresAPI: FeaturesAPI;
    sessionsAPI: SessionsAPI;
    agentsAPI: AgentsAPI;
  }
}

export {};
