import { useState } from 'react';
import { motion } from 'motion/react';

interface FileEditTileProps {
  path: string;
  diff?: string;
  isRunning?: boolean;
}

function friendlyPath(p: string): { name: string; dir: string } {
  const parts = p.replace(/\\/g, '/').split('/');
  const name = parts.pop() || p;
  const dir = parts.slice(-2).join('/');
  return { name, dir };
}

function parseDiffStats(diff: string) {
  const lines = diff.split('\n');
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.startsWith('+')) added++;
    else if (line.startsWith('-')) removed++;
  }
  return { added, removed, lines };
}

export default function FileEditTile({ path, diff, isRunning }: FileEditTileProps) {
  const parsed = diff ? parseDiffStats(diff) : null;
  const isLong = parsed ? parsed.lines.length > 10 : false;
  const [expanded, setExpanded] = useState(false);
  const visibleLines = parsed
    ? expanded
      ? parsed.lines
      : parsed.lines.slice(0, 10)
    : [];
  const { name, dir } = friendlyPath(path);

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{ borderLeft: '4px solid var(--accent-blue)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 min-w-0" title={path}>
        {isRunning ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ display: 'inline-block' }}
          >
            📄
          </motion.span>
        ) : (
          <motion.span
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ display: 'inline-block' }}
          >
            📄
          </motion.span>
        )}
        <span className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>
          {name}
        </span>
        {dir && (
          <span className="text-xs text-[var(--text-secondary)] truncate shrink">
            {dir}
          </span>
        )}
        {isRunning && (
          <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>editing…</span>
        )}
      </div>

      {/* Stats */}
      {parsed && (
        <div className="text-xs mb-2 flex gap-3">
          <span style={{ color: 'var(--accent-green)' }}>+{parsed.added}</span>
          <span style={{ color: 'var(--accent-red)' }}>-{parsed.removed}</span>
          <span style={{ color: 'var(--text-secondary)' }}>lines</span>
        </div>
      )}

      {/* Diff */}
      {visibleLines.length > 0 && (
        <pre
          className="text-xs font-mono overflow-x-auto rounded-lg p-3 mt-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          {visibleLines.map((line, i) => {
            let color = 'var(--text-secondary)';
            let bg = 'transparent';
            if (line.startsWith('+')) {
              color = 'var(--accent-green)';
              bg = 'rgba(63,185,80,0.1)';
            } else if (line.startsWith('-')) {
              color = 'var(--accent-red)';
              bg = 'rgba(248,81,73,0.1)';
            }
            return (
              <div key={i} style={{ color, backgroundColor: bg }}>
                {line}
              </div>
            );
          })}
        </pre>
      )}

      {/* Expand/Collapse */}
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs cursor-pointer"
          style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
        >
          {expanded ? 'Collapse diff' : `Show full diff (${parsed!.lines.length} lines)`}
        </button>
      )}
    </div>
  );
}
