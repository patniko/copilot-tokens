import { describe, it, expect, beforeEach } from 'vitest';
import {
  MILESTONES,
  BADGES,
  getAllMilestones,
  checkMilestones,
  setUserMilestonePacks,
  type Milestone,
} from './milestones';
import type { DashboardStats } from '../components/TokenDashboard';

const emptyStats: DashboardStats = {
  inputTokens: 0,
  outputTokens: 0,
  realOutputTokens: 0,
  filesChanged: 0,
  linesAdded: 0,
  linesRemoved: 0,
  messagesCount: 0,
  toolCalls: 0,
};

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return { ...emptyStats, ...overrides };
}

describe('milestones', () => {
  beforeEach(() => {
    setUserMilestonePacks([]);
  });

  describe('MILESTONES constant', () => {
    it('has unique ids', () => {
      const ids = MILESTONES.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('contains token, file, and edit milestones', () => {
      const metrics = new Set(MILESTONES.map((m) => m.metric));
      expect(metrics).toContain('totalTokens');
      expect(metrics).toContain('filesChanged');
      expect(metrics).toContain('linesInEdit');
    });

    it('has thresholds in ascending order within each metric', () => {
      const byMetric = new Map<string, number[]>();
      for (const m of MILESTONES) {
        const arr = byMetric.get(m.metric) ?? [];
        arr.push(m.threshold);
        byMetric.set(m.metric, arr);
      }
      for (const [, thresholds] of byMetric) {
        for (let i = 1; i < thresholds.length; i++) {
          expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1]);
        }
      }
    });
  });

  describe('BADGES constant', () => {
    it('has unique ids', () => {
      const ids = BADGES.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every badge has a description', () => {
      for (const b of BADGES) {
        expect(b.description).toBeTruthy();
      }
    });
  });

  describe('getAllMilestones', () => {
    it('returns built-in milestones and badges when no user packs', () => {
      const all = getAllMilestones();
      expect(all.length).toBe(MILESTONES.length + BADGES.length);
    });

    it('includes active user pack milestones', () => {
      const custom: Milestone = {
        id: 'custom-1',
        threshold: 999,
        metric: 'totalTokens',
        label: 'Custom!',
        emoji: '🎉',
        effect: 'sparkle',
        sound: 'milestone',
      };
      setUserMilestonePacks([
        { id: 'pack-1', name: 'Test Pack', emoji: '📦', milestones: [custom], active: true },
      ]);
      const all = getAllMilestones();
      expect(all).toContainEqual(custom);
      expect(all.length).toBe(MILESTONES.length + BADGES.length + 1);
    });

    it('excludes inactive user pack milestones', () => {
      const custom: Milestone = {
        id: 'custom-inactive',
        threshold: 999,
        metric: 'totalTokens',
        label: 'Inactive',
        emoji: '❌',
        effect: 'sparkle',
        sound: 'milestone',
      };
      setUserMilestonePacks([
        { id: 'pack-2', name: 'Inactive Pack', emoji: '📦', milestones: [custom], active: false },
      ]);
      const all = getAllMilestones();
      expect(all.length).toBe(MILESTONES.length + BADGES.length);
      expect(all.find((m) => m.id === 'custom-inactive')).toBeUndefined();
    });
  });

  describe('checkMilestones', () => {
    it('returns empty array when no thresholds crossed', () => {
      const prev = makeStats({ inputTokens: 100 });
      const curr = makeStats({ inputTokens: 200 });
      expect(checkMilestones(curr, prev)).toEqual([]);
    });

    it('triggers token milestone when crossing threshold', () => {
      const prev = makeStats({ inputTokens: 5_000, outputTokens: 4_000 });
      const curr = makeStats({ inputTokens: 5_000, outputTokens: 5_500 });
      // prev total = 9000, curr total = 10500 -> crosses 10k
      const triggered = checkMilestones(curr, prev);
      expect(triggered.length).toBe(1);
      expect(triggered[0].id).toBe('tokens-10k');
    });

    it('triggers multiple milestones when crossing several thresholds', () => {
      const prev = makeStats({ inputTokens: 0, outputTokens: 0 });
      const curr = makeStats({ inputTokens: 50_000, outputTokens: 55_000 });
      // 0 -> 105000: crosses 10k, 50k, 100k
      const triggered = checkMilestones(curr, prev);
      const ids = triggered.map((m) => m.id);
      expect(ids).toContain('tokens-10k');
      expect(ids).toContain('tokens-50k');
      expect(ids).toContain('tokens-100k');
    });

    it('triggers file milestone', () => {
      const prev = makeStats({ filesChanged: 8 });
      const curr = makeStats({ filesChanged: 12 });
      const triggered = checkMilestones(curr, prev);
      expect(triggered.length).toBe(1);
      expect(triggered[0].id).toBe('files-10');
    });

    it('triggers edit milestone using linesAdded + linesRemoved', () => {
      const prev = makeStats({ linesAdded: 30, linesRemoved: 20 });
      const curr = makeStats({ linesAdded: 70, linesRemoved: 40 });
      // prev = 50, curr = 110 -> crosses 100
      const triggered = checkMilestones(curr, prev);
      expect(triggered.length).toBe(1);
      expect(triggered[0].id).toBe('edit-100');
    });

    it('does not re-trigger already crossed milestones', () => {
      const prev = makeStats({ inputTokens: 6_000, outputTokens: 5_000 });
      const curr = makeStats({ inputTokens: 6_000, outputTokens: 6_000 });
      // prev = 11000, curr = 12000 -> both above 10k, no trigger
      expect(checkMilestones(curr, prev)).toEqual([]);
    });

    it('skips badges (no threshold property)', () => {
      // Badges don't have 'threshold', checkMilestones should skip them
      const prev = makeStats();
      const curr = makeStats({ inputTokens: 1_000_000, outputTokens: 0 });
      const triggered = checkMilestones(curr, prev);
      // All triggered items should be Milestones (have threshold), not Badges
      for (const t of triggered) {
        expect('threshold' in t).toBe(true);
      }
    });
  });
});
