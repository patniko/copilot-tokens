import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../hooks/useTheme';
import { useSound } from '../hooks/useSound';
import type { Theme } from '../lib/themes';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onCwdChange?: (dir: string) => void;
  onModelChange?: (model: string) => void;
}

const themeEmojis: Record<Theme['name'], string> = {
  'neon-arcade': '🌃',
  'retro-casino': '🎰',
  minimal: '✨',
};

export default function Settings({ isOpen, onClose, onCwdChange, onModelChange }: SettingsProps) {
  const { theme, setTheme, themes } = useTheme();
  const { play, enabled, setEnabled, volume, setVolume } = useSound();
  const [model, setModel] = useState('claude-sonnet-4');
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [cwd, setCwd] = useState('');
  const [recentCwds, setRecentCwds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && window.cwdAPI) {
      window.cwdAPI.get().then(setCwd);
      window.cwdAPI.getRecent().then(setRecentCwds);
    }
    if (isOpen && window.modelAPI) {
      window.modelAPI.get().then(setModel);
      if (availableModels.length === 0) {
        setModelsLoading(true);
        window.modelAPI.list().then((models) => {
          setAvailableModels(models);
          setModelsLoading(false);
        }).catch(() => setModelsLoading(false));
      }
    }
  }, [isOpen]);

  const handleBrowse = async () => {
    if (!window.cwdAPI) return;
    const dir = await window.cwdAPI.browse();
    if (dir) {
      setCwd(dir);
      setRecentCwds(prev => [dir, ...prev.filter(d => d !== dir)].slice(0, 10));
      onCwdChange?.(dir);
    }
  };

  const handleSelectRecent = async (dir: string) => {
    if (!window.cwdAPI) return;
    await window.cwdAPI.set(dir);
    setCwd(dir);
    setRecentCwds(prev => [dir, ...prev.filter(d => d !== dir)].slice(0, 10));
    onCwdChange?.(dir);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed top-0 right-0 z-50 h-full w-[400px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col overflow-y-auto"
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
              <h2 className="text-xl font-bold tracking-widest text-[var(--accent-gold)] led-text">
                ⚙️ SETTINGS
              </h2>
              <button
                onClick={onClose}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-5 flex flex-col gap-6">
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
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          active
                            ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10'
                            : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)]'
                        }`}
                      >
                        {/* Color swatches */}
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
                  {/* Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-primary)]">
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => setEnabled(!enabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
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

                  {/* Volume slider */}
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

                  {/* Test Sound */}
                  {enabled && (
                    <button
                      onClick={() => play('leverPull')}
                      className="self-start px-3 py-1.5 text-xs font-medium rounded border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors"
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
                      <option key={m.id} value={m.id}>{m.name}</option>
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

              {/* Working Directory */}
              <section>
                <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  Working Directory
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] truncate font-mono">
                    {cwd || '(not set)'}
                  </div>
                  <button
                    onClick={handleBrowse}
                    className="px-3 py-2 text-xs font-medium rounded border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                  >
                    Browse
                  </button>
                </div>
                {recentCwds.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                      Recent
                    </span>
                    {recentCwds.map((dir) => (
                      <button
                        key={dir}
                        onClick={() => handleSelectRecent(dir)}
                        className={`text-left px-2 py-1.5 rounded text-xs font-mono truncate transition-colors cursor-pointer ${
                          dir === cwd
                            ? 'bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] border border-[var(--accent-gold)]/30'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                        }`}
                        title={dir}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* About */}
            <div className="p-5 border-t border-[var(--border-color)] text-center text-xs text-[var(--text-secondary)]">
              <p>Copilot Slots v1.0.0</p>
              <p className="mt-1">Built with ❤️ and electron</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
