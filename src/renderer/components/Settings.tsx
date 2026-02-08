import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../hooks/useTheme';
import { useSound } from '../hooks/useSound';
import type { Theme } from '../lib/themes';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const themeEmojis: Record<Theme['name'], string> = {
  'neon-arcade': '🌃',
  'retro-casino': '🎰',
  minimal: '✨',
};

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const { theme, setTheme, themes } = useTheme();
  const { play, enabled, setEnabled, volume, setVolume } = useSound();
  const [model, setModel] = useState('gpt-4o');

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

              {/* AI Model (stub) */}
              <section>
                <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  AI Model{' '}
                  <span className="normal-case text-xs opacity-60">(Coming soon)</span>
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm opacity-50 cursor-not-allowed appearance-none"
                >
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="claude-sonnet">Claude Sonnet</option>
                  <option value="custom">Custom</option>
                </select>
              </section>

              {/* Working Directory (stub) */}
              <section>
                <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  Working Directory{' '}
                  <span className="normal-case text-xs opacity-60">(Coming soon)</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-secondary)] truncate">
                    ~/projects/my-app
                  </div>
                  <button
                    disabled
                    className="px-3 py-2 text-xs font-medium rounded border border-[var(--border-color)] text-[var(--text-secondary)] opacity-50 cursor-not-allowed"
                  >
                    Change
                  </button>
                </div>
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
