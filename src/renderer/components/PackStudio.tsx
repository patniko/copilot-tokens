import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { MilestonePack, SoundPack, ThemePack, SoundConfig } from '../lib/pack-types';
import type { Milestone } from '../lib/milestones';
import { setUserMilestonePacks } from '../lib/milestones';
import SoundManager, { previewSoundConfig, type SoundName } from '../lib/sound-manager';
import { registerTheme, removeUserTheme, type Theme } from '../lib/themes';
import { useTheme } from '../hooks/useTheme';
import { useSound } from '../hooks/useSound';
import { partyBus, PartyEvents } from '../lib/party-bus';

interface PackStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'milestones' | 'sounds' | 'themes';

const METRICS: { value: Milestone['metric']; label: string }[] = [
  { value: 'totalTokens', label: 'Total Tokens' },
  { value: 'filesChanged', label: 'Files Changed' },
  { value: 'linesInEdit', label: 'Lines Edited' },
];

const EFFECTS: Milestone['effect'][] = ['sparkle', 'banner', 'confetti', 'jackpot', 'mega'];
const SOUNDS: Milestone['sound'][] = ['milestone', 'jackpot', 'celebration100k', 'celebration500k'];
const SOUND_SLOTS: SoundName[] = ['leverPull', 'tokenTick', 'milestone', 'jackpot', 'commit', 'error', 'celebration100k', 'celebration500k'];
const WAVEFORMS: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
const EMOJIS = ['🎯', '🔥', '⚡', '💎', '🚀', '🌟', '🎪', '🎮', '🏅', '👑', '💰', '🎲'];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultSoundConfig(): SoundConfig {
  return { waveform: 'sine', frequency: 800, attack: 0.01, decay: 0.2, gain: 0.4 };
}

function defaultMilestone(): Milestone {
  return { id: `user-${uid()}`, threshold: 1000, metric: 'totalTokens', label: 'New Milestone', emoji: '🎯', effect: 'banner', sound: 'milestone' };
}

// ─── Milestone Pack Editor ───

