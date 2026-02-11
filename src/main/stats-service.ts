import Store from 'electron-store';
import { DATA_DIR } from './data-dir';

export interface SessionStats {
  inputTokens: number;
  outputTokens: number;
  messagesCount: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  toolCalls: number;
  durationMs: number;
}

interface StoredSession extends SessionStats {
  timestamp: number;
  cwd?: string;
}

export interface RankedSession extends StoredSession {
  rank: number;
}

export interface LifetimeStats {
  lifetimeTokens: number;
  totalSessions: number;
  longestStreak: number;
  currentStreak: number;
  fastestResponse: number;
}

export interface Achievement {
  milestoneId: string;
  label: string;
  emoji: string;
  unlockedAt: number;
  count: number;
}

export interface SessionEvent {
  type: string;       // e.g. 'tool.start', 'token.update', 'milestone.triggered'
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface SessionEventLog {
  sessionTimestamp: number;
  events: SessionEvent[];
}

export interface LevelProgressData {
  level: number;
  categoryProgress: {
    tokens: number;
    messages: number;
    toolCalls: number;
    files: number;
    lines: number;
  };
}

export interface CommitBests {
  linesAdded: number;
  linesRemoved: number;
}

export interface ConversationLog {
  sessionTimestamp: number;
  events: Record<string, unknown>[];
}

interface StoreSchema {
  sessions: StoredSession[];
  allTimeBests: Partial<Record<keyof SessionStats, number>>;
  commitBests: CommitBests;
  lifetimeTokens: number;
  longestStreak: number;
  currentStreak: number;
  lastSessionDate: string;
  fastestResponse: number;
  recentCwds: string[];
  currentCwd: string;
  currentModel: string;
  achievements: Achievement[];
  sessionEvents: SessionEventLog[];
  conversationLogs: ConversationLog[];
  levelProgress: LevelProgressData;
}

const store = new Store<StoreSchema>({
  cwd: DATA_DIR,
  defaults: {
    sessions: [],
    allTimeBests: {},
    commitBests: { linesAdded: 0, linesRemoved: 0 },
    lifetimeTokens: 0,
    longestStreak: 0,
    currentStreak: 0,
    lastSessionDate: '',
    fastestResponse: Infinity,
    recentCwds: [],
    currentCwd: '',
    currentModel: 'claude-sonnet-4',
    achievements: [],
    sessionEvents: [],
    conversationLogs: [],
    levelProgress: {
      level: 1,
      categoryProgress: { tokens: 0, messages: 0, toolCalls: 0, files: 0, lines: 0 },
    },
  },
});

export class StatsService {
  recordSession(stats: SessionStats, timestamp?: number): void {
    const sessions = store.get('sessions');
    sessions.push({ ...stats, timestamp: timestamp ?? Date.now(), cwd: store.get('currentCwd') || undefined });
    store.set('sessions', sessions);

    // Update all-time bests
    const bests = store.get('allTimeBests');
    const keys = Object.keys(stats) as (keyof SessionStats)[];
    for (const key of keys) {
      if (bests[key] === undefined || stats[key] > bests[key]!) {
        bests[key] = stats[key];
      }
    }
    store.set('allTimeBests', bests);

    // Update lifetime tokens
    store.set('lifetimeTokens', store.get('lifetimeTokens') + stats.inputTokens + stats.outputTokens);

    // Update streak tracking
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = store.get('lastSessionDate');
    if (lastDate !== today) {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      if (lastDate === yesterday) {
        const newStreak = store.get('currentStreak') + 1;
        store.set('currentStreak', newStreak);
        if (newStreak > store.get('longestStreak')) {
          store.set('longestStreak', newStreak);
        }
      } else {
        store.set('currentStreak', 1);
        if (store.get('longestStreak') < 1) {
          store.set('longestStreak', 1);
        }
      }
      store.set('lastSessionDate', today);
    }
  }

  getAllTimeBests(): Partial<Record<keyof SessionStats, number>> {
    return store.get('allTimeBests');
  }

