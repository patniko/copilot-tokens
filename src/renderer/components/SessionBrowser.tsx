import { useState, useEffect } from 'react';

interface StoredSession {
  timestamp: number;
  cwd?: string;
  inputTokens: number;
  outputTokens: number;
  messagesCount: number;
  filesChanged: number;
  toolCalls: number;
  durationMs: number;
}

interface SDKSession {
  sessionId: string;
  startTime: string;
  modifiedTime: string;
  summary?: string;
}

type SessionTab = 'local' | 'sdk';

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function formatISODate(iso: string): string {
  return formatDate(new Date(iso).getTime());
}

function shortenPath(p: string): string {
  const home = '/Users/';
  if (p.startsWith(home)) {
    const rest = p.slice(home.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx !== -1) return '~' + rest.slice(slashIdx);
    return '~';
  }
  return p;
}

export default function SessionBrowser({ onSelect, onClose, onResumeSDK }: {
  onSelect: (session: StoredSession) => void;
  onClose: () => void;
  onResumeSDK?: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [sdkSessions, setSDKSessions] = useState<SDKSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SessionTab>('local');

  useEffect(() => {
    window.statsAPI?.getAllSessions().then((data) => {
      setSessions(data);
      setLoading(false);
    }).catch(() => setLoading(false));
    // Load SDK sessions if available
    if (window.sessionsAPI) {
      window.sessionsAPI.list().then(setSDKSessions).catch(() => {});
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <h2 className="text-sm font-bold tracking-wider text-[var(--accent-gold)] uppercase">
          Sessions
        </h2>
        <button
          onClick={onClose}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-lg"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      {sdkSessions.length > 0 && (
        <div className="flex border-b border-[var(--border-color)]">
          <button
            onClick={() => setTab('local')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              tab === 'local'
                ? 'text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            📂 Saved ({sessions.length})
          </button>
          <button
            onClick={() => setTab('sdk')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              tab === 'sdk'
                ? 'text-[var(--accent-purple)] border-b-2 border-[var(--accent-purple)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            ♾️ Resumable ({sdkSessions.length})
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="text-center text-[var(--text-secondary)] py-12 text-sm">Loading sessions…</div>
        )}

        {tab === 'local' && (
          <>
            {!loading && sessions.length === 0 && (
              <div className="text-center text-[var(--text-secondary)] py-12 text-sm">No past sessions found</div>
            )}
            <div className="flex flex-col gap-2">
              {sessions.map((s) => (
                <button
                  key={s.timestamp}
                  onClick={() => onSelect(s)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-gold)]/50 hover:bg-[var(--accent-gold)]/5 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {formatDate(s.timestamp)}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--accent-gold)] transition-colors">
                      Load →
                    </span>
                  </div>
                  {s.cwd && (
                    <div className="text-[11px] text-[var(--accent-purple)] mb-1.5 truncate font-mono" title={s.cwd}>
                      📂 {shortenPath(s.cwd)}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
                    <span title="Total tokens">🪙 {formatTokens(s.inputTokens + s.outputTokens)}</span>
                    <span title="Messages">💬 {s.messagesCount}</span>
                    <span title="Tool calls">🔧 {s.toolCalls}</span>
                    <span title="Files changed">📄 {s.filesChanged}</span>
                    <span title="Duration">⏱ {formatDuration(s.durationMs)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'sdk' && (
          <>
            {sdkSessions.length === 0 && (
              <div className="text-center text-[var(--text-secondary)] py-12 text-sm">No resumable sessions found</div>
            )}
            <div className="flex flex-col gap-2">
              {sdkSessions.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => onResumeSDK?.(s.sessionId)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-purple)]/50 hover:bg-[var(--accent-purple)]/5 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {formatISODate(s.modifiedTime)}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--accent-purple)] transition-colors">
                      Resume →
                    </span>
                  </div>
                  {s.summary && (
                    <div className="text-[11px] text-[var(--text-secondary)] mb-1 line-clamp-2">
                      {s.summary}
                    </div>
                  )}
                  <div className="text-[10px] text-[var(--text-secondary)] font-mono truncate" title={s.sessionId}>
                    ♾️ {s.sessionId.slice(0, 12)}…
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
