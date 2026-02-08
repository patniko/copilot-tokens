import { useState } from 'react';
import { motion } from 'motion/react';
import { renderInline } from '../../lib/render-inline';

interface BashTileProps {
  command: string;
  output?: string;
  isRunning?: boolean;
  progress?: string;
  success?: boolean;
  error?: string;
}

export default function BashTile({ command, output, isRunning, progress, success, error }: BashTileProps) {
  const lines = output ? output.split('\n') : [];
  const isLong = lines.length > 5;
  const [expanded, setExpanded] = useState(false);
  const visibleLines = expanded ? lines : lines.slice(0, 5);

  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-green)';

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {isRunning ? (
          <span style={{ color: 'var(--accent-green)', animation: 'pulse-dot 1.5s ease-in-out infinite' }}>●</span>
        ) : success === false || error ? (
          <span style={{ color: 'var(--accent-red)' }}>✗</span>
        ) : success === true ? (
          <span style={{ color: 'var(--accent-green)' }}>✓</span>
        ) : (
          <span style={{ color: 'var(--accent-green)' }}>●</span>
        )}
        <span
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: 'var(--accent-green)' }}
        >
          bash
        </span>
      </div>

      {/* Command */}
      <div
        className="font-mono text-sm mb-2 break-all"
        style={{ color: 'var(--accent-green)' }}
      >
        $ {renderInline(command)}
      </div>

      {/* Progress */}
      {progress && (
        <div className="text-xs italic mb-2" style={{ color: 'var(--text-secondary)' }}>
          {progress}
        </div>
      )}

      {/* Output */}
      {lines.length > 0 && (
        <motion.div
          className="font-mono text-xs mt-2 overflow-x-auto"
          style={{ color: 'var(--text-secondary)' }}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.02 } } }}
        >
          {visibleLines.map((line, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, x: -10 },
                visible: { opacity: 1, x: 0 },
              }}
            >
              {line}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs mt-2 font-mono" style={{ color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* Show more/less */}
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs cursor-pointer"
          style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
        >
          {expanded ? 'Show less' : `Show more (${lines.length - 5} more lines)`}
        </button>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
