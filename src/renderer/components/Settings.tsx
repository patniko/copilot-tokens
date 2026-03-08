import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../hooks/useTheme';
import { useSound } from '../hooks/useSound';
import type { Theme } from '../lib/themes';

type SettingsTab = 'general' | 'features' | 'prompt' | 'skills';

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

  // Feature flags state
  const [features, setFeatures] = useState<FeatureFlags>({
    customTools: true,
    askUser: true,
    reasoning: true,
    infiniteSessions: true,
    hooks: true,
    customAgents: true,
    sessionEvents: true,
  });
  const [featuresSaved, setFeaturesSaved] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<string | null>(null);

  // Compaction thresholds
  const [compaction, setCompaction] = useState({ background: 0.80, bufferExhaustion: 0.95 });
  const [compactionSaved, setCompactionSaved] = useState(false);

  // Skill management
  const [skillDirectories, setSkillDirectories] = useState<string[]>([]);
  const [disabledSkills, setDisabledSkills] = useState<string[]>([]);
  const [newSkillDir, setNewSkillDir] = useState('');
  const [newDisabledSkill, setNewDisabledSkill] = useState('');
  const [skillsSaved, setSkillsSaved] = useState(false);

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
    if (window.compactionAPI) {
      window.compactionAPI.get().then(setCompaction);
    }
    if (window.skillsAPI) {
      window.skillsAPI.getDirectories().then(setSkillDirectories);
      window.skillsAPI.getDisabled().then(setDisabledSkills);
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
                  { id: 'features' as SettingsTab, label: 'SDK Features', icon: '⚡' },
                  { id: 'skills' as SettingsTab, label: 'Skills', icon: '🧩' },
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

                    {/* Compaction Thresholds — only visible when infinite sessions is on */}
                    {features.infiniteSessions && (
                      <section className="mt-2 border-t border-[var(--border-color)] pt-4">
                        <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                          Compaction Thresholds
                        </label>
                        <p className="text-xs text-[var(--text-secondary)] mb-3">
                          Control when context compaction triggers. Background compaction runs async; buffer exhaustion blocks until done.
                        </p>
                        <div className="flex flex-col gap-3">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[var(--text-secondary)]">Background compaction</span>
                              <span className="text-[var(--text-primary)] font-mono">{Math.round(compaction.background * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0.5"
                              max="0.95"
                              step="0.05"
                              value={compaction.background}
                              onChange={(e) => setCompaction(prev => ({ ...prev, background: parseFloat(e.target.value) }))}
                              className="w-full accent-[var(--accent-purple)]"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[var(--text-secondary)]">Buffer exhaustion</span>
                              <span className="text-[var(--text-primary)] font-mono">{Math.round(compaction.bufferExhaustion * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0.8"
                              max="1.0"
                              step="0.01"
                              value={compaction.bufferExhaustion}
                              onChange={(e) => setCompaction(prev => ({ ...prev, bufferExhaustion: parseFloat(e.target.value) }))}
                              className="w-full accent-[var(--accent-red)]"
                            />
                          </div>
                          <button
                            onClick={() => {
                              window.compactionAPI?.set(compaction);
                              setCompactionSaved(true);
                              setTimeout(() => setCompactionSaved(false), 2000);
                            }}
                            className="self-start px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer"
                          >
                            Apply Thresholds
                          </button>
                          {compactionSaved && (
                            <span className="text-xs text-[var(--accent-green)]">✓ Thresholds updated — sessions restarted</span>
                          )}
                        </div>
                      </section>
                    )}
                  </div>
                ) : tab === 'skills' ? (
                  /* Skills Management Tab */
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                        Skill Directories
                      </label>
                      <p className="text-xs text-[var(--text-secondary)] mb-3">
                        Add directories containing custom Copilot skills. Skills provide specialized domain knowledge and capabilities.
                      </p>
                    </div>

                    {/* Existing skill directories */}
                    {skillDirectories.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {skillDirectories.map((dir, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
                            <span className="text-xs font-mono text-[var(--text-primary)] truncate flex-1">{dir}</span>
                            <button
                              onClick={() => {
                                const updated = skillDirectories.filter((_, j) => j !== i);
                                setSkillDirectories(updated);
                                window.skillsAPI?.setDirectories(updated);
                              }}
                              className="ml-2 text-[var(--text-secondary)] hover:text-[var(--accent-red)] cursor-pointer text-sm"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new skill directory */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSkillDir}
                        onChange={(e) => setNewSkillDir(e.target.value)}
                        placeholder="/path/to/skills"
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono"
                      />
                      <button
                        onClick={() => {
                          if (newSkillDir.trim()) {
                            const updated = [...skillDirectories, newSkillDir.trim()];
                            setSkillDirectories(updated);
                            window.skillsAPI?.setDirectories(updated);
                            setNewSkillDir('');
                            setSkillsSaved(true);
                            setTimeout(() => setSkillsSaved(false), 2000);
                          }
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {/* Disabled Skills */}
                    <div className="mt-2 border-t border-[var(--border-color)] pt-4">
                      <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                        Disabled Skills
                      </label>
                      <p className="text-xs text-[var(--text-secondary)] mb-3">
                        Skills listed here will not be loaded, even if present in skill directories.
                      </p>

                      {disabledSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {disabledSkills.map((skill, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                              {skill}
                              <button
                                onClick={() => {
                                  const updated = disabledSkills.filter((_, j) => j !== i);
                                  setDisabledSkills(updated);
                                  window.skillsAPI?.setDisabled(updated);
                                }}
                                className="hover:text-[var(--accent-red)] cursor-pointer"
                              >✕</button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDisabledSkill}
                          onChange={(e) => setNewDisabledSkill(e.target.value)}
                          placeholder="skill-name"
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono"
                        />
                        <button
                          onClick={() => {
                            if (newDisabledSkill.trim()) {
                              const updated = [...disabledSkills, newDisabledSkill.trim()];
                              setDisabledSkills(updated);
                              window.skillsAPI?.setDisabled(updated);
                              setNewDisabledSkill('');
                              setSkillsSaved(true);
                              setTimeout(() => setSkillsSaved(false), 2000);
                            }
                          }}
                          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer"
                        >
                          Disable
                        </button>
                      </div>
                    </div>

                    {skillsSaved && (
                      <span className="text-xs text-[var(--accent-green)]">✓ Skills updated — sessions restarted</span>
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
