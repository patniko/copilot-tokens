import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../hooks/useTheme';
import { useSound } from '../hooks/useSound';
import type { Theme } from '../lib/themes';
import type { ConnectionProfile, ProfileConnection } from '../../main/profile-service';

type SettingsTab = 'general' | 'profiles' | 'features' | 'prompt';

type CliMode =
  | { type: 'bundled' }
  | { type: 'installed' }
  | { type: 'remote'; url: string };

interface FeatureFlags {
  customTools: boolean;
  askUser: boolean;
  reasoning: boolean;
  infiniteSessions: boolean;
  hooks: boolean;
  customAgents: boolean;
  sessionEvents: boolean;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onModelChange?: (model: string) => void;
}

const themeEmojis: Record<string, string> = {
  'neon-arcade': '🌃',
  'retro-casino': '🎰',
  minimal: '✨',
};

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

/** Inline profile editor form */
function ProfileEditor({ profile, availableModels, onSave, onCancel }: {
  profile: ConnectionProfile;
  availableModels: { id: string; name: string; contextWindow: number }[];
  onSave: (p: ConnectionProfile) => void;
  onCancel: () => void;
}) {
  const [p, setP] = useState<ConnectionProfile>({ ...profile });
  const conn = p.connection;

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

      {/* Model override */}
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

export default function Settings({ isOpen, onClose, onModelChange }: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>('general');
  const { theme, setTheme, themes } = useTheme();
  const { play, enabled, setEnabled, volume, setVolume } = useSound();
  const [model, setModel] = useState('claude-sonnet-4');
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string; contextWindow: number }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // System prompt state
  const [promptMode, setPromptMode] = useState<'append' | 'replace'>('append');
  const [promptContent, setPromptContent] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [promptDirty, setPromptDirty] = useState(false);

  // CLI mode state
  const [cliMode, setCliMode] = useState<CliMode>({ type: 'bundled' });
  const [remoteUrl, setRemoteUrl] = useState('');
  const [cliModeSaved, setCliModeSaved] = useState(false);

  // Profiles state
  const [profilesList, setProfilesList] = useState<ConnectionProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Feature flags state
  const [features, setFeatures] = useState<FeatureFlags>({
    customTools: true,
    askUser: true,
    reasoning: true,
    infiniteSessions: true,
    hooks: true,
    customAgents: false,
    sessionEvents: true,
  });
  const [featuresSaved, setFeaturesSaved] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab('general');
    if (window.modelAPI) {
      window.modelAPI.get().then(setModel);
      if (availableModels.length === 0) {
        setModelsLoading(true);
        window.modelAPI.list().then((models) => {
          setAvailableModels(models);
          setModelsLoading(false);
        }).catch(() => setModelsLoading(false));
      }
    }
    if (window.settingsAPI) {
      window.settingsAPI.getSystemPrompt().then((cfg) => {
        setPromptMode(cfg.mode);
        setPromptContent(cfg.content);
        setPromptDirty(false);
        setPromptSaved(false);
      });
      window.settingsAPI.getCliMode().then((mode) => {
        setCliMode(mode);
        if (mode.type === 'remote') setRemoteUrl(mode.url);
      });
    }
    if (window.featuresAPI) {
      window.featuresAPI.get().then(setFeatures);
      window.featuresAPI.getReasoningEffort().then(setReasoningEffort);
    }
    if (window.profilesAPI) {
      window.profilesAPI.list().then(setProfilesList);
      window.profilesAPI.getActive().then(({ id }) => setActiveProfileId(id));
    }
  }, [isOpen]);

  const handleSavePrompt = async () => {
    if (!window.settingsAPI) return;
    await window.settingsAPI.setSystemPrompt({ mode: promptMode, content: promptContent });
    setPromptDirty(false);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const handleToggleFeature = async (key: keyof FeatureFlags) => {
    const updated = { ...features, [key]: !features[key] };
    setFeatures(updated);
    if (window.featuresAPI) {
      await window.featuresAPI.set(updated);
      setFeaturesSaved(true);
      setTimeout(() => setFeaturesSaved(false), 2000);
    }
  };

  const handleReasoningEffortChange = async (effort: string | null) => {
    setReasoningEffort(effort);
    if (window.featuresAPI) {
      await window.featuresAPI.setReasoningEffort(effort);
    }
  };

  const handleCliModeChange = async (mode: CliMode) => {
    setCliMode(mode);
    if (window.settingsAPI) {
      await window.settingsAPI.setCliMode(mode);
      // Refresh model list from the new CLI backend
      if (window.modelAPI) {
        setModelsLoading(true);
        window.modelAPI.refresh().then((models) => {
          setAvailableModels(models);
          setModelsLoading(false);
        }).catch(() => setModelsLoading(false));
      }
      setCliModeSaved(true);
      setTimeout(() => setCliModeSaved(false), 2000);
    }
  };

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
      // Refresh models for new backend
      if (window.modelAPI) {
        setModelsLoading(true);
        window.modelAPI.refresh().then((models) => {
          setAvailableModels(models);
          setModelsLoading(false);
        }).catch(() => setModelsLoading(false));
      }
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
            <div className="pointer-events-auto w-full max-w-xl max-h-[80vh] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                <h2 className="text-lg font-bold tracking-widest text-[var(--accent-gold)] led-text">
                  ⚙️ SETTINGS
                </h2>
                <button
                  onClick={onClose}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--border-color)]">
                {([
                  { id: 'general' as SettingsTab, label: 'General', icon: '🎨' },
                  { id: 'profiles' as SettingsTab, label: 'Profiles', icon: '👤' },
                  { id: 'features' as SettingsTab, label: 'SDK Features', icon: '⚡' },
                  { id: 'prompt' as SettingsTab, label: 'System Prompt', icon: '📝' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                      tab === t.id
                        ? 'text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)] bg-[var(--bg-primary)]/30'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {tab === 'general' ? (
                  <div className="flex flex-col gap-6">
                    {/* Theme Picker */}
                    <section>
                      <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                        Theme
                      </label>
                      <div className="flex flex-col gap-2">
                        {(Object.values(themes) as Theme[]).map((t) => {
                          const active = t.name === theme.name;
                          return (
                            <motion.button
                              key={t.name}
                              onClick={() => setTheme(t.name)}
                              whileHover={{ scale: 1.02 }}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                                active
                                  ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10'
                                  : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)]'
                              }`}
                            >
                              <div className="flex gap-1">
                                {[t.colors.accentGold, t.colors.accentPurple, t.colors.accentBlue].map(
                                  (color, i) => (
                                    <div
                                      key={i}
                                      className="w-4 h-4 rounded-full border border-white/20"
                                      style={{ backgroundColor: color }}
                                    />
                                  ),
                                )}
                              </div>
                              <span className="text-sm text-[var(--text-primary)] font-medium">
                                {themeEmojis[t.name]} {t.label}
                              </span>
                              {active && (
                                <span className="ml-auto text-[var(--accent-gold)]">✓</span>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </section>

                    {/* Sound */}
                    <section>
                      <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                        Sound Effects
                      </label>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[var(--text-primary)]">
                            {enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <button
                            onClick={() => setEnabled(!enabled)}
                            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                              enabled ? 'bg-green-500' : 'bg-gray-600'
                            }`}
                          >
                            <motion.div
                              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                              animate={{ left: enabled ? 26 : 2 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>

                        {enabled && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[var(--text-secondary)] w-6">🔊</span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={volume}
                              onChange={(e) => setVolume(parseFloat(e.target.value))}
                              className="flex-1 accent-[var(--accent-gold)] h-1"
                            />
                            <span className="text-xs text-[var(--text-secondary)] w-10 text-right">
                              {Math.round(volume * 100)}%
                            </span>
                          </div>
                        )}

                        {enabled && (
                          <button
                            onClick={() => play('leverPull')}
                            className="self-start px-3 py-1.5 text-xs font-medium rounded border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                          >
                            🔔 Test Sound
                          </button>
                        )}
                      </div>
                    </section>

                    {/* AI Model */}
                    <section>
                      <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                        AI Model
                      </label>
                      {modelsLoading ? (
                        <div className="px-3 py-2 text-sm text-[var(--text-secondary)]">Loading models…</div>
                      ) : (
                        <select
                          value={model}
                          onChange={(e) => {
                            const m = e.target.value;
                            setModel(m);
                            window.modelAPI?.set(m);
                            onModelChange?.(m);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm cursor-pointer"
                        >
                          {availableModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}{m.contextWindow ? ` (${Math.round(m.contextWindow / 1000)}K)` : ''}
                            </option>
                          ))}
                          {availableModels.length === 0 && (
                            <option value={model}>{model}</option>
                          )}
                        </select>
                      )}
                      <p className="mt-1.5 text-[10px] text-[var(--text-secondary)]">
                        Changes take effect on next message
                      </p>
                    </section>
                  </div>
                ) : tab === 'profiles' ? (
                  /* Profiles Tab */
                  <div className="flex flex-col gap-4">
                    {editingProfile ? (
                      /* Profile Editor */
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
                              // Auto-activate new profile
                              await handleSetActiveProfile(created.id);
                            }
                          }
                        }}
                        onCancel={() => setEditingProfile(null)}
                      />
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                            Connection Profiles
                          </label>
                          <p className="text-xs text-[var(--text-secondary)] mb-4">
                            Manage accounts, API keys, and connection settings. Switch profiles to change how the app connects to AI providers.
                          </p>
                        </div>

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
                ) : tab === 'features' ? (
                  /* SDK Features Tab */
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                        SDK Capabilities
                      </label>
                      <p className="text-xs text-[var(--text-secondary)] mb-4">
                        Toggle Copilot SDK features on or off. Changes restart active sessions.
                      </p>
                    </div>

                    {([
                      { key: 'reasoning' as const, label: 'Reasoning Chain', icon: '🧠', desc: 'Show model thinking process in real-time' },
                      { key: 'askUser' as const, label: 'Ask User (Interactive)', icon: '💬', desc: 'Agent can ask clarifying questions mid-task' },
                      { key: 'customTools' as const, label: 'Native Tools', icon: '🔧', desc: 'Desktop notifications, clipboard, system info, etc.' },
                      { key: 'infiniteSessions' as const, label: 'Infinite Sessions', icon: '♾️', desc: 'Auto-compaction keeps conversations alive forever' },
                      { key: 'hooks' as const, label: 'Session Hooks', icon: '🪝', desc: 'Pre/post tool hooks, prompt validation, error recovery' },
                      { key: 'customAgents' as const, label: 'Custom Agents', icon: '🤖', desc: 'Agent personas with tailored system prompts' },
                      { key: 'sessionEvents' as const, label: 'Session Events', icon: '📡', desc: 'Error banners, compaction, model changes, shutdown reports' },
                    ]).map(({ key, label, icon, desc }) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-lg shrink-0">{icon}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
                            <div className="text-[11px] text-[var(--text-secondary)] truncate">{desc}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleFeature(key)}
                          className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer shrink-0 ml-3 ${
                            features[key] ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        >
                          <motion.div
                            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                            animate={{ left: features[key] ? 26 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                    ))}

                    {/* Reasoning effort selector */}
                    {features.reasoning && (
                      <section className="mt-2">
                        <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                          Reasoning Effort
                        </label>
                        <div className="flex gap-2">
                          {[
                            { value: null, label: 'Auto' },
                            { value: 'low', label: 'Low' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'high', label: 'High' },
                            { value: 'xhigh', label: 'Max' },
                          ].map(({ value, label }) => (
                            <button
                              key={label}
                              onClick={() => handleReasoningEffortChange(value)}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                                reasoningEffort === value
                                  ? 'border-[var(--accent-purple)] bg-[var(--accent-purple)]/10 text-[var(--accent-purple)]'
                                  : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[10px] text-[var(--text-secondary)]">
                          Higher effort = deeper thinking, more tokens. Only works with reasoning-capable models.
                        </p>
                      </section>
                    )}

                    {featuresSaved && (
                      <span className="text-xs text-[var(--accent-green)]">✓ Features updated — sessions restarted</span>
                    )}
                  </div>
                ) : (
                  /* System Prompt Tab */
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                        Custom Instructions
                      </label>
                      <p className="text-xs text-[var(--text-secondary)] mb-3">
                        Add custom instructions that shape how Copilot behaves. These are included in every session.
                      </p>
                    </div>

                    {/* Mode toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setPromptMode('append'); setPromptDirty(true); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          promptMode === 'append'
                            ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]'
                            : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                        }`}
                      >
                        ✚ Append to default
                      </button>
                      <button
                        onClick={() => { setPromptMode('replace'); setPromptDirty(true); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          promptMode === 'replace'
                            ? 'border-[var(--accent-red)] bg-[var(--accent-red)]/10 text-[var(--accent-red)]'
                            : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                        }`}
                      >
                        ⤭ Replace entirely
                      </button>
                    </div>

                    {promptMode === 'replace' && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30">
                        <span className="text-sm">⚠️</span>
                        <p className="text-[11px] text-[var(--accent-red)]">
                          Replace mode removes all SDK guardrails including security restrictions. Only use if you know what you're doing.
                        </p>
                      </div>
                    )}

                    {promptMode === 'append' && (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Your instructions will be appended after Copilot's built-in system prompt. All default behavior and safety guardrails are preserved.
                      </p>
                    )}

                    {/* Textarea */}
                    <textarea
                      value={promptContent}
                      onChange={(e) => { setPromptContent(e.target.value); setPromptDirty(true); }}
                      placeholder={promptMode === 'append'
                        ? 'e.g., Always use TypeScript strict mode. Prefer functional components. Follow the project\'s existing patterns.'
                        : 'Enter the complete system prompt…'
                      }
                      className="w-full h-48 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono resize-y placeholder:text-[var(--text-secondary)]/50"
                    />

                    {/* Save */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSavePrompt}
                        disabled={!promptDirty}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          promptDirty
                            ? 'bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90'
                            : 'bg-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed'
                        }`}
                      >
                        Save & Restart Sessions
                      </button>
                      {promptSaved && (
                        <span className="text-xs text-[var(--accent-green)]">✓ Saved — active sessions restarted</span>
                      )}
                    </div>

                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Saving restarts all active sessions so the new prompt takes effect immediately.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-[var(--border-color)] text-center text-xs text-[var(--text-secondary)]">
                Copilot Tokens v1.0.0
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
