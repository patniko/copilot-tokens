import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../hooks/useTheme';
import { useSound } from '../hooks/useSound';
import type { Theme } from '../lib/themes';

type SettingsTab = 'general' | 'prompt';

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

  useEffect(() => {
    if (!isOpen) return;
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
    }
  }, [isOpen]);

  const handleSavePrompt = async () => {
    if (!window.settingsAPI) return;
    await window.settingsAPI.setSystemPrompt({ mode: promptMode, content: promptContent });
    setPromptDirty(false);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
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

              {/* Content */}
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
