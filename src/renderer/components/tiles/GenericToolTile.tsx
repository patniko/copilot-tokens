import { useState } from 'react';

interface GenericToolTileProps {
  title: string;
  data: Record<string, unknown>;
  isRunning?: boolean;
  success?: boolean;
  error?: string;
  progress?: string;
}

export default function GenericToolTile({ title, data, isRunning, success, error, progress }: GenericToolTileProps) {
  const [expanded, setExpanded] = useState(false);

  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-gold)';

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 min-w-0">
        {isRunning ? (
          <span style={{ animation: 'spin-icon 1s linear infinite', display: 'inline-block' }}>⚙️</span>
        ) : success === false || error ? (
          <span style={{ color: 'var(--accent-red)' }}>✗</span>
        ) : success === true ? (
          <span style={{ color: 'var(--accent-green)' }}>✓</span>
        ) : (
          <span>⚙️</span>
        )}
        <span
          className="text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </span>
      </div>

      {/* Progress */}
      {progress && (
        <div className="text-xs italic mb-2" style={{ color: 'var(--text-secondary)' }}>
          {progress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs mb-2 font-mono" style={{ color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs cursor-pointer mb-2"
        style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
      >
        {expanded ? 'Hide data' : 'Show data'}
      </button>

      {/* JSON Data */}
      {expanded && (
        <pre
          className="text-xs font-mono overflow-x-auto rounded-lg p-3"
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: 'var(--text-secondary)',
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}

      <style>{`
        @keyframes spin-icon {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
