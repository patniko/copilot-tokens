import { useState } from 'react';
import { motion } from 'motion/react';

interface FileReadTileProps {
  path: string;
  content?: string;
  isRunning?: boolean;
}

export default function FileReadTile({ path, content, isRunning }: FileReadTileProps) {
  const lines = content ? content.split('\n') : [];
  const isTruncated = lines.length > 10;
  const [expanded, setExpanded] = useState(false);
  const visibleLines = expanded ? lines : lines.slice(0, 10);

  return (
    <div
      className="glass-card w-full p-4"
      style={{ borderLeft: '4px solid var(--accent-purple)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span>👁</span>
        <span
          className="text-sm font-mono truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {path}
        </span>
        {isRunning && (
          <span className="text-xs italic" style={{ color: 'var(--text-secondary)', animation: 'pulse-dot 1.5s ease-in-out infinite' }}>
            reading…
          </span>
        )}
      </div>

      {/* Content */}
      {content && (
        <motion.pre
          className="text-xs font-mono overflow-x-auto rounded-lg p-3"
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: 'var(--text-secondary)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {visibleLines.join('\n')}
        </motion.pre>
      )}

      {/* Show more */}
      {isTruncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs cursor-pointer"
          style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
        >
          {expanded ? 'Show less' : `Show more (${lines.length - 10} more lines)`}
        </button>
      )}
    </div>
  );
}
