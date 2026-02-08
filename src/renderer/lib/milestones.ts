import type { DashboardStats } from '../components/TokenDashboard';
import type { MilestonePack } from './pack-types';

export interface Milestone {
  id: string;
  threshold: number;
  metric: 'totalTokens' | 'filesChanged' | 'linesInEdit';
  label: string;
  emoji: string;
  effect: 'sparkle' | 'banner' | 'confetti' | 'jackpot' | 'mega';
  sound: 'milestone' | 'jackpot' | 'celebration100k' | 'celebration500k';
}

/** One-shot badges triggered by specific user actions */
export interface Badge {
  id: string;
  label: string;
  emoji: string;
  effect: 'sparkle' | 'banner' | 'confetti';
  sound: 'milestone';
  description: string;
}

export const MILESTONES: Milestone[] = [
  // Token milestones
  { id: 'tokens-10k',  threshold: 10_000,    metric: 'totalTokens',  label: '10K!',               emoji: '✨', effect: 'sparkle',  sound: 'milestone' },
  { id: 'tokens-50k',  threshold: 50_000,    metric: 'totalTokens',  label: '50K TOKENS!',        emoji: '🔥', effect: 'banner',   sound: 'milestone' },
  { id: 'tokens-100k', threshold: 100_000,   metric: 'totalTokens',  label: '100K TOKENS!',       emoji: '💯', effect: 'confetti',  sound: 'celebration100k' },
  { id: 'tokens-500k', threshold: 500_000,   metric: 'totalTokens',  label: 'JACKPOT! 500K!',     emoji: '🎰', effect: 'jackpot',   sound: 'celebration500k' },
  { id: 'tokens-1m',   threshold: 1_000_000, metric: 'totalTokens',  label: 'MILLION TOKEN CLUB', emoji: '🏆', effect: 'mega',      sound: 'celebration500k' },
  // File milestones
  { id: 'files-10',    threshold: 10,        metric: 'filesChanged', label: 'Prolific!',          emoji: '📝', effect: 'banner',   sound: 'milestone' },
  { id: 'files-50',    threshold: 50,        metric: 'filesChanged', label: 'Architect Mode!',    emoji: '🏗️', effect: 'confetti',  sound: 'milestone' },
  // Edit milestones
  { id: 'edit-100',    threshold: 100,       metric: 'linesInEdit',  label: 'Big Bang Edit!',     emoji: '💥', effect: 'banner',   sound: 'milestone' },
];

export const BADGES: Badge[] = [
  // Feature discovery
  { id: 'badge-first-image',     label: 'Visionary',         emoji: '🖼️',  effect: 'sparkle',  sound: 'milestone', description: 'Attached an image for the first time' },
  { id: 'badge-first-split',     label: 'Split Personality', emoji: '🪞',  effect: 'banner',   sound: 'milestone', description: 'Split into parallel sessions' },
  { id: 'badge-first-queue',     label: 'Queue Master',      emoji: '📋',  effect: 'sparkle',  sound: 'milestone', description: 'Queued a message while agent was working' },
  { id: 'badge-dual-agents',     label: 'Dual Wielder',      emoji: '⚔️',  effect: 'confetti', sound: 'milestone', description: 'Ran two agents at the same time' },
  { id: 'badge-first-commit',    label: 'Ship It!',          emoji: '🚀',  effect: 'banner',   sound: 'milestone', description: 'Made your first commit' },
  { id: 'badge-yolo',            label: 'YOLO!',             emoji: '🔥',  effect: 'banner',   sound: 'milestone', description: 'Enabled YOLO mode' },
  { id: 'badge-night-owl',       label: 'Night Owl',         emoji: '🦉',  effect: 'sparkle',  sound: 'milestone', description: 'Coded past midnight' },
  { id: 'badge-early-bird',      label: 'Early Bird',        emoji: '🐦',  effect: 'sparkle',  sound: 'milestone', description: 'Coded before 6 AM' },
  { id: 'badge-5-sessions',      label: 'Regular',           emoji: '🎯',  effect: 'banner',   sound: 'milestone', description: 'Completed 5 sessions' },
  { id: 'badge-marathon',        label: 'Marathon Runner',   emoji: '🏃',  effect: 'confetti', sound: 'milestone', description: 'Session lasted over 10 minutes' },
  { id: 'badge-speed-demon',     label: 'Speed Demon',       emoji: '⚡',  effect: 'sparkle',  sound: 'milestone', description: 'Session under 30 seconds' },
  { id: 'badge-10-tools',        label: 'Toolsmith',         emoji: '🔧',  effect: 'sparkle',  sound: 'milestone', description: 'Used 10+ tool calls in one session' },
  { id: 'badge-load-session',    label: 'Time Traveler',     emoji: '⏪',  effect: 'sparkle',  sound: 'milestone', description: 'Loaded a previous session' },
  { id: 'badge-3-panels',        label: 'Multitasker',       emoji: '🧠',  effect: 'confetti', sound: 'milestone', description: 'Opened 3+ panels at once' },
];

// User milestone packs loaded from pack store
let userPacks: MilestonePack[] = [];

export function setUserMilestonePacks(packs: MilestonePack[]): void {
  userPacks = packs;
}

/** Returns built-in milestones + badges merged with active user packs */
export function getAllMilestones(): (Milestone | Badge)[] {
  const extras = userPacks.filter((p) => p.active).flatMap((p) => p.milestones);
  return [...MILESTONES, ...BADGES, ...extras];
}

function getMetricValue(stats: DashboardStats, metric: Milestone['metric']): number {
  switch (metric) {
    case 'totalTokens':  return stats.inputTokens + stats.outputTokens;
    case 'filesChanged': return stats.filesChanged;
    case 'linesInEdit':  return stats.linesAdded + stats.linesRemoved;
  }
}

export function checkMilestones(
  stats: DashboardStats,
  previousStats: DashboardStats,
): Milestone[] {
  const triggered: Milestone[] = [];

  for (const m of getAllMilestones()) {
    if (!('threshold' in m)) continue; // Skip badges
    const prev = getMetricValue(previousStats, m.metric);
    const curr = getMetricValue(stats, m.metric);
    if (prev < m.threshold && curr >= m.threshold) {
      triggered.push(m);
    }
  }

  return triggered;
}
