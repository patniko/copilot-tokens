import type { Milestone } from './milestones';
import type { SoundName } from './sound-manager';
import type { Theme } from './themes';

// ── Milestone Packs ──

export interface MilestonePack {
  id: string;
  name: string;
  emoji: string;
  milestones: Milestone[];
  active: boolean;
}

// ── Sound Packs ──

export interface SoundConfig {
  waveform: OscillatorType;
  frequency: number;
  attack: number;   // seconds
  decay: number;    // seconds
  gain: number;     // 0–1
  filterFreq?: number;
  filterType?: BiquadFilterType;
}

export interface SoundPack {
  id: string;
  name: string;
  slots: Partial<Record<SoundName, SoundConfig>>;
  active: boolean;
}

// ── Theme Packs ──

export interface ThemePack {
  id: string;
  name: string;
  label: string;
  colors: Theme['colors'];
  effects: Theme['effects'];
}

// ── Store schema ──

export interface PackStoreSchema {
  milestonePacks: MilestonePack[];
  soundPacks: SoundPack[];
  themePacks: ThemePack[];
}
