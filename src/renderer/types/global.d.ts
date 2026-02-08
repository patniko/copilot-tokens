import type { SessionStats, LifetimeStats } from '../../main/stats-service';

interface CopilotAPI {
  sendMessage(prompt: string, attachments?: { path: string }[]): void;
  abort(): void;
  onEvent(callback: (event: unknown) => void): () => void;
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

declare global {
  interface Window {
    copilotAPI: CopilotAPI;
    statsAPI: StatsAPI;
    gitAPI: GitAPI;
    cwdAPI: CwdAPI;
    utilAPI: UtilAPI;
  }
}

export {};
