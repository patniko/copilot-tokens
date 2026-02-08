import type { SessionStats, LifetimeStats, Achievement, SessionEvent, SessionEventLog, LevelProgressData } from '../../main/stats-service';
import type { GitHubUser, AuthSource } from '../../main/auth-service';
import type { MilestonePack, SoundPack, ThemePack } from '../lib/pack-types';

interface CopilotAPI {
  sendMessage(prompt: string, attachments?: { path: string }[]): void;
  abort(): void;
  onEvent(callback: (event: unknown) => void): () => void;
  onPermissionRequest(callback: (request: unknown) => void): () => void;
  respondPermission(decision: string, rulePathPrefix?: string): void;
  addPermissionRule(kind: string, pathPrefix: string): Promise<void>;
  getPermissionRules(): Promise<{ kind: string; pathPrefix: string }[]>;
  removePermissionRule(index: number): Promise<void>;
  clearPermissionRules(): Promise<void>;
  setYoloMode(enabled: boolean): Promise<void>;
  getYoloMode(): Promise<boolean>;
}

interface StatsAPI {
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
  getLevelProgress(): Promise<LevelProgressData>;
  setLevelProgress(progress: LevelProgressData): Promise<void>;
}

interface GitAPI {
  commit(message: string, files: string[]): Promise<{ success: boolean; hash?: string }>;
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
  openCopilotShell(dir: string): void;
}

interface ModelAPI {
  get(): Promise<string>;
  set(model: string): Promise<void>;
  list(): Promise<{ id: string; name: string; contextWindow: number }[]>;
}

interface McpAPI {
  list(): Promise<{ name: string; type: string; command: string }[]>;
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
    authAPI: AuthAPI;
  }
}

export {};
