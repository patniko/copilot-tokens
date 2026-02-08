import Store from 'electron-store';

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

interface StoreSchema {
  sessions: StoredSession[];
  allTimeBests: Partial<Record<keyof SessionStats, number>>;
  lifetimeTokens: number;
  longestStreak: number;
  currentStreak: number;
  lastSessionDate: string;
  fastestResponse: number;
}

const store = new Store<StoreSchema>({
  defaults: {
    sessions: [],
    allTimeBests: {},
    lifetimeTokens: 0,
    longestStreak: 0,
    currentStreak: 0,
    lastSessionDate: '',
    fastestResponse: Infinity,
  },
});

export class StatsService {
  recordSession(stats: SessionStats): void {
    const sessions = store.get('sessions');
    sessions.push({ ...stats, timestamp: Date.now() });
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

    // Update fastest response
    if (stats.durationMs < store.get('fastestResponse')) {
      store.set('fastestResponse', stats.durationMs);
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
}