function MilestonePackEditor({ packs, onSave, onDelete, onToggle }: {
  packs: MilestonePack[];
  onSave: (p: MilestonePack) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [editing, setEditing] = useState<MilestonePack | null>(null);
  const { play } = useSound();

  const startNew = () => {
    setEditing({ id: uid(), name: '', emoji: '🎯', milestones: [defaultMilestone()], active: true });
  };

  const startEdit = (pack: MilestonePack) => {
    setEditing({ ...pack, milestones: pack.milestones.map((m) => ({ ...m })) });
  };

  const handleSave = () => {
    if (!editing || !editing.name.trim()) return;
    onSave(editing);
    setEditing(null);
  };

  const updateMilestone = (idx: number, patch: Partial<Milestone>) => {
    if (!editing) return;
    const ms = [...editing.milestones];
    ms[idx] = { ...ms[idx], ...patch };
    setEditing({ ...editing, milestones: ms });
  };

  const removeMilestone = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, milestones: editing.milestones.filter((_, i) => i !== idx) });
  };

  const addMilestone = () => {
    if (!editing) return;
    setEditing({ ...editing, milestones: [...editing.milestones, defaultMilestone()] });
  };

  const exportPack = (pack: MilestonePack) => {
    navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
  };

  const importPack = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const pack = JSON.parse(text) as MilestonePack;
      if (pack.milestones && pack.name) {
        pack.id = uid();
        onSave(pack);
      }
    } catch { /* ignore bad clipboard data */ }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <select
            value={editing.emoji}
            onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
            className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-lg cursor-pointer"
          >
            {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <input
            type="text"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Pack name…"
            className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
          {editing.milestones.map((m, idx) => (
            <div key={m.id} className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={m.emoji}
                  onChange={(e) => updateMilestone(idx, { emoji: e.target.value })}
                  className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-1 py-0.5 text-base cursor-pointer"
                >
                  {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
                <input
                  type="text"
                  value={m.label}
                  onChange={(e) => updateMilestone(idx, { label: e.target.value })}
                  placeholder="Label"
                  className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-0.5 text-xs text-[var(--text-primary)]"
                />
                <button
                  onClick={() => play(m.sound)}
                  className="text-xs px-2 py-0.5 rounded border border-[var(--border-color)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                  title="Test sound"
                >
                  ▶
                </button>
                <button
                  onClick={() => removeMilestone(idx)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-red)] cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] block mb-0.5">Metric</label>
                  <select
                    value={m.metric}
                    onChange={(e) => updateMilestone(idx, { metric: e.target.value as Milestone['metric'] })}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-1 py-0.5 text-[10px] cursor-pointer text-[var(--text-primary)]"
                  >
                    {METRICS.map((mt) => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] block mb-0.5">Threshold</label>
                  <input
                    type="number"
                    value={m.threshold}
                    onChange={(e) => updateMilestone(idx, { threshold: Number(e.target.value) })}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-1 py-0.5 text-[10px] text-[var(--text-primary)]"
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] block mb-0.5">Effect</label>
                  <select
                    value={m.effect}
                    onChange={(e) => updateMilestone(idx, { effect: e.target.value as Milestone['effect'] })}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-1 py-0.5 text-[10px] cursor-pointer text-[var(--text-primary)]"
                  >
                    {EFFECTS.map((ef) => <option key={ef} value={ef}>{ef}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] block mb-0.5">Sound</label>
                <select
                  value={m.sound}
                  onChange={(e) => updateMilestone(idx, { sound: e.target.value as Milestone['sound'] })}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-1 py-0.5 text-[10px] cursor-pointer text-[var(--text-primary)]"
                >
                  {SOUNDS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addMilestone}
          className="self-start px-3 py-1.5 text-xs rounded border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
        >
          + Add Milestone
        </button>

        <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold rounded bg-[var(--accent-gold)] text-[var(--bg-primary)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            Save Pack
          </button>
          <button
            onClick={() => setEditing(null)}
            className="px-4 py-2 text-xs rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          onClick={startNew}
          className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--accent-purple)] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          + New Pack
        </button>
        <button
          onClick={importPack}
          className="px-3 py-1.5 text-xs rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent-gold)] hover:border-[var(--accent-gold)] transition-colors cursor-pointer"
        >
          📋 Import from Clipboard
        </button>
      </div>

      {packs.length === 0 && (
        <p className="text-xs text-[var(--text-secondary)] py-4">No milestone packs yet. Create one to add custom achievements!</p>
      )}

      {packs.map((pack) => (
        <div key={pack.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
          <span className="text-lg">{pack.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{pack.name}</div>
            <div className="text-[10px] text-[var(--text-secondary)]">{pack.milestones.length} milestone{pack.milestones.length !== 1 ? 's' : ''}</div>
          </div>
          <button
            onClick={() => onToggle(pack.id, !pack.active)}
            className={`px-2 py-0.5 text-[10px] rounded font-bold transition-colors cursor-pointer ${
              pack.active
                ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
            }`}
          >
            {pack.active ? 'ON' : 'OFF'}
          </button>
          <button onClick={() => startEdit(pack)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-gold)] cursor-pointer">✏️</button>
          <button onClick={() => exportPack(pack)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-blue)] cursor-pointer" title="Copy JSON">📋</button>
          <button onClick={() => onDelete(pack.id)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-red)] cursor-pointer">🗑️</button>
        </div>
      ))}
    </div>
  );
}

// ─── Sound Pack Editor ───

