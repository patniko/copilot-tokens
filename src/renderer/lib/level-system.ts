/**
 * Leveling system — 100 levels across 5 categories.
 *
 * A user must fill ALL category bars for a level to advance.
 * Categories reset to 0 on level-up. Thresholds grow polynomially
 * so each level is harder than the last, targeting ~1 year of
 * heavy daily usage to reach level 100.
 *
 * Category scaling (threshold = base × level^exp):
 *   tokens:   heavy contribution — most volume
 *   messages: moderate contribution
 *   toolCalls: moderate contribution
 *   files:    lighter — fewer but meaningful
 *   lines:    moderate — lines added+removed
 */

export const LEVEL_CATEGORIES = ['tokens', 'messages', 'toolCalls', 'files', 'lines'] as const;
export type LevelCategory = (typeof LEVEL_CATEGORIES)[number];

export interface LevelProgress {
  level: number;                          // 1–100
  categoryProgress: Record<LevelCategory, number>; // accumulated since last level-up
}

export interface LevelThresholds {
  level: number;
  thresholds: Record<LevelCategory, number>;
}

const CATEGORY_PARAMS: Record<LevelCategory, { base: number; exp: number }> = {
  //                  base    exp
  // At level 1:      base tokens needed, scaling up to level^exp * base at level 100
  tokens:    { base: 800,  exp: 2.15 },   // L1: 800,  L10: 113K, L50: 4.3M,  L100: 20M
  messages:  { base: 8,    exp: 1.85 },   // L1: 8,    L10: 566,  L50: 13.5K, L100: 40K
  toolCalls: { base: 5,    exp: 1.80 },   // L1: 5,    L10: 316,  L50: 7K,    L100: 20K
  files:     { base: 3,    exp: 1.55 },   // L1: 3,    L10: 106,  L50: 1.1K,  L100: 2.5K
  lines:     { base: 15,   exp: 1.90 },   // L1: 15,   L10: 1.2K, L50: 30K,   L100: 95K
};

export const MAX_LEVEL = 100;

/** Get the thresholds for a given level (1-indexed). */
export function getThresholds(level: number): LevelThresholds {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, level));
  const thresholds = {} as Record<LevelCategory, number>;
  for (const cat of LEVEL_CATEGORIES) {
    const { base, exp } = CATEGORY_PARAMS[cat];
    thresholds[cat] = Math.round(base * Math.pow(clamped, exp));
  }
  return { level: clamped, thresholds };
}

/** Get fractional completion (0–1) per category. */
export function getCategoryCompletion(
  progress: LevelProgress,
): Record<LevelCategory, number> {
  const { thresholds } = getThresholds(progress.level);
  const result = {} as Record<LevelCategory, number>;
  for (const cat of LEVEL_CATEGORIES) {
    result[cat] = Math.min(1, progress.categoryProgress[cat] / thresholds[cat]);
  }
  return result;
}

/** Overall level completion — minimum of all category completions. */
export function getOverallCompletion(progress: LevelProgress): number {
  const completions = getCategoryCompletion(progress);
  return Math.min(...LEVEL_CATEGORIES.map((c) => completions[c]));
}

/** Whether all categories are complete for the current level. */
export function canLevelUp(progress: LevelProgress): boolean {
  if (progress.level >= MAX_LEVEL) return false;
  return getOverallCompletion(progress) >= 1;
}

/** Add session stats to progress. Returns updated progress + whether a level-up occurred. */
export function addSessionToProgress(
  progress: LevelProgress,
  session: {
    inputTokens: number;
    outputTokens: number;
    messagesCount: number;
    toolCalls: number;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
  },
): { progress: LevelProgress; leveledUp: boolean; newLevel: number } {
  const updated: LevelProgress = {
    level: progress.level,
    categoryProgress: { ...progress.categoryProgress },
  };

  // Accumulate — excess within a category is capped at the threshold (no carry-over)
  updated.categoryProgress.tokens += session.inputTokens + session.outputTokens;
  updated.categoryProgress.messages += session.messagesCount;
  updated.categoryProgress.toolCalls += session.toolCalls;
  updated.categoryProgress.files += session.filesChanged;
  updated.categoryProgress.lines += session.linesAdded + session.linesRemoved;

  let leveledUp = false;
  // Check for level-up (could theoretically multi-level in extreme cases)
  while (canLevelUp(updated)) {
    updated.level += 1;
    updated.categoryProgress = freshProgress();
    leveledUp = true;
  }

  return { progress: updated, leveledUp, newLevel: updated.level };
}

/** Create zeroed-out category progress. */
export function freshProgress(): Record<LevelCategory, number> {
  return { tokens: 0, messages: 0, toolCalls: 0, files: 0, lines: 0 };
}

/** Initial level progress for a brand new user. */
export function initialLevelProgress(): LevelProgress {
  return { level: 1, categoryProgress: freshProgress() };
}

/** Human-readable labels. */
export const CATEGORY_LABELS: Record<LevelCategory, { label: string; emoji: string; unit: string }> = {
  tokens:    { label: 'Tokens',     emoji: '🪙', unit: 'tokens' },
  messages:  { label: 'Messages',   emoji: '💬', unit: 'msgs' },
  toolCalls: { label: 'Tool Calls', emoji: '🔧', unit: 'calls' },
  files:     { label: 'Files',      emoji: '📁', unit: 'files' },
  lines:     { label: 'Lines',      emoji: '📝', unit: 'lines' },
};

/** Tier names for level ranges. */
export function getLevelTier(level: number): { name: string; emoji: string } {
  if (level >= 90) return { name: 'Legendary', emoji: '🌟' };
  if (level >= 75) return { name: 'Master',    emoji: '👑' };
  if (level >= 60) return { name: 'Expert',    emoji: '💎' };
  if (level >= 45) return { name: 'Veteran',   emoji: '⚔️' };
  if (level >= 30) return { name: 'Skilled',   emoji: '🔥' };
  if (level >= 15) return { name: 'Adept',     emoji: '⭐' };
  return                   { name: 'Novice',    emoji: '🌱' };
}
