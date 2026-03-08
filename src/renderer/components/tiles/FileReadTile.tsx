import { useState } from 'react';
import { motion } from 'motion/react';

interface FileReadTileProps {
  path: string;
  content?: string;
  isRunning?: boolean;
}

function friendlyPath(p: string): { name: string; dir: string } {
  const parts = p.replace(/\\/g, '/').split('/');
  const name = parts.pop() || p;
  const dir = parts.slice(-2).join('/');
  return { name, dir };
}

export default function FileReadTile({ path, content, isRunning }: FileReadTileProps) {
  const lines = content ? content.split('\n') : [];
  const [expanded, setExpanded] = useState(false);
  const { name, dir } = friendlyPath(path);

  return (
    <div className="w-full overflow-hidden">
      {/* Compact header row */}
      <button
        onClick={() => content && setExpanded(!expanded)}
        className="flex items-center gap-2 min-w-0 w-full text-left px-3 py-1.5 rounded-md cursor-pointer"
        style={{
          background: 'none',
          border: 'none',
          borderLeft: '3px solid var(--accent-purple)',
        }}
        title={path}
      >
        <span className="text-xs shrink-0">👁</span>
        <span className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>
          {name}
        </span>
        {dir && (
          <span className="text-xs truncate shrink" style={{ color: 'var(--text-secondary)' }}>
            {dir}
          </span>
        )}
        {isRunning ? (
          <span className="text-xs italic shrink-0" style={{ color: 'var(--text-secondary)', animation: 'pulse-dot 1.5s ease-in-out infinite' }}>
            reading…
          </span>
        ) : content ? (
          <span className="text-xs shrink-0 ml-auto" style={{ color: 'var(--text-secondary)' }}>
            {lines.length} lines {expanded ? '▾' : '▸'}
          </span>
        ) : null}
      </button>

      {/* Expandable content */}
      {content && expanded && (
        <motion.pre
          className="text-xs font-mono overflow-x-auto rounded-lg p-3 ml-3 mt-1"
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: 'var(--text-secondary)',
          }}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2 }}
        >
          {lines.join('\n')}
        </motion.pre>
      )}
    </div>
  );
}