function SoundPackEditor({ packs, onSave, onDelete, onActivate }: {
  packs: SoundPack[];
  onSave: (p: SoundPack) => void;
  onDelete: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  const [editing, setEditing] = useState<SoundPack | null>(null);

  const startNew = () => {
    const slots: Partial<Record<SoundName, SoundConfig>> = {};
    for (const s of SOUND_SLOTS) slots[s] = defaultSoundConfig();
    setEditing({ id: uid(), name: '', slots, active: false });
  };

  const startEdit = (pack: SoundPack) => {
    const slots: Partial<Record<SoundName, SoundConfig>> = {};
    for (const s of SOUND_SLOTS) slots[s] = pack.slots[s] ? { ...pack.slots[s] } : defaultSoundConfig();
    setEditing({ ...pack, slots });
  };

  const handleSave = () => {
    if (!editing || !editing.name.trim()) return;
    onSave(editing);
    setEditing(null);
  };

  const updateSlot = (name: SoundName, patch: Partial<SoundConfig>) => {
    if (!editing) return;
    const slots = { ...editing.slots };
    slots[name] = { ...(slots[name] ?? defaultSoundConfig()), ...patch };
    setEditing({ ...editing, slots });
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={editing.name}
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          placeholder="Sound pack name…"
          className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)]"
        />

        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
          {SOUND_SLOTS.map((slotName) => {
            const cfg = editing.slots[slotName] ?? defaultSoundConfig();
            return (
              <div key={slotName} className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-[var(--accent-purple)]">{slotName}</span>
                  <button
                    onClick={() => previewSoundConfig(cfg)}
                    className="text-xs px-2 py-0.5 rounded border border-[var(--border-color)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                  >
                    ▶ Preview
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] block mb-0.5">Waveform</label>
                    <select
                      value={cfg.waveform}
                      onChange={(e) => updateSlot(slotName, { waveform: e.target.value as OscillatorType })}
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-1 py-0.5 text-[10px] cursor-pointer text-[var(--text-primary)]"
                    >
                      {WAVEFORMS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] block mb-0.5">Frequency: {cfg.frequency}Hz</label>
                    <input
                      type="range" min="50" max="2000" step="10" value={cfg.frequency}
                      onChange={(e) => updateSlot(slotName, { frequency: Number(e.target.value) })}
                      className="w-full accent-[var(--accent-gold)] h-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] block mb-0.5">Attack: {cfg.attack.toFixed(3)}s</label>
                    <input
                      type="range" min="0.001" max="0.5" step="0.001" value={cfg.attack}
                      onChange={(e) => updateSlot(slotName, { attack: Number(e.target.value) })}
                      className="w-full accent-[var(--accent-purple)] h-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] block mb-0.5">Decay: {cfg.decay.toFixed(2)}s</label>
                    <input
                      type="range" min="0.01" max="2" step="0.01" value={cfg.decay}
                      onChange={(e) => updateSlot(slotName, { decay: Number(e.target.value) })}
                      className="w-full accent-[var(--accent-blue)] h-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-[var(--text-secondary)] block mb-0.5">Gain: {Math.round(cfg.gain * 100)}%</label>
                    <input
                      type="range" min="0" max="1" step="0.01" value={cfg.gain}
                      onChange={(e) => updateSlot(slotName, { gain: Number(e.target.value) })}
                      className="w-full accent-[var(--accent-green)] h-1"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
          <button onClick={handleSave} className="px-4 py-2 text-xs font-bold rounded bg-[var(--accent-gold)] text-[var(--bg-primary)] hover:opacity-90 cursor-pointer">Save Pack</button>
          <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">Cancel</button>
        </div>
      </div>
    );
  }

  const activePack = packs.find((p) => p.active);

  return (
    <div className="flex flex-col gap-3">
      <button onClick={startNew} className="self-start px-3 py-1.5 text-xs font-medium rounded bg-[var(--accent-purple)] text-white hover:opacity-90 cursor-pointer">
        + New Sound Pack
      </button>

      {packs.length === 0 && (
        <p className="text-xs text-[var(--text-secondary)] py-4">No sound packs yet. Create one to customize all sound effects!</p>
      )}

      {packs.map((pack) => (
        <div key={pack.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
          <span className="text-lg">🔊</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{pack.name}</div>
            <div className="text-[10px] text-[var(--text-secondary)]">{Object.keys(pack.slots).length} slots configured</div>
          </div>
          <button
            onClick={() => onActivate(pack.id)}
            className={`px-2 py-0.5 text-[10px] rounded font-bold transition-colors cursor-pointer ${
              pack.active
                ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
            }`}
          >
            {pack.active ? 'ACTIVE' : 'USE'}
          </button>
          <button onClick={() => startEdit(pack)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-gold)] cursor-pointer">✏️</button>
          <button onClick={() => onDelete(pack.id)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-red)] cursor-pointer">🗑️</button>
        </div>
      ))}

      {activePack && (
        <button
          onClick={() => {
            SoundManager.getInstance().clearPack();
            // Deactivate all
            for (const p of packs) {
              if (p.active) window.packAPI?.saveSoundPack({ ...p, active: false });
            }
          }}
          className="self-start px-3 py-1.5 text-xs rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:border-[var(--accent-red)] transition-colors cursor-pointer"
        >
          Reset to Built-in Sounds
        </button>
      )}
    </div>
  );
}

// ─── Theme Pack Editor ───

