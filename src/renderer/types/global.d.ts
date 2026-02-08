import type { SessionStats, LifetimeStats } from '../../main/stats-service';

interface CopilotAPI {
  sendMessage(prompt: string): void;
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
}

declare global {
  interface Window {
    copilotAPI: CopilotAPI;
    statsAPI: StatsAPI;
    gitAPI: GitAPI;
    cwdAPI: CwdAPI;
  }
}

export {};
