import type { SessionStats, LifetimeStats } from '../../main/stats-service';

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

declare global {
  interface Window {
    copilotAPI: CopilotAPI;
    statsAPI: StatsAPI;
    gitAPI: GitAPI;
    cwdAPI: CwdAPI;
    utilAPI: UtilAPI;
    modelAPI: ModelAPI;
    mcpAPI: McpAPI;
  }
}

export {};
