import { useState } from 'react';
import { renderInline } from '../../lib/render-inline';

interface GenericToolTileProps {
  title: string;
  data: Record<string, unknown>;
  isRunning?: boolean;
  success?: boolean;
  error?: string;
  progress?: string;
}

/** Fields that are internal / not useful to display in summary */
const SKIP_FIELDS = new Set(['completed', 'success', '_toolName', 'error', 'progress']);

function summarizeData(data: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (SKIP_FIELDS.has(k)) continue;
    if (v === null || v === undefined || v === '' || v === false) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
    // Truncate long values
    const display = val.length > 120 ? val.slice(0, 117) + '…' : val;
    lines.push(`${k}: ${display}`);
  }
  return lines;
}

export default function GenericToolTile({ title, data, isRunning, success, error, progress }: GenericToolTileProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeData(data);

  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-gold)';

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 min-w-0">
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
          className="text-sm font-bold truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {renderInline(title)}
        </span>
      </div>

      {/* Progress */}
      {progress && (
        <div className="text-xs italic mb-2" style={{ color: 'var(--text-secondary)' }}>
          {progress}
        </div>
      )}

      {/* Summary lines */}
      {summary.length > 0 && !expanded && (
        <div className="text-xs font-mono mb-1 space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
          {summary.slice(0, 3).map((line, i) => (
            <div key={i} className="truncate">{renderInline(line)}</div>
          ))}
          {summary.length > 3 && (
            <div className="text-[var(--text-secondary)] opacity-60">…and {summary.length - 3} more</div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs mb-2 font-mono" style={{ color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* Toggle full JSON */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs cursor-pointer"
        style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
      >
        {expanded ? 'Hide details' : 'Show full data'}
      </button>

      {/* JSON Data */}
      {expanded && (
        <pre
          className="text-xs font-mono overflow-x-auto rounded-lg p-3 mt-2"
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
