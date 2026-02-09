import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionStats, LevelProgressData } from './stats-service';

// In-memory mock for electron-store
const storeData = new Map<string, unknown>();

vi.mock('electron-store', () => {
  const MockStore = function (opts?: { defaults?: Record<string, unknown> }) {
    if (opts?.defaults) {
      for (const [k, v] of Object.entries(opts.defaults)) {
        if (!storeData.has(k)) storeData.set(k, structuredClone(v));
      }
    }
    return {
      get: (key: string) => structuredClone(storeData.get(key)),
      set: (key: string, val: unknown) => storeData.set(key, structuredClone(val)),
    };
  };
  return { default: MockStore };
});

vi.mock('./data-dir', () => ({
  DATA_DIR: '/tmp/test-data',
}));

function makeStats(overrides: Partial<SessionStats> = {}): SessionStats {
  return {
    inputTokens: 100,
    outputTokens: 200,
    messagesCount: 5,
    filesChanged: 2,
    linesAdded: 50,
    linesRemoved: 10,
    toolCalls: 3,
    durationMs: 5000,
    ...overrides,
  };
}

describe('StatsService', () => {
  let service: InstanceType<typeof import('./stats-service').StatsService>;

  beforeEach(async () => {
    storeData.clear();
    // Re-import to get a fresh store with defaults
    vi.resetModules();
    const mod = await import('./stats-service');
    service = new mod.StatsService();
  });

  // --- recordSession ---

  describe('recordSession', () => {
    it('adds a session to the sessions list', () => {
      service.recordSession(makeStats());
      const sessions = service.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].inputTokens).toBe(100);
      expect(sessions[0].outputTokens).toBe(200);
    });

    it('records multiple sessions', () => {
      service.recordSession(makeStats({ inputTokens: 10 }));
      service.recordSession(makeStats({ inputTokens: 20 }));
      expect(service.getAllSessions()).toHaveLength(2);
    });

    it('updates all-time bests', () => {
      service.recordSession(makeStats({ inputTokens: 50 }));
      service.recordSession(makeStats({ inputTokens: 200 }));
      const bests = service.getAllTimeBests();
      expect(bests.inputTokens).toBe(200);
    });

    it('does not lower all-time bests', () => {
      service.recordSession(makeStats({ linesAdded: 100 }));
      service.recordSession(makeStats({ linesAdded: 10 }));
      expect(service.getAllTimeBests().linesAdded).toBe(100);
    });

    it('accumulates lifetime tokens', () => {
      service.recordSession(makeStats({ inputTokens: 100, outputTokens: 200 }));
      service.recordSession(makeStats({ inputTokens: 50, outputTokens: 50 }));
      const stats = service.getLifetimeStats();
      expect(stats.lifetimeTokens).toBe(400);
    });

    it('sets streak to 1 on first session', () => {
      service.recordSession(makeStats());
      const stats = service.getLifetimeStats();
      expect(stats.currentStreak).toBe(1);
      expect(stats.longestStreak).toBe(1);
    });
  });

  // --- getAllSessions ---

  describe('getAllSessions', () => {
    it('returns empty array when no sessions recorded', () => {
      expect(service.getAllSessions()).toEqual([]);
    });

    it('returns sessions sorted by timestamp descending', () => {
      service.recordSession(makeStats({ inputTokens: 1 }));
      service.recordSession(makeStats({ inputTokens: 2 }));
      const sessions = service.getAllSessions();
      // Most recent first
      expect(sessions[0].timestamp).toBeGreaterThanOrEqual(sessions[1].timestamp);
    });
  });

  // --- getTopSessions ---

  describe('getTopSessions', () => {
    it('returns ranked sessions sorted by total tokens', () => {
      service.recordSession(makeStats({ inputTokens: 10, outputTokens: 10 }));
      service.recordSession(makeStats({ inputTokens: 500, outputTokens: 500 }));
      service.recordSession(makeStats({ inputTokens: 100, outputTokens: 100 }));
      const top = service.getTopSessions(2);
      expect(top).toHaveLength(2);
      expect(top[0].rank).toBe(1);
      expect(top[0].inputTokens).toBe(500);
      expect(top[1].rank).toBe(2);
    });
  });

  // --- saveConversationLog / getConversationLog ---

  describe('conversation logs', () => {
    it('saves and retrieves a conversation log', () => {
      const events = [{ type: 'message', content: 'hello' }];
      service.saveConversationLog(1000, events);
      const log = service.getConversationLog(1000);
      expect(log).toBeDefined();
      expect(log!.sessionTimestamp).toBe(1000);
      expect(log!.events).toEqual(events);
    });

    it('returns undefined for unknown session', () => {
      expect(service.getConversationLog(9999)).toBeUndefined();
    });

    it('caps stored logs at 20', () => {
      for (let i = 0; i < 25; i++) {
        service.saveConversationLog(i, [{ n: i }]);
      }
      // First 5 should have been pruned
      expect(service.getConversationLog(0)).toBeUndefined();
      expect(service.getConversationLog(5)).toBeDefined();
      expect(service.getConversationLog(24)).toBeDefined();
    });
  });

  // --- getLevelProgress / setLevelProgress ---

  describe('level progress', () => {
    it('returns default level progress', () => {
      const p = service.getLevelProgress();
      expect(p.level).toBe(1);
      expect(p.categoryProgress.tokens).toBe(0);
    });

    it('saves and retrieves level progress', () => {
      const progress: LevelProgressData = {
        level: 5,
        categoryProgress: { tokens: 1000, messages: 50, toolCalls: 20, files: 10, lines: 500 },
      };
      service.setLevelProgress(progress);
      const got = service.getLevelProgress();
      expect(got.level).toBe(5);
      expect(got.categoryProgress.tokens).toBe(1000);
    });
  });

  // --- recordReactionTime ---

  describe('recordReactionTime', () => {
    it('records a new best when faster', () => {
      const result = service.recordReactionTime(500);
      expect(result.isNewBest).toBe(true);
      expect(result.timeMs).toBe(500);
    });

    it('does not set new best when slower', () => {
      service.recordReactionTime(200);
      const result = service.recordReactionTime(300);
      expect(result.isNewBest).toBe(false);
      expect(result.previousBest).toBe(200);
    });

    it('tracks fastest response in lifetime stats', () => {
      service.recordReactionTime(150);
      expect(service.getLifetimeStats().fastestResponse).toBe(150);
    });
  });

  // --- CWD management ---

  describe('CWD management', () => {
    it('setCwd updates current cwd', () => {
      service.setCwd('/home/user/project');
      expect(service.getCwd()).toBe('/home/user/project');
    });

    it('setCwd tracks recent cwds without duplicates', () => {
      service.setCwd('/a');
      service.setCwd('/b');
      service.setCwd('/a');
      const recent = service.getRecentCwds();
      expect(recent[0]).toBe('/a');
      expect(recent.filter(d => d === '/a')).toHaveLength(1);
    });

    it('caps recent cwds at 10', () => {
      for (let i = 0; i < 15; i++) service.setCwd(`/dir${i}`);
      expect(service.getRecentCwds()).toHaveLength(10);
    });
  });

  // --- getCurrentSessionRank ---

  describe('getCurrentSessionRank', () => {
    it('returns 1 when no prior sessions', () => {
      expect(service.getCurrentSessionRank(100)).toBe(1);
    });

    it('ranks correctly among existing sessions', () => {
      service.recordSession(makeStats({ inputTokens: 100, outputTokens: 100 })); // 200 total
      service.recordSession(makeStats({ inputTokens: 500, outputTokens: 500 })); // 1000 total
      // 300 total tokens -> only the 1000 session is ahead
      expect(service.getCurrentSessionRank(300)).toBe(2);
    });
  });

  // --- Achievements ---

  describe('achievements', () => {
    it('adds and retrieves achievements', () => {
      service.addAchievement({ milestoneId: 'm1', label: 'First!', emoji: '🏆', unlockedAt: Date.now(), count: 1 });
      expect(service.getAchievements()).toHaveLength(1);
    });

    it('increments count for duplicate milestoneId', () => {
      service.addAchievement({ milestoneId: 'm1', label: 'First!', emoji: '🏆', unlockedAt: Date.now(), count: 1 });
      service.addAchievement({ milestoneId: 'm1', label: 'First!', emoji: '🏆', unlockedAt: Date.now(), count: 1 });
      const achievements = service.getAchievements();
      expect(achievements).toHaveLength(1);
      expect(achievements[0].count).toBe(2);
    });

    it('clearAchievements empties the list', () => {
      service.addAchievement({ milestoneId: 'm1', label: 'X', emoji: '🎉', unlockedAt: Date.now(), count: 1 });
      service.clearAchievements();
      expect(service.getAchievements()).toHaveLength(0);
    });
  });

  // --- Commit bests ---

  describe('commit bests', () => {
    it('records and retrieves commit bests', () => {
      service.recordCommitBests(100, 50);
      expect(service.getCommitBests()).toEqual({ linesAdded: 100, linesRemoved: 50 });
    });

    it('only raises bests, never lowers', () => {
      service.recordCommitBests(100, 50);
      service.recordCommitBests(20, 200);
      expect(service.getCommitBests()).toEqual({ linesAdded: 100, linesRemoved: 200 });
    });
  });

  // --- Model ---

  describe('model', () => {
    it('returns default model', () => {
      expect(service.getModel()).toBe('claude-sonnet-4');
    });

    it('sets and gets model', () => {
      service.setModel('gpt-4');
      expect(service.getModel()).toBe('gpt-4');
    });
  });
});
