import type { DashboardStats } from '../components/TokenDashboard';

export interface Milestone {
  id: string;
  threshold: number;
  metric: 'totalTokens' | 'filesChanged' | 'linesInEdit';
  label: string;
  emoji: string;
  effect: 'sparkle' | 'banner' | 'confetti' | 'jackpot' | 'mega';
  sound: 'milestone' | 'jackpot';
}

export const MILESTONES: Milestone[] = [
  // Token milestones
  { id: 'tokens-10k',  threshold: 10_000,    metric: 'totalTokens',  label: '10K!',               emoji: '✨', effect: 'sparkle',  sound: 'milestone' },
  { id: 'tokens-50k',  threshold: 50_000,    metric: 'totalTokens',  label: '50K TOKENS!',        emoji: '🔥', effect: 'banner',   sound: 'milestone' },
  { id: 'tokens-100k', threshold: 100_000,   metric: 'totalTokens',  label: '100K TOKENS!',       emoji: '💯', effect: 'confetti',  sound: 'milestone' },
  { id: 'tokens-500k', threshold: 500_000,   metric: 'totalTokens',  label: 'JACKPOT! 500K!',     emoji: '🎰', effect: 'jackpot',   sound: 'jackpot'   },
  { id: 'tokens-1m',   threshold: 1_000_000, metric: 'totalTokens',  label: 'MILLION TOKEN CLUB', emoji: '🏆', effect: 'mega',      sound: 'jackpot'   },
  // File milestones
  { id: 'files-10',    threshold: 10,        metric: 'filesChanged', label: 'Prolific!',          emoji: '📝', effect: 'banner',   sound: 'milestone' },
  { id: 'files-50',    threshold: 50,        metric: 'filesChanged', label: 'Architect Mode!',    emoji: '🏗️', effect: 'confetti',  sound: 'milestone' },
  // Edit milestones
  { id: 'edit-100',    threshold: 100,       metric: 'linesInEdit',  label: 'Big Bang Edit!',     emoji: '💥', effect: 'banner',   sound: 'milestone' },
];

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

  for (const m of MILESTONES) {
    const prev = getMetricValue(previousStats, m.metric);
    const curr = getMetricValue(stats, m.metric);
    if (prev < m.threshold && curr >= m.threshold) {
      triggered.push(m);
    }
  }

  return triggered;
}
