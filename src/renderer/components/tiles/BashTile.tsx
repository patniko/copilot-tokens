import { useState } from 'react';
import { motion } from 'motion/react';

interface BashTileProps {
  command: string;
  output?: string;
}

export default function BashTile({ command, output }: BashTileProps) {
  const lines = output ? output.split('\n') : [];
  const isLong = lines.length > 5;
  const [expanded, setExpanded] = useState(false);
  const visibleLines = expanded ? lines : lines.slice(0, 5);

  return (
    <div
      className="glass-card w-full p-4"
      style={{ borderLeft: '4px solid var(--accent-green)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--accent-green)' }}>●</span>
        <span
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: 'var(--accent-green)' }}
        >
          bash
        </span>
      </div>

      {/* Command */}
      <div
        className="font-mono text-sm mb-2"
        style={{ color: 'var(--accent-green)' }}
      >
        $ {command}
      </div>

      {/* Output */}
      {lines.length > 0 && (
        <motion.div
          className="font-mono text-xs mt-2"
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
    </div>
  );
}