  getTopSessions(limit: number): RankedSession[] {
    const sessions = store.get('sessions');
    return sessions
      .sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens))
      .slice(0, limit)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  getLifetimeStats(): LifetimeStats {
    return {
      lifetimeTokens: store.get('lifetimeTokens'),
      totalSessions: store.get('sessions').length,
      longestStreak: store.get('longestStreak'),
      currentStreak: store.get('currentStreak'),
      fastestResponse: store.get('fastestResponse'),
    };
  }

  getCurrentSessionRank(totalTokens: number): number {
    const sessions = store.get('sessions');
    const rank = sessions.filter(s => (s.inputTokens + s.outputTokens) > totalTokens).length + 1;
    return rank;
  }

  getAllSessions(): StoredSession[] {
    return store.get('sessions').slice().sort((a, b) => b.timestamp - a.timestamp);
  }

  // CWD management

  getCwd(): string {
    return store.get('currentCwd') || '';
  }

  setCwd(dir: string): void {
    store.set('currentCwd', dir);
    const recent = store.get('recentCwds').filter(d => d !== dir);
    recent.unshift(dir);
    store.set('recentCwds', recent.slice(0, 10));
  }

  getRecentCwds(): string[] {
    return store.get('recentCwds');
  }

  /** Record a permission reaction time. Returns { isNewBest, timeMs, previousBest }. */
  recordReactionTime(timeMs: number): { isNewBest: boolean; timeMs: number; previousBest: number } {
    const prev = store.get('fastestResponse');
    const isNewBest = timeMs < prev;
    if (isNewBest) {
      store.set('fastestResponse', timeMs);
    }
    return { isNewBest, timeMs, previousBest: prev };
  }

  getModel(): string {
    return store.get('currentModel');
  }

  setModel(model: string): void {
    store.set('currentModel', model);
  }

  // Commit best tracking

  recordCommitBests(linesAdded: number, linesRemoved: number): void {
    const bests = store.get('commitBests');
    if (linesAdded > bests.linesAdded) bests.linesAdded = linesAdded;
    if (linesRemoved > bests.linesRemoved) bests.linesRemoved = linesRemoved;
    store.set('commitBests', bests);
  }

  getCommitBests(): CommitBests {
    return store.get('commitBests');
  }

  // Achievement tracking

  getAchievements(): Achievement[] {
    return store.get('achievements');
  }

  addAchievement(achievement: Achievement): void {
    const existing = store.get('achievements');
    const idx = existing.findIndex((a) => a.milestoneId === achievement.milestoneId);
    if (idx >= 0) {
      existing[idx].count = (existing[idx].count || 1) + 1;
    } else {
      existing.push({ ...achievement, count: achievement.count || 1 });
    }
    store.set('achievements', existing);
  }

  clearAchievements(): void {
    store.set('achievements', []);
  }

  // Session event recording

  saveSessionEvents(sessionTimestamp: number, events: SessionEvent[]): void {
    const logs = store.get('sessionEvents');
    logs.push({ sessionTimestamp, events });
    // Keep last 20 session replays
    if (logs.length > 20) logs.splice(0, logs.length - 20);
    store.set('sessionEvents', logs);
  }

  getSessionEvents(): SessionEventLog[] {
    return store.get('sessionEvents');
  }

  getSessionEventLog(sessionTimestamp: number): SessionEventLog | undefined {
    return store.get('sessionEvents').find((l) => l.sessionTimestamp === sessionTimestamp);
  }

  // Conversation logs (raw copilot events for session restore)

  saveConversationLog(sessionTimestamp: number, events: Record<string, unknown>[]): void {
    const logs = store.get('conversationLogs');
    logs.push({ sessionTimestamp, events });
    if (logs.length > 20) logs.splice(0, logs.length - 20);
    store.set('conversationLogs', logs);
  }

  getConversationLog(sessionTimestamp: number): ConversationLog | undefined {
    return store.get('conversationLogs').find((l) => l.sessionTimestamp === sessionTimestamp);
  }

  // Level system

  getLevelProgress(): LevelProgressData {
    return store.get('levelProgress');
  }

  setLevelProgress(progress: LevelProgressData): void {
    store.set('levelProgress', progress);
  }
}
