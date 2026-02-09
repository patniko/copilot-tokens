import { useState } from 'react';
import { renderInline } from '../../lib/render-inline';
import type { TileProps } from '../../lib/tile-registry';

export default function SkillTile({ data, isRunning, error }: TileProps) {
  const name = String(data.name ?? 'Skill');
  const content = String(data.content ?? '');
  const allowedTools = Array.isArray(data.allowedTools) ? (data.allowedTools as string[]) : [];
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
          <span style={{ animation: 'spin-icon 1s linear infinite', display: 'inline-block' }}>🎯</span>
        ) : (
          <span>🎯</span>
        )}
        <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {renderInline(name)}
        </span>
      </div>

      {/* Allowed tools badges */}
      {allowedTools.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {allowedTools.map((tool, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                color: 'var(--accent-purple, #a855f7)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
              }}
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs font-mono mt-1" style={{ color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* Collapsible content */}
      {content && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs cursor-pointer"
            style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
          >
            {expanded ? 'Hide content' : 'Show content'}
          </button>
          {expanded && (
            <pre
              className="text-xs font-mono overflow-x-auto rounded-lg p-3 mt-2"
              style={{
                backgroundColor: 'rgba(0,0,0,0.3)',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {content}
            </pre>
          )}
        </>
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
