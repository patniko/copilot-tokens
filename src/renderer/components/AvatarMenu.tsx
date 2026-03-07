import { useState, useCallback, useRef, useEffect } from 'react';
import type { GitHubUser } from '../../main/auth-service';
import type { ConnectionProfile } from '../../main/profile-service';

const CONNECTION_LABELS: Record<string, { label: string; badge: string }> = {
  'copilot-cli': { label: 'Copilot CLI', badge: 'CLI' },
  'copilot-remote': { label: 'Remote Server', badge: 'Remote' },
  'anthropic': { label: 'Anthropic', badge: 'Anthropic' },
  'openai': { label: 'OpenAI', badge: 'OpenAI' },
  'azure': { label: 'Azure OpenAI', badge: 'Azure' },
  'custom': { label: 'Custom Provider', badge: 'Custom' },
};

interface AvatarMenuProps {
  onOpenSettings: () => void;
  onOpenAchievements: (tab: 'stats' | 'trophies') => void;
  onOpenPackStudio: () => void;
  demoActive?: boolean;
  onDemoToggle?: () => void;
}

export default function AvatarMenu({ onOpenSettings, onOpenAchievements, onOpenPackStudio, demoActive, onDemoToggle }: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const [cliUser, setCliUser] = useState<GitHubUser | null>(null);
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('default');
  const [deviceFlow, setDeviceFlow] = useState<{ userCode: string; verificationUri: string } | null>(null);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load data on mount
  useEffect(() => {
    window.authAPI?.getCliUser().then(setCliUser);
    window.profilesAPI?.list().then(setProfiles);
    window.profilesAPI?.getActive().then(({ id }) => setActiveProfileId(id));
    // Listen for profile switches from other sources
    const unsub = window.profilesAPI?.onProfileChanged(({ id }) => {
      setActiveProfileId(id);
      window.profilesAPI?.list().then(setProfiles);
    });
    return () => unsub?.();
  }, []);

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0];
  const otherProfiles = profiles.filter(p => p.id !== activeProfileId);
  const isCopilotProfile = activeProfile?.connection.type === 'copilot-cli' || activeProfile?.connection.type === 'copilot-remote';

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSwitchProfile = useCallback(async (id: string) => {
    await window.profilesAPI?.setActive(id);
    setActiveProfileId(id);
    setOpen(false);
  }, []);

  const handleStartOAuth = useCallback(async () => {
    try {
      const resp = await window.authAPI?.startOAuth();
      if (!resp) return;
      setDeviceFlow(resp);
      setPolling(true);
      const user = await window.authAPI?.pollOAuth();
      if (user) {
        setCliUser(user); // refresh display
      }
    } catch (err) {
      console.error('OAuth flow failed:', err);
    } finally {
      setDeviceFlow(null);
      setPolling(false);
    }
  }, []);

  const handleCopyCode = useCallback(() => {
    if (!deviceFlow) return;
    navigator.clipboard.writeText(deviceFlow.userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [deviceFlow]);

  const connInfo = CONNECTION_LABELS[activeProfile?.connection.type ?? ''] ?? { label: 'Unknown', badge: '?' };

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar button — show profile icon or user avatar */}
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-[var(--border-color)] hover:border-[var(--accent-gold)] transition-colors cursor-pointer flex items-center justify-center bg-[var(--bg-primary)]"
        title={activeProfile ? `${activeProfile.name} (${connInfo.label})` : 'Account'}
      >
        {isCopilotProfile && cliUser?.avatarUrl ? (
          <img src={cliUser.avatarUrl} alt={cliUser.login} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg">{activeProfile?.icon ?? '🐙'}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && !deviceFlow && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bottom-full mb-2 z-50 w-80 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden">
            {/* Active profile */}
            {activeProfile && (
              <div className="px-4 py-3 flex items-center gap-3 border-b border-[var(--border-color)]">
                <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--border-color)] text-lg">
                  {isCopilotProfile && cliUser?.avatarUrl ? (
                    <img src={cliUser.avatarUrl} alt={cliUser.login} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    activeProfile.icon
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {activeProfile.name}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate flex items-center gap-1">
                    {isCopilotProfile && cliUser ? `@${cliUser.login} · ` : ''}
                    <span className="inline-block px-1.5 py-0 rounded text-[9px] uppercase tracking-wider bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                      {connInfo.badge}
                    </span>
                    {activeProfile.model && (
                      <span className="text-[10px] opacity-60 ml-1">{activeProfile.model}</span>
                    )}
                  </div>
                </div>
                <span className="text-[var(--accent-green)] text-xs shrink-0">●</span>
              </div>
            )}

            {/* Other profiles — quick switch */}
            {otherProfiles.length > 0 && (
              <div className="border-b border-[var(--border-color)]">
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  Switch Profile
                </div>
                {otherProfiles.map((p) => {
                  const info = CONNECTION_LABELS[p.connection.type] ?? { label: '?', badge: '?' };
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSwitchProfile(p.id)}
                      className="w-full px-4 py-2 text-left text-xs flex items-center gap-3 hover:bg-[var(--bg-primary)] transition-colors cursor-pointer"
                    >
                      <span className="text-base opacity-70">{p.icon}</span>
                      <div className="min-w-0 flex-1">
                        <span className="text-[var(--text-primary)]">{p.name}</span>
                        <span className="ml-1.5 text-[9px] uppercase opacity-50">({info.badge})</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Add profile + Sign in */}
            {isCopilotProfile && (
              <button
                onClick={() => { setOpen(false); handleStartOAuth(); }}
                className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-2 border-b border-[var(--border-color)]"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8A1.5 1.5 0 0 0 3 12.5Zm6.56 4.5 1.97-1.97a.749.749 0 1 0-1.06-1.06L7.97 5.47a.75.75 0 0 0 0 1.06l1.5 1.5a.749.749 0 1 0 1.06-1.06L8.56 7Z"/></svg>
                Sign in with GitHub
              </button>
            )}

            {/* Manage Profiles */}
            <button
              onClick={() => { setOpen(false); onOpenSettings(); }}
              className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--accent-gold)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-2 border-b border-[var(--border-color)]"
            >
              <span>👤</span> Manage Profiles
            </button>

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
            {onDemoToggle && (
              <button
                onClick={() => { setOpen(false); onDemoToggle(); }}
                className={`w-full px-4 py-2.5 text-left text-xs transition-colors cursor-pointer flex items-center gap-2 ${
                  demoActive
                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                    : 'text-[var(--text-secondary)] hover:text-[var(--accent-purple)] hover:bg-[var(--bg-primary)]'
                }`}
              >
                <span>{demoActive ? '⏹' : '🎲'}</span> {demoActive ? 'Stop Demo' : 'Demo Mode'}
              </button>
            )}
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
