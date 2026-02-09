import { Fragment } from 'react';
import { renderInline } from '../../lib/render-inline';
import type { TileProps } from '../../lib/tile-registry';

/* ── helpers ─────────────────────────────────────────────── */

function str(v: unknown): string {
  return String(v ?? '');
}

function truncate(s: string, max = 120): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function StatusIcon({ isRunning, success, error, icon }: { icon: string; isRunning: boolean; success?: boolean; error?: string }) {
  if (isRunning) return <span style={{ animation: 'pulse-dot 1.5s ease-in-out infinite', color: 'var(--accent-blue)' }}>●</span>;
  if (success === false || error) return <span style={{ color: 'var(--accent-red)' }}>✗</span>;
  return <span>{icon}</span>;
}

function ErrorBlock({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="text-xs font-mono mt-1" style={{ color: 'var(--accent-red)' }}>{error}</div>;
}

/* ── NotificationTile ────────────────────────────────────── */

export function NotificationTile({ data, isRunning, success, error }: TileProps) {
  const notifTitle = str(data.title);
  const body = str(data.body ?? data.message ?? '');
  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-green)';

  return (
    <div className="glass-card w-full p-4 overflow-hidden" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <StatusIcon icon="🔔" isRunning={isRunning} success={success} error={error} />
        <span className="text-xs font-medium text-[var(--text-secondary)]">Notification</span>
      </div>
      {notifTitle && <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{notifTitle}</div>}
      {body && <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{renderInline(body)}</div>}
      {isRunning && !notifTitle && <div className="text-xs italic text-[var(--text-secondary)]">Sending…</div>}
      <ErrorBlock error={error} />
    </div>
  );
}

/* ── ClipboardTile ───────────────────────────────────────── */

export function ClipboardTile({ data, isRunning, success, error }: TileProps) {
  const content = str(data.content ?? data.text ?? data.result ?? '');
  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-blue)';

  return (
    <div className="glass-card w-full p-4 overflow-hidden" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <StatusIcon icon="📋" isRunning={isRunning} success={success} error={error} />
        <span className="text-xs font-medium text-[var(--text-secondary)]">Clipboard</span>
      </div>
      {content && (
        <div
          className="text-xs font-mono leading-relaxed mt-1 overflow-x-auto rounded-md px-3 py-2"
          style={{
            backgroundColor: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {truncate(content, 300)}
        </div>
      )}
      {isRunning && !content && <div className="text-xs italic text-[var(--text-secondary)]">Accessing clipboard…</div>}
      <ErrorBlock error={error} />
    </div>
  );
}

/* ── SystemInfoTile ──────────────────────────────────────── */

export function SystemInfoTile({ data, isRunning, success, error }: TileProps) {
  const info = (data.result ?? data.info ?? data) as Record<string, unknown>;
  const entries = Object.entries(info).filter(([k]) => !['result', 'info'].includes(k) || Object.keys(info).length <= 2);
  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-blue)';

  return (
    <div className="glass-card w-full p-4 overflow-hidden" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <StatusIcon icon="💻" isRunning={isRunning} success={success} error={error} />
        <span className="text-xs font-medium text-[var(--text-secondary)]">System Info</span>
      </div>
      {entries.length > 0 && (
        <div
          className="grid gap-x-4 gap-y-1 mt-1 text-xs"
          style={{ gridTemplateColumns: 'auto 1fr' }}
        >
          {entries.map(([key, val]) => (
            <Fragment key={key}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{key}</span>
              <span className="font-mono truncate" style={{ color: 'var(--text-primary)' }}>{str(val)}</span>
            </Fragment>
          ))}
        </div>
      )}
      {isRunning && entries.length === 0 && <div className="text-xs italic text-[var(--text-secondary)]">Gathering info…</div>}
      <ErrorBlock error={error} />
    </div>
  );
}

/* ── OpenUrlTile ─────────────────────────────────────────── */

export function OpenUrlTile({ data, isRunning, success, error }: TileProps) {
  const url = str(data.url);
  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-blue)';

  return (
    <div className="glass-card w-full p-4 overflow-hidden" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <StatusIcon icon="🔗" isRunning={isRunning} success={success} error={error} />
        <span className="text-xs font-medium text-[var(--text-secondary)]">Open URL</span>
      </div>
      {url && (
        <a
          href={url}
          title={url}
          className="text-xs font-mono text-[var(--accent-blue)] hover:underline truncate block"
          style={{ cursor: 'default' }}
        >
          {url}
        </a>
      )}
      {isRunning && !url && <div className="text-xs italic text-[var(--text-secondary)]">Opening…</div>}
      <ErrorBlock error={error} />
    </div>
  );
}

/* ── SoundTile ───────────────────────────────────────────── */

export function SoundTile({ data, isRunning, success, error }: TileProps) {
  const sound = str(data.sound ?? data.name ?? data.file ?? '');
  const borderColor = error ? 'var(--accent-red)' : 'var(--accent-green)';

  return (
    <div className="glass-card w-full p-4 overflow-hidden" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <StatusIcon icon="🔊" isRunning={isRunning} success={success} error={error} />
        <span className="text-xs font-medium text-[var(--text-secondary)]">Sound</span>
      </div>
      {sound && <div className="text-xs" style={{ color: 'var(--text-primary)' }}>{sound}</div>}
      {isRunning && !sound && <div className="text-xs italic text-[var(--text-secondary)]">Playing…</div>}
      <ErrorBlock error={error} />
    </div>
  );
}
