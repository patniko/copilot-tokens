import { useState } from 'react';
import { renderInline } from '../../lib/render-inline';
import type { TileProps } from '../../lib/tile-registry';

export default function MemoryTile({ data, isRunning, error }: TileProps) {
  const fact = String(data.fact ?? '');
  const category = String(data.category ?? '');
  const subject = String(data.subject ?? '');
  const citations = String(data.citations ?? '');
  const reason = String(data.reason ?? '');
  const [expanded, setExpanded] = useState(false);

  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-purple, #a855f7)';

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 min-w-0">
        {isRunning ? (
          <span style={{ animation: 'pulse-dot 1.5s ease-in-out infinite', color: 'var(--accent-purple, #a855f7)' }}>●</span>
        ) : (
          <span>🧠</span>
        )}
        <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          Memory stored
        </span>
      </div>

      {/* Fact */}
      {fact && (
        <div
          className="text-sm mb-2 leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
        >
          {renderInline(fact)}
        </div>
      )}

      {/* Category badge + subject */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {category && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: 'rgba(168, 85, 247, 0.2)',
              color: 'var(--accent-purple, #a855f7)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
            }}
          >
            {category}
          </span>
        )}
        {subject && (
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {subject}
          </span>
        )}
      </div>

      {/* Citations */}
      {citations && (
        <pre
          className="text-xs font-mono overflow-x-auto rounded-md px-3 py-2 mb-2"
          style={{
            backgroundColor: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {citations}
        </pre>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs font-mono mt-1" style={{ color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* Collapsible reason */}
      {reason && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs cursor-pointer"
            style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
          >
            {expanded ? 'Hide reason' : 'Show reason'}
          </button>
          {expanded && (
            <div
              className="text-xs mt-2 leading-relaxed rounded-md px-3 py-2"
              style={{
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'var(--text-secondary)',
              }}
            >
              {renderInline(reason)}
            </div>
          )}
        </>
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
