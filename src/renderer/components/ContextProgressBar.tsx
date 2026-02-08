import { motion } from 'motion/react';

interface ContextProgressBarProps {
  usedTokens: number;
  maxTokens?: number;
}

const DEFAULT_MAX_TOKENS = 1_000_000; // gpt-4.1 context window

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function getBarColor(pct: number): string {
  if (pct >= 0.9) return 'var(--accent-red)';
  if (pct >= 0.7) return 'var(--accent-gold)';
  return 'var(--accent-green)';
}

function getGlow(pct: number): string {
  if (pct >= 0.9) return '0 0 8px var(--accent-red)';
  if (pct >= 0.7) return '0 0 6px var(--accent-gold)';
  return 'none';
}

export default function ContextProgressBar({
  usedTokens,
  maxTokens = DEFAULT_MAX_TOKENS,
}: ContextProgressBarProps) {
  const pct = Math.min(usedTokens / maxTokens, 1);
  const color = getBarColor(pct);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
        <span>Context Used</span>
        <span style={{ color }}>
          {formatTokenCount(usedTokens)} / {formatTokenCount(maxTokens)}
        </span>
      </div>
      <div
        className="relative h-3 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          style={{ backgroundColor: color, boxShadow: getGlow(pct) }}
        />
        {/* Tick marks at 25%, 50%, 75% */}
        {[0.25, 0.5, 0.75].map((tick) => (
          <div
            key={tick}
            className="absolute inset-y-0 w-px"
            style={{ left: `${tick * 100}%`, background: 'rgba(255,255,255,0.15)' }}
          />
        ))}
      </div>
      <div className="text-[10px] text-right tabular-nums" style={{ color }}>
        {(pct * 100).toFixed(1)}%
      </div>
    </div>
  );
}
