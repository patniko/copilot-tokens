import { useState } from 'react';
import { renderInline } from '../../lib/render-inline';
import type { TileProps } from '../../lib/tile-registry';

function extractUrl(data: Record<string, unknown>): string {
  return String(data.url ?? '');
}

function extractContent(data: Record<string, unknown>): string {
  return String(data.result ?? data.content ?? data.output ?? '');
}

function friendlyDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function WebFetchTile({ title: _title, data, isRunning, success, error }: TileProps) {
  const url = extractUrl(data);
  const content = extractContent(data);
  const domain = friendlyDomain(url);
  const lines = content ? content.split('\n') : [];
  const isTruncated = lines.length > 12;
  const [expanded, setExpanded] = useState(false);
  const visibleLines = expanded ? lines : lines.slice(0, 12);

  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-cyan, var(--accent-blue))';

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 min-w-0">
        {isRunning ? (
          <span style={{ animation: 'pulse-dot 1.5s ease-in-out infinite', color: 'var(--accent-blue)' }}>●</span>
        ) : success === false || error ? (
          <span style={{ color: 'var(--accent-red)' }}>✗</span>
        ) : (
          <span>🌐</span>
        )}
        <span className="text-xs font-medium text-[var(--text-secondary)]">{domain}</span>
      </div>

      {/* URL */}
      <a
        href={url}
        title={url}
        className="text-xs font-mono text-[var(--accent-blue)] hover:underline truncate block mb-2"
        style={{ cursor: 'default' }}
      >
        {url}
      </a>

      {/* Loading state */}
      {isRunning && !content && (
        <div className="text-xs italic text-[var(--text-secondary)]">Fetching…</div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs font-mono mt-1" style={{ color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* Content */}
      {content && (
        <div
          className="text-xs leading-relaxed mt-1 overflow-x-auto rounded-md px-3 py-2"
          style={{
            backgroundColor: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {visibleLines.map((line, i) => (
            <div key={i}>{renderInline(line)}</div>
          ))}
        </div>
      )}

      {/* Expand / collapse */}
      {isTruncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs cursor-pointer"
          style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
        >
          {expanded ? 'Show less' : `Show more (${lines.length - 12} more lines)`}
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
