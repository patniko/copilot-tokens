import { useState, useEffect, useRef } from 'react';

interface CwdDropdownProps {
  cwd: string;
  gitBranch: string | null;
  onBrowse: () => void;
  onSelectRecent: (dir: string) => void;
}

export default function CwdDropdown({ cwd, gitBranch, onBrowse, onSelectRecent }: CwdDropdownProps) {
  const [open, setOpen] = useState(false);
  const [recentCwds, setRecentCwds] = useState<string[]>([]);
  const [permRules, setPermRules] = useState<{ kind: string; pathPrefix: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    window.cwdAPI?.getRecent().then(setRecentCwds);
    window.copilotAPI?.getPermissionRules().then(setPermRules);
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 font-mono text-[var(--text-primary)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer truncate max-w-[600px]"
        title={cwd || 'Click to set working directory'}
      >
        <span className={!cwd ? 'text-red-500' : 'text-[var(--text-secondary)]'}>{!cwd ? '⚠️' : '📂'}</span>
        <span className="truncate">{cwd || '(no working directory set)'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="shrink-0 text-[var(--text-secondary)]">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {gitBranch && (
        <>
          <span className="text-[var(--border-color)] ml-1.5">|</span>
          <span className="text-[var(--accent-green)] flex items-center gap-1 ml-1.5">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>
            {gitBranch}
          </span>
        </>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-96 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden">
          {/* Current + Browse */}
          <div className="px-3 py-2.5 border-b border-[var(--border-color)] flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Working Directory</div>
              <div className="text-xs font-mono text-[var(--text-primary)] truncate">{cwd || '(not set)'}</div>
            </div>
            <button
              onClick={() => { setOpen(false); onBrowse(); }}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer shrink-0"
            >
              Browse…
            </button>
          </div>

          {/* Recent directories */}
          {recentCwds.length > 0 && (
            <div className="border-b border-[var(--border-color)]">
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Recent</div>
              {recentCwds.slice(0, 5).map((dir) => (
                <button
                  key={dir}
                  onClick={() => { setOpen(false); onSelectRecent(dir); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-mono truncate transition-colors cursor-pointer ${
                    dir === cwd
                      ? 'text-[var(--accent-gold)] bg-[var(--accent-gold)]/5'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                  }`}
                  title={dir}
                >
                  {dir === cwd ? '✓ ' : ''}{dir}
                </button>
              ))}
            </div>
          )}

          {/* Permission Rules */}
          <div>
            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Permission Rules</div>
            {permRules.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                No saved rules yet
              </div>
            ) : (
              <>
                {permRules.map((rule, i) => (
                  <div key={`${rule.kind}-${rule.pathPrefix}-${i}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-primary)] transition-colors">
                    <span className="text-[10px] font-bold uppercase w-10 shrink-0" style={{
                      color: rule.kind === 'shell' ? 'var(--accent-red)' :
                             rule.kind === 'write' ? 'var(--accent-gold)' :
                             'var(--accent-blue)'
                    }}>
                      {rule.kind}
                    </span>
                    <span className="flex-1 text-[11px] font-mono truncate text-[var(--text-secondary)]" title={rule.pathPrefix}>
                      {rule.pathPrefix}
                    </span>
                    <button
                      onClick={async () => {
                        await window.copilotAPI?.removePermissionRule(i);
                        setPermRules(prev => prev.filter((_, idx) => idx !== i));
                      }}
                      className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors cursor-pointer shrink-0"
                      title="Remove rule"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="px-3 py-1.5">
                  <button
                    onClick={async () => {
                      await window.copilotAPI?.clearPermissionRules();
                      setPermRules([]);
                    }}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors cursor-pointer"
                  >
                    Clear all rules
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