function ThemePackEditor({ packs, onSave, onDelete }: {
  packs: ThemePack[];
  onSave: (p: ThemePack) => void;
  onDelete: (id: string) => void;
}) {
  const { setTheme } = useTheme();
  const [editing, setEditing] = useState<ThemePack | null>(null);

  const COLOR_KEYS: { key: keyof Theme['colors']; label: string }[] = [
    { key: 'bgPrimary', label: 'BG Primary' },
    { key: 'bgSecondary', label: 'BG Secondary' },
    { key: 'border', label: 'Border' },
    { key: 'textPrimary', label: 'Text Primary' },
    { key: 'textSecondary', label: 'Text Secondary' },
    { key: 'accentGold', label: 'Gold' },
    { key: 'accentPurple', label: 'Purple' },
    { key: 'accentBlue', label: 'Blue' },
    { key: 'accentGreen', label: 'Green' },
    { key: 'accentRed', label: 'Red' },
  ];

  const startNew = () => {
    setEditing({
      id: uid(),
      name: `custom-${uid()}`,
      label: '',
      colors: {
        bgPrimary: '#0d1117', bgSecondary: '#161b22', border: '#30363d',
        textPrimary: '#e6edf3', textSecondary: '#8b949e',
        accentGold: '#fbbf24', accentPurple: '#a855f7', accentBlue: '#3b82f6',
        accentGreen: '#3fb950', accentRed: '#f85149',
      },
      effects: { neonGlow: false, particles: false },
    });
  };

  const startEdit = (pack: ThemePack) => {
    setEditing({ ...pack, colors: { ...pack.colors }, effects: { ...pack.effects } });
  };

  const handleSave = () => {
    if (!editing || !editing.label.trim()) return;
    onSave(editing);
    // Register immediately so user can switch to it
    registerTheme({ ...editing, isUserTheme: true });
    setEditing(null);
  };

  const applyPreview = () => {
    if (!editing) return;
    const name = `preview-${editing.id}`;
    registerTheme({ ...editing, name, isUserTheme: true });
    setTheme(name);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={editing.label}
          onChange={(e) => setEditing({ ...editing, label: e.target.value })}
          placeholder="Theme name…"
          className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)]"
        />

        <div className="grid grid-cols-2 gap-3">
          {COLOR_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={editing.colors[key]}
                onChange={(e) => setEditing({ ...editing, colors: { ...editing.colors, [key]: e.target.value } })}
                className="w-7 h-7 rounded border border-[var(--border-color)] cursor-pointer"
              />
              <span className="text-[10px] text-[var(--text-secondary)]">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={editing.effects.neonGlow}
              onChange={(e) => setEditing({ ...editing, effects: { ...editing.effects, neonGlow: e.target.checked } })}
            />
            Neon Glow
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={editing.effects.particles}
              onChange={(e) => setEditing({ ...editing, effects: { ...editing.effects, particles: e.target.checked } })}
            />
            Particles
          </label>
        </div>

        {/* Preview swatch */}
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: editing.colors.border }}>
          <div className="p-3 flex items-center gap-2" style={{ backgroundColor: editing.colors.bgSecondary }}>
            <span className="text-sm font-bold" style={{ color: editing.colors.accentGold }}>PREVIEW</span>
            <span className="text-[10px]" style={{ color: editing.colors.textSecondary }}>sample theme</span>
          </div>
          <div className="p-3 flex gap-2" style={{ backgroundColor: editing.colors.bgPrimary }}>
            {[editing.colors.accentGold, editing.colors.accentPurple, editing.colors.accentBlue, editing.colors.accentGreen, editing.colors.accentRed].map((c, i) => (
              <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="px-3 py-2" style={{ backgroundColor: editing.colors.bgPrimary }}>
            <p className="text-xs" style={{ color: editing.colors.textPrimary }}>Primary text example</p>
            <p className="text-[10px]" style={{ color: editing.colors.textSecondary }}>Secondary text example</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
          <button onClick={handleSave} className="px-4 py-2 text-xs font-bold rounded bg-[var(--accent-gold)] text-[var(--bg-primary)] hover:opacity-90 cursor-pointer">Save Theme</button>
          <button onClick={applyPreview} className="px-4 py-2 text-xs rounded border border-[var(--accent-purple)] text-[var(--accent-purple)] hover:opacity-90 cursor-pointer">Preview Live</button>
          <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={startNew} className="self-start px-3 py-1.5 text-xs font-medium rounded bg-[var(--accent-purple)] text-white hover:opacity-90 cursor-pointer">
        + New Theme
      </button>

      {packs.length === 0 && (
        <p className="text-xs text-[var(--text-secondary)] py-4">No custom themes yet. Create your own color scheme!</p>
      )}

      {packs.map((pack) => (
        <div key={pack.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
          <div className="flex gap-0.5">
            {[pack.colors.accentGold, pack.colors.accentPurple, pack.colors.accentBlue].map((c, i) => (
              <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{pack.label}</div>
          </div>
          <button
            onClick={() => {
              registerTheme({ ...pack, isUserTheme: true });
              setTheme(pack.name);
            }}
            className="px-2 py-0.5 text-[10px] rounded font-bold bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
          >
            Apply
          </button>
          <button onClick={() => startEdit(pack)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-gold)] cursor-pointer">✏️</button>
          <button
            onClick={() => {
              removeUserTheme(pack.name);
              onDelete(pack.id);
            }}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-red)] cursor-pointer"
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Pack Studio ───

export default function PackStudio({ isOpen, onClose }: PackStudioProps) {
  const [tab, setTab] = useState<Tab>('milestones');
  const [milestonePacks, setMilestonePacks] = useState<MilestonePack[]>([]);
  const [soundPacks, setSoundPacks] = useState<SoundPack[]>([]);
  const [themePacks, setThemePacks] = useState<ThemePack[]>([]);

  // Load packs on open
  useEffect(() => {
    if (!isOpen) return;
    window.packAPI?.listMilestonePacks().then(setMilestonePacks);
    window.packAPI?.listSoundPacks().then(setSoundPacks);
    window.packAPI?.listThemePacks().then(setThemePacks);
  }, [isOpen]);

  // Sync milestone packs to the milestone system whenever they change
  useEffect(() => {
    setUserMilestonePacks(milestonePacks);
  }, [milestonePacks]);

  // ── Milestone handlers ──
  const handleMilestoneSave = useCallback((pack: MilestonePack) => {
    window.packAPI?.saveMilestonePack(pack);
    setMilestonePacks((prev) => {
      const idx = prev.findIndex((p) => p.id === pack.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = pack; return next; }
      return [...prev, pack];
    });
    partyBus.emit(PartyEvents.PACK_SAVED, 'milestone', pack);
  }, []);

  const handleMilestoneDelete = useCallback((id: string) => {
    window.packAPI?.deleteMilestonePack(id);
    setMilestonePacks((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleMilestoneToggle = useCallback((id: string, active: boolean) => {
    window.packAPI?.setMilestonePackActive(id, active);
    setMilestonePacks((prev) => prev.map((p) => p.id === id ? { ...p, active } : p));
    partyBus.emit(PartyEvents.PACK_ACTIVATED, 'milestone', id, active);
  }, []);

  // ── Sound handlers ──
  const handleSoundSave = useCallback((pack: SoundPack) => {
    window.packAPI?.saveSoundPack(pack);
    setSoundPacks((prev) => {
      const idx = prev.findIndex((p) => p.id === pack.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = pack; return next; }
      return [...prev, pack];
    });
  }, []);

  const handleSoundDelete = useCallback((id: string) => {
    window.packAPI?.deleteSoundPack(id);
    setSoundPacks((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleSoundActivate = useCallback((id: string) => {
    window.packAPI?.setSoundPackActive(id);
    setSoundPacks((prev) => prev.map((p) => ({ ...p, active: p.id === id })));
    const pack = soundPacks.find((p) => p.id === id);
    if (pack) SoundManager.getInstance().loadPack(pack.slots);
    partyBus.emit(PartyEvents.PACK_ACTIVATED, 'sound', id);
  }, [soundPacks]);

  // ── Theme handlers ──
  const handleThemeSave = useCallback((pack: ThemePack) => {
    window.packAPI?.saveThemePack(pack);
    setThemePacks((prev) => {
      const idx = prev.findIndex((p) => p.id === pack.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = pack; return next; }
      return [...prev, pack];
    });
  }, []);

  const handleThemeDelete = useCallback((id: string) => {
    window.packAPI?.deleteThemePack(id);
    setThemePacks((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'milestones', label: 'Milestones', emoji: '🏆' },
    { id: 'sounds', label: 'Sounds', emoji: '🔊' },
    { id: 'themes', label: 'Themes', emoji: '🎨' },
  ];

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
            className="fixed top-0 right-0 z-50 h-full w-[480px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col overflow-hidden"
            initial={{ x: 480 }}
            animate={{ x: 0 }}
            exit={{ x: 480 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
              <h2 className="text-xl font-bold tracking-widest text-[var(--accent-gold)] led-text">
                🎨 PACK STUDIO
              </h2>
              <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none cursor-pointer">
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border-color)]">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    tab === t.id
                      ? 'text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)] bg-[var(--bg-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-5 overflow-y-auto">
              {tab === 'milestones' && (
                <MilestonePackEditor
                  packs={milestonePacks}
                  onSave={handleMilestoneSave}
                  onDelete={handleMilestoneDelete}
                  onToggle={handleMilestoneToggle}
                />
              )}
              {tab === 'sounds' && (
                <SoundPackEditor
                  packs={soundPacks}
                  onSave={handleSoundSave}
                  onDelete={handleSoundDelete}
                  onActivate={handleSoundActivate}
                />
              )}
              {tab === 'themes' && (
                <ThemePackEditor
                  packs={themePacks}
                  onSave={handleThemeSave}
                  onDelete={handleThemeDelete}
                />
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-color)] text-center text-[10px] text-[var(--text-secondary)]">
              Packs are saved locally and persist across sessions. Export as JSON to share!
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
