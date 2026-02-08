import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  type LevelProgress,
  type LevelCategory,
  LEVEL_CATEGORIES,
  CATEGORY_LABELS,
  getThresholds,
  getCategoryCompletion,
  getLevelTier,
  MAX_LEVEL,
} from '../lib/level-system';
import type { LevelProgressData } from '../../main/stats-service';

interface LevelBadgeProps {
  /** Compact mode shows just the level number + tier emoji in the header. */
  compact?: boolean;
}

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};

export default function LevelBadge({ compact }: LevelBadgeProps) {
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    window.statsAPI?.getLevelProgress().then((p) => {
      setProgress(p as LevelProgress);
    });

    // Refresh when level changes (party-bus would be ideal but simple polling works)
    const interval = setInterval(() => {
      window.statsAPI?.getLevelProgress().then((p) => setProgress(p as LevelProgress));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!progress) return null;

  const tier = getLevelTier(progress.level);
  const completions = getCategoryCompletion(progress);
  const thresholds = getThresholds(progress.level).thresholds;
  const minCompletion = Math.min(...LEVEL_CATEGORIES.map((c) => completions[c]));

  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-gold)] transition-colors cursor-pointer text-xs"
        title={`Level ${progress.level} — ${tier.name}`}
      >
        <span>{tier.emoji}</span>
        <span className="font-bold text-[var(--accent-gold)] led-text">
          Lv.{progress.level}
        </span>

        {/* Mini progress ring */}
        <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--border-color)" strokeWidth="2" />
          <circle
            cx="8" cy="8" r="6" fill="none"
            stroke="var(--accent-gold)"
            strokeWidth="2"
            strokeDasharray={`${minCompletion * 37.7} 37.7`}
            strokeLinecap="round"
            transform="rotate(-90 8 8)"
          />
        </svg>

        {/* Expanded dropdown */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              className="absolute top-full right-0 mt-2 w-72 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 shadow-xl z-50"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <LevelDetail progress={progress} tier={tier} completions={completions} thresholds={thresholds} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  // Full mode
  return (
    <div className="glass-card p-4">
      <LevelDetail progress={progress} tier={tier} completions={completions} thresholds={thresholds} />
    </div>
  );
}

function LevelDetail({
  progress,
  tier,
  completions,
  thresholds,
}: {
  progress: LevelProgress;
  tier: { name: string; emoji: string };
  completions: Record<LevelCategory, number>;
  thresholds: Record<LevelCategory, number>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{tier.emoji}</span>
          <div>
            <div className="text-sm font-bold text-[var(--accent-gold)] led-text">
              Level {progress.level}
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              {tier.name}
            </div>
          </div>
        </div>
        {progress.level < MAX_LEVEL && (
          <div className="text-[10px] text-[var(--text-secondary)]">
            → Lv.{progress.level + 1}
          </div>
        )}
        {progress.level >= MAX_LEVEL && (
          <div className="text-[10px] text-[var(--accent-gold)] font-bold">
            MAX ✨
          </div>
        )}
      </div>

      {/* Category bars */}
      <div className="flex flex-col gap-2">
        {LEVEL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_LABELS[cat];
          const pct = completions[cat];
          const current = progress.categoryProgress[cat];
          const threshold = thresholds[cat];
          const complete = pct >= 1;
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className="w-4 text-center text-xs" title={meta.label}>{meta.emoji}</span>
              <div className="flex-1">
                <div className="flex justify-between text-[9px] mb-0.5">
                  <span className={complete ? 'text-[var(--accent-gold)] font-bold' : 'text-[var(--text-secondary)]'}>
                    {meta.label}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {formatNumber(current)} / {formatNumber(threshold)}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      complete
                        ? 'bg-[var(--accent-gold)]'
                        : 'bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-cyan)]'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, pct * 100)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
              {complete && <span className="text-[10px]">✅</span>}
            </div>
          );
        })}
      </div>

      {/* Hint */}
      {progress.level < MAX_LEVEL && (
        <div className="text-[9px] text-[var(--text-secondary)] text-center italic">
          Fill all bars to reach Level {progress.level + 1}
        </div>
      )}
    </div>
  );
}
