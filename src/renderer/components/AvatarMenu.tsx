import { useState, useCallback, useRef, useEffect } from 'react';
import type { GitHubUser, AuthSource } from '../../main/auth-service';

interface AvatarMenuProps {
  onOpenSettings: () => void;
  onOpenAchievements: (tab: 'stats' | 'trophies') => void;
  onOpenPackStudio: () => void;
}

export default function AvatarMenu({ onOpenSettings, onOpenAchievements, onOpenPackStudio }: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const [cliUser, setCliUser] = useState<GitHubUser | null>(null);
  const [oauthUser, setOauthUser] = useState<GitHubUser | null>(null);
  const [activeSource, setActiveSource] = useState<AuthSource>('cli');
  const [deviceFlow, setDeviceFlow] = useState<{ userCode: string; verificationUri: string } | null>(null);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load accounts on mount
  useEffect(() => {
    window.authAPI?.getCliUser().then(setCliUser);
    window.authAPI?.getOAuthUser().then(setOauthUser);
    window.authAPI?.getActiveSource().then(setActiveSource);
  }, []);

  const activeUser = activeSource === 'oauth' && oauthUser ? oauthUser : cliUser;
  const inactiveUser = activeSource === 'oauth' ? cliUser : oauthUser;
  const inactiveSource: AuthSource = activeSource === 'oauth' ? 'cli' : 'oauth';

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSwitch = useCallback(async (source: AuthSource) => {
    await window.authAPI?.setActiveSource(source);
    setActiveSource(source);
    setOpen(false);
  }, []);

  const handleStartOAuth = useCallback(async () => {
    try {
      const resp = await window.authAPI?.startOAuth();
      if (!resp) return;
      setDeviceFlow(resp);
      setPolling(true);
      // Poll in background
      const user = await window.authAPI?.pollOAuth();
      if (user) {
        setOauthUser(user);
        setActiveSource('oauth');
      }
    } catch (err) {
      console.error('OAuth flow failed:', err);
    } finally {
      setDeviceFlow(null);
      setPolling(false);
    }
  }, []);

  const handleLogoutOAuth = useCallback(async () => {
    await window.authAPI?.logoutOAuth();
    setOauthUser(null);
    setActiveSource('cli');
    setOpen(false);
  }, []);

  const handleCopyCode = useCallback(() => {
    if (!deviceFlow) return;
    navigator.clipboard.writeText(deviceFlow.userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [deviceFlow]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-[var(--border-color)] hover:border-[var(--accent-gold)] transition-colors cursor-pointer flex items-center justify-center bg-[var(--bg-primary)]"
        title={activeUser ? `${activeUser.login}` : 'Account'}
      >
        {activeUser?.avatarUrl ? (
          <img src={activeUser.avatarUrl} alt={activeUser.login} className="w-full h-full object-cover" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" className="text-[var(--text-secondary)]">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.78 5.97a2.22 2.22 0 1 0 4.44 0 2.22 2.22 0 0 0-4.44 0ZM8 12.5c-1.94 0-3.64-.97-4.66-2.44A6.98 6.98 0 0 1 8 8.5c1.94 0 3.64.56 4.66 1.56A5.97 5.97 0 0 1 8 12.5Z" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {open && !deviceFlow && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bottom-full mb-2 z-50 w-72 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden">
            {/* Active account */}
            {activeUser && (
              <div className="px-4 py-3 flex items-center gap-3 border-b border-[var(--border-color)]">
                <img
                  src={activeUser.avatarUrl}
                  alt={activeUser.login}
                  className="w-10 h-10 rounded-full shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {activeUser.name || activeUser.login}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate flex items-center gap-1">
                    @{activeUser.login}
                    <span className="inline-block px-1.5 py-0 rounded text-[9px] uppercase tracking-wider bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                      {activeSource === 'cli' ? 'CLI' : 'OAuth'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Switch account (if other account exists) */}
            {inactiveUser && (
              <button
                onClick={() => handleSwitch(inactiveSource)}
                className="w-full px-4 py-2 text-left text-xs flex items-center gap-3 hover:bg-[var(--bg-primary)] transition-colors cursor-pointer border-b border-[var(--border-color)]"
              >
                <img
                  src={inactiveUser.avatarUrl}
                  alt={inactiveUser.login}
                  className="w-6 h-6 rounded-full shrink-0 opacity-70"
                />
                <span className="text-[var(--text-secondary)]">
                  Switch to <span className="text-[var(--text-primary)]">@{inactiveUser.login}</span>
                  <span className="ml-1 text-[9px] uppercase opacity-60">({inactiveSource})</span>
                </span>
              </button>
            )}

            {/* Sign in as different user */}
            {!oauthUser && (
              <button
                onClick={() => { setOpen(false); handleStartOAuth(); }}
                className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-2 border-b border-[var(--border-color)]"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8A1.5 1.5 0 0 0 3 12.5Zm6.56 4.5 1.97-1.97a.749.749 0 1 0-1.06-1.06L7.97 5.47a.75.75 0 0 0 0 1.06l1.5 1.5a.749.749 0 1 0 1.06-1.06L8.56 7Z"/></svg>
                Sign in as a different user
              </button>
            )}

            {/* Sign out of OAuth */}
            {oauthUser && (
              <button
                onClick={handleLogoutOAuth}
                className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--accent-red,#f85149)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-3 border-b border-[var(--border-color)]"
              >
                <img
                  src={oauthUser.avatarUrl}
                  alt={oauthUser.login}
                  className="w-6 h-6 rounded-full shrink-0 opacity-70"
                />
                <span>
                  Sign out <span className="font-medium text-[var(--text-primary)]">@{oauthUser.login}</span>
                  <span className="ml-1 text-[9px] uppercase opacity-60">(OAuth)</span>
                </span>
              </button>
            )}

            {/* Divider + Personalization/Settings/Leaderboard */}
            <button
              onClick={() => { setOpen(false); onOpenPackStudio(); }}
              className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>🎨</span> Personalization
            </button>
            <button
              onClick={() => { setOpen(false); onOpenAchievements('stats'); }}
              className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>🏆</span> Achievements
            </button>
            <button
              onClick={() => { setOpen(false); onOpenSettings(); }}
              className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>⚙️</span> Settings
            </button>
          </div>
        </>
      )}

      {/* Device Flow Modal */}
      {deviceFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-6 w-96 text-center">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Sign in with GitHub</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Enter this code at <span className="text-[var(--accent-blue)]">{deviceFlow.verificationUri}</span>
            </p>
            <button
              onClick={handleCopyCode}
              className="inline-block bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-6 py-3 text-2xl font-mono font-bold tracking-[0.3em] text-[var(--accent-gold)] mb-4 cursor-pointer hover:border-[var(--accent-gold)] transition-colors"
              title="Click to copy"
            >
              {deviceFlow.userCode}
            </button>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              {copied ? '✓ Copied!' : 'Click the code to copy'}
            </p>
            {polling && (
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                <span className="animate-spin">⏳</span> Waiting for authorization…
              </div>
            )}
            <button
              onClick={() => { setDeviceFlow(null); setPolling(false); }}
              className="mt-4 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
