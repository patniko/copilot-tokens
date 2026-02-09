import { renderInline } from '../../lib/render-inline';
import type { TileProps } from '../../lib/tile-registry';

export default function SubagentTile({ data, isRunning, success, error }: TileProps) {
  const displayName = String(data.displayName ?? data.name ?? 'Sub-agent');
  const description = String(data.description ?? '');
  const completed = Boolean(data.completed);
  const agentSuccess = data.success !== undefined ? Boolean(data.success) : success;

  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-blue)';

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{
        borderLeft: `4px solid ${borderColor}`,
        marginLeft: '12px',
        backgroundColor: 'rgba(0,0,0,0.15)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 min-w-0">
        {isRunning && !completed ? (
          <span style={{ animation: 'spin-icon 1s linear infinite', display: 'inline-block' }}>🤖</span>
        ) : completed && agentSuccess === false ? (
          <span style={{ color: 'var(--accent-red)' }}>✗</span>
        ) : completed ? (
          <span style={{ color: 'var(--accent-green)' }}>✓</span>
        ) : (
          <span>🤖</span>
        )}
        <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {renderInline(displayName)}
        </span>
        {isRunning && !completed && (
          <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
            running…
          </span>
        )}
      </div>

      {/* Description */}
      {description !== '' && (
        <div className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {renderInline(description)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs font-mono mt-1" style={{ color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* Agent error from data */}
      {data.error != null && !error && (
        <div className="text-xs font-mono mt-1" style={{ color: 'var(--accent-red)' }}>
          {String(data.error)}
        </div>
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
