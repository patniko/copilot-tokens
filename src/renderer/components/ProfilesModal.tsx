import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ConnectionProfile, ProfileConnection } from '../../main/profile-service';

const CONNECTION_TYPES = [
  { type: 'copilot-cli', label: 'GitHub Copilot', icon: '🐙', desc: 'Bundled or system CLI' },
  { type: 'anthropic', label: 'Anthropic API Key', icon: '🔮', desc: 'Claude models via API' },
  { type: 'openai', label: 'OpenAI API Key', icon: '🧠', desc: 'GPT models via API' },
  { type: 'azure', label: 'Azure OpenAI', icon: '☁️', desc: 'Azure-hosted models' },
  { type: 'copilot-remote', label: 'Remote CLI Server', icon: '🌐', desc: 'Connect to running server' },
  { type: 'custom', label: 'Custom Provider', icon: '⚡', desc: 'Any OpenAI-compatible API' },
];

const CONNECTION_LABELS: Record<string, { label: string; icon: string; desc: string }> = {};
for (const ct of CONNECTION_TYPES) CONNECTION_LABELS[ct.type] = ct;

interface ProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Inline profile editor form */
function ProfileEditor({ profile, availableModels, onSave, onCancel }: {
  profile: ConnectionProfile;
  availableModels: { id: string; name: string; contextWindow: number }[];
  onSave: (p: ConnectionProfile) => void;
  onCancel: () => void;
}) {
  const [p, setP] = useState<ConnectionProfile>({ ...profile });
  const conn = p.connection;
  const [providerModels, setProviderModels] = useState<{ id: string; name: string; owned_by?: string }[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isBYOK = conn.type === 'anthropic' || conn.type === 'openai' || conn.type === 'azure' || conn.type === 'custom';
  const hasApiKey = (conn.type === 'anthropic' && conn.apiKey) ||
    (conn.type === 'openai' && conn.apiKey) ||
    (conn.type === 'azure' && conn.apiKey && conn.baseUrl) ||
    (conn.type === 'custom' && conn.baseUrl);

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setFetchError(null);
    try {
      const models = await window.profilesAPI?.fetchModels(conn);
      if (models && models.length > 0) {
        setProviderModels(models);
        // If no enabled models set yet, enable all by default
        if (!p.enabledModels?.length) {
          setP(prev => ({ ...prev, enabledModels: models.map(m => m.id) }));
        }
      } else {
        setFetchError('No models returned. Check your API key and endpoint.');
      }
    } catch {
      setFetchError('Failed to connect. Verify your credentials.');
    } finally {
      setFetchingModels(false);
    }
  };

  const toggleModel = (modelId: string) => {
    setP(prev => {
      const current = prev.enabledModels ?? providerModels.map(m => m.id);
      const next = current.includes(modelId)
        ? current.filter(id => id !== modelId)
        : [...current, modelId];
      return { ...prev, enabledModels: next };
    });
  };

  const updateConn = (updates: Partial<ProfileConnection>) => {
    setP(prev => ({ ...prev, connection: { ...prev.connection, ...updates } as ProfileConnection }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          {profile.id ? 'Edit Profile' : 'New Profile'}
        </h3>
        <button onClick={onCancel} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">✕ Cancel</button>
      </div>

      {/* Name + Icon */}
      <div className="flex gap-2">
        <input
          type="text"
          value={p.icon}
          onChange={e => setP(prev => ({ ...prev, icon: e.target.value }))}
          className="w-12 px-2 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-center text-lg"
          maxLength={2}
        />
        <input
          type="text"
          value={p.name}
          onChange={e => setP(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Profile name"
          className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
        />
      </div>

      {/* Connection-specific fields */}
      {conn.type === 'copilot-cli' && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">CLI Mode</label>
          <div className="flex gap-2">
            {(['bundled', 'installed'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => updateConn({ cliMode: mode })}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  conn.cliMode === mode
                    ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]'
                    : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                }`}
              >
                {mode === 'bundled' ? '📦 Bundled' : '💻 System Installed'}
              </button>
            ))}
          </div>
        </div>
      )}

      {conn.type === 'copilot-remote' && (
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Server URL</label>
          <input
            type="text"
            value={conn.url}
            onChange={e => updateConn({ url: e.target.value })}
            placeholder="localhost:3333"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
          />
        </div>
      )}

      {conn.type === 'anthropic' && (
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Anthropic API Key</label>
          <input
            type="password"
            value={conn.apiKey}
            onChange={e => updateConn({ apiKey: e.target.value })}
            placeholder="sk-ant-..."
            className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
          />
          <p className="mt-1 text-[10px] text-[var(--text-secondary)]">Encrypted and stored locally. Never sent to GitHub.</p>
        </div>
      )}

      {conn.type === 'openai' && (
        <>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">OpenAI API Key</label>
            <input
              type="password"
              value={conn.apiKey}
              onChange={e => updateConn({ apiKey: e.target.value })}
              placeholder="sk-..."
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Base URL (optional)</label>
            <input
              type="text"
              value={conn.baseUrl ?? ''}
              onChange={e => updateConn({ baseUrl: e.target.value || undefined })}
              placeholder="https://api.openai.com/v1"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
        </>
      )}

      {conn.type === 'azure' && (
        <>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Azure Endpoint URL</label>
            <input
              type="text"
              value={conn.baseUrl}
              onChange={e => updateConn({ baseUrl: e.target.value })}
              placeholder="https://your-resource.openai.azure.com"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">API Key</label>
            <input
              type="password"
              value={conn.apiKey}
              onChange={e => updateConn({ apiKey: e.target.value })}
              placeholder="Azure API key"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">API Version (optional)</label>
            <input
              type="text"
              value={conn.apiVersion ?? ''}
              onChange={e => updateConn({ apiVersion: e.target.value || undefined })}
              placeholder="2024-10-21"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
        </>
      )}

      {conn.type === 'custom' && (
        <>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">API Base URL</label>
            <input
              type="text"
              value={conn.baseUrl}
              onChange={e => updateConn({ baseUrl: e.target.value })}
              placeholder="http://localhost:11434/v1"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">API Key (optional)</label>
            <input
              type="password"
              value={conn.apiKey ?? ''}
              onChange={e => updateConn({ apiKey: e.target.value || undefined })}
              placeholder="Optional for local providers like Ollama"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Bearer Token (optional)</label>
            <input
              type="password"
              value={conn.bearerToken ?? ''}
              onChange={e => updateConn({ bearerToken: e.target.value || undefined })}
              placeholder="Alternative to API key"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
        </>
      )}

      {/* Models */}
      {isBYOK ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Models</label>
            <button
              onClick={handleFetchModels}
              disabled={!hasApiKey || fetchingModels}
              className="text-[10px] px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {fetchingModels ? '⏳ Fetching…' : '🔄 Fetch Available Models'}
            </button>
          </div>
          {!hasApiKey && (
            <p className="text-[10px] text-[var(--text-secondary)]">Enter credentials above, then fetch to discover available models.</p>
          )}
          {fetchError && (
            <p className="text-[10px] text-red-400">{fetchError}</p>
          )}
          {providerModels.length > 0 && (
            <>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                <span>{providerModels.length} models found · {(p.enabledModels ?? providerModels.map(m => m.id)).length} enabled</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setP(prev => ({ ...prev, enabledModels: providerModels.map(m => m.id) }))}
                    className="text-[var(--accent-blue)] hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setP(prev => ({ ...prev, enabledModels: [] }))}
                    className="text-[var(--text-secondary)] hover:underline cursor-pointer"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
                {providerModels.map(m => {
                  const enabled = (p.enabledModels ?? providerModels.map(x => x.id)).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleModel(m.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 border-b border-[var(--border-color)] last:border-b-0 transition-colors cursor-pointer ${
                        enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-50'
                      } hover:bg-[var(--bg-secondary)]`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        enabled
                          ? 'border-[var(--accent-green)] bg-[var(--accent-green)]/20'
                          : 'border-[var(--text-secondary)]'
                      }`}>
                        {enabled && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-green)]"><path d="M1.5 5.5l2 2 5-5"/></svg>}
                      </span>
                      <span className="truncate flex-1">{m.name}</span>
                      {m.owned_by && <span className="text-[10px] opacity-40 shrink-0">{m.owned_by}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {/* Default model from the enabled list */}
          {(providerModels.length > 0 || p.enabledModels?.length) && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Default Model</label>
              <select
                value={p.model ?? ''}
                onChange={e => setP(prev => ({ ...prev, model: e.target.value || undefined }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm cursor-pointer"
              >
                <option value="">None (use first available)</option>
                {(p.enabledModels ?? providerModels.map(m => m.id)).map(id => {
                  const m = providerModels.find(x => x.id === id);
                  return <option key={id} value={id}>{m?.name ?? id}</option>;
                })}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Default Model (optional)</label>
          <select
            value={p.model ?? ''}
            onChange={e => setP(prev => ({ ...prev, model: e.target.value || undefined }))}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm cursor-pointer"
          >
            <option value="">Use global default</option>
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Save */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onSave(p)}
          disabled={!p.name.trim()}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {profile.id ? 'Save Changes' : 'Create Profile'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ProfilesModal({ isOpen, onClose }: ProfilesModalProps) {
  const [profilesList, setProfilesList] = useState<ConnectionProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string; contextWindow: number }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setEditingProfile(null);
    window.profilesAPI?.list().then(setProfilesList);
    window.profilesAPI?.getActive().then(({ id }) => setActiveProfileId(id));
    if (availableModels.length === 0) {
      window.modelAPI?.list().then(setAvailableModels).catch(() => {});
    }
  }, [isOpen]);

  const handleSaveProfile = async (profile: ConnectionProfile) => {
    if (window.profilesAPI) {
      await window.profilesAPI.save(profile);
      setProfilesList(await window.profilesAPI.list());
      setEditingProfile(null);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
  };

  const handleCreateProfile = (connType: ProfileConnection['type']) => {
    const templates: Record<string, Omit<ConnectionProfile, 'id'>> = {
      'copilot-cli': { name: 'GitHub Copilot', icon: '🐙', connection: { type: 'copilot-cli', cliMode: 'bundled' }, authSource: 'cli' },
      'copilot-remote': { name: 'Remote Server', icon: '🌐', connection: { type: 'copilot-remote', url: 'localhost:3333' } },
      'anthropic': { name: 'Anthropic', icon: '🔮', connection: { type: 'anthropic', apiKey: '' } },
      'openai': { name: 'OpenAI', icon: '🧠', connection: { type: 'openai', apiKey: '' } },
      'azure': { name: 'Azure OpenAI', icon: '☁️', connection: { type: 'azure', apiKey: '', baseUrl: '' } },
      'custom': { name: 'Custom Provider', icon: '⚡', connection: { type: 'custom', baseUrl: '' } },
    };
    const template = templates[connType];
    if (template) {
      setEditingProfile({ ...template, id: '' } as ConnectionProfile);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (id === 'default') return;
    if (window.profilesAPI) {
      await window.profilesAPI.delete(id);
      setProfilesList(await window.profilesAPI.list());
    }
  };

  const handleSetActiveProfile = async (id: string) => {
    if (window.profilesAPI) {
      await window.profilesAPI.setActive(id);
      setActiveProfileId(id);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="pointer-events-auto w-full max-w-lg max-h-[80vh] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                <h2 className="text-lg font-bold tracking-widest text-[var(--accent-gold)] led-text">
                  👤 PROFILES
                </h2>
                <button
                  onClick={onClose}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="flex flex-col gap-4">
                  {editingProfile ? (
                    <ProfileEditor
                      profile={editingProfile}
                      availableModels={availableModels}
                      onSave={async (p) => {
                        if (p.id) {
                          await handleSaveProfile(p);
                        } else {
                          if (window.profilesAPI) {
                            const created = await window.profilesAPI.create(p);
                            setProfilesList(await window.profilesAPI.list());
                            setEditingProfile(null);
                            await handleSetActiveProfile(created.id);
                          }
                        }
                      }}
                      onCancel={() => setEditingProfile(null)}
                    />
                  ) : (
                    <>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Manage accounts, API keys, and connection settings. Switch profiles to change how the app connects to AI providers.
                      </p>

                      {/* Profile list */}
                      {profilesList.map((p) => {
                        const info = CONNECTION_LABELS[p.connection.type] ?? { label: '?', icon: '❓', desc: '' };
                        const isActive = p.id === activeProfileId;
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              isActive
                                ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10'
                                : 'border-[var(--border-color)] bg-[var(--bg-primary)]'
                            }`}
                          >
                            <span className="text-xl shrink-0">{p.icon}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                                {p.name}
                                {isActive && <span className="text-[9px] uppercase px-1.5 rounded bg-[var(--accent-gold)]/20 text-[var(--accent-gold)]">Active</span>}
                              </div>
                              <div className="text-[11px] text-[var(--text-secondary)] truncate">
                                {info.label}{p.model ? ` · ${p.model}` : ''}
                                {p.excludedTools?.length ? ` · ${p.excludedTools.length} tools disabled` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!isActive && (
                                <button
                                  onClick={() => handleSetActiveProfile(p.id)}
                                  className="px-2 py-1 text-[10px] rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                                >
                                  Activate
                                </button>
                              )}
                              <button
                                onClick={() => setEditingProfile({ ...p })}
                                className="px-2 py-1 text-[10px] rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              {!p.isDefault && (
                                <button
                                  onClick={() => handleDeleteProfile(p.id)}
                                  className="px-2 py-1 text-[10px] rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-red-400 hover:text-red-400 transition-colors cursor-pointer"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Add profile */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-2 mt-2">
                          Add New Profile
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {CONNECTION_TYPES.map(({ type, label, icon, desc }) => (
                            <button
                              key={type}
                              onClick={() => handleCreateProfile(type as ProfileConnection['type'])}
                              className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--accent-gold)] transition-colors cursor-pointer text-left"
                            >
                              <span className="text-base shrink-0">{icon}</span>
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-[var(--text-primary)]">{label}</div>
                                <div className="text-[10px] text-[var(--text-secondary)] truncate">{desc}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {profileSaved && (
                        <span className="text-xs text-[var(--accent-green)]">✓ Profile saved</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-[var(--border-color)] text-center text-[10px] text-[var(--text-secondary)]">
                API keys are encrypted locally via Electron safeStorage
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
