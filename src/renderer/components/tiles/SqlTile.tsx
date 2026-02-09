import { useState } from 'react';
import { renderInline } from '../../lib/render-inline';
import type { TileProps } from '../../lib/tile-registry';

function parseTableRows(text: string): string[][] {
  return text
    .split('\n')
    .filter((l) => l.trim() && !l.trim().match(/^[-|+]+$/))
    .map((l) =>
      l
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean),
    );
}

export default function SqlTile({ data, isRunning, success, error }: TileProps) {
  const query = String(data.query ?? '');
  const result = String(data.result ?? '');
  const description = String(data.description ?? '');
  const [showRaw, setShowRaw] = useState(false);

  const rows = result ? parseTableRows(result) : [];
  const headerRow = rows[0] ?? [];
  const bodyRows = rows.slice(1);

  const borderColor = error || success === false ? 'var(--accent-red)' : 'var(--accent-green)';

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 min-w-0">
        {isRunning ? (
          <span style={{ animation: 'spin-icon 1s linear infinite', display: 'inline-block' }}>💾</span>
        ) : error ? (
          <span style={{ color: 'var(--accent-red)' }}>✗</span>
        ) : (
          <span>💾</span>
        )}
        <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {description || 'SQL Query'}
        </span>
      </div>

      {/* Query */}
      {query && (
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
          {query}
        </pre>
      )}

      {/* Loading */}
      {isRunning && !result && (
        <div className="text-xs italic text-[var(--text-secondary)]">Running query…</div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs font-mono mt-1" style={{ color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* Table */}
      {headerRow.length > 0 && (
        <div className="overflow-x-auto mt-1">
          <table
            className="text-xs font-mono w-full"
            style={{ borderCollapse: 'collapse', color: 'var(--text-secondary)' }}
          >
            <thead>
              <tr>
                {headerRow.map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-2 py-1"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-2 py-1"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Raw output toggle */}
      {result && (
        <>
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="mt-2 text-xs cursor-pointer"
            style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
          >
            {showRaw ? 'Hide raw output' : 'Show raw output'}
          </button>
          {showRaw && (
            <pre
              className="text-xs font-mono overflow-x-auto rounded-lg p-3 mt-2"
              style={{
                backgroundColor: 'rgba(0,0,0,0.3)',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {result}
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
