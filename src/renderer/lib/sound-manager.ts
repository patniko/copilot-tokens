export type SoundName = 'leverPull' | 'tokenTick' | 'milestone' | 'jackpot' | 'commit' | 'error' | 'celebration100k' | 'celebration500k';

type SoundGenerator = (ctx: AudioContext, dest: GainNode) => void;

export interface SoundConfig {
  waveform: OscillatorType;
  frequency: number;
  attack: number;
  decay: number;
  gain: number;
  filterFreq?: number;
  filterType?: BiquadFilterType;
}

/** Create a SoundGenerator from a simple SoundConfig descriptor */
export function generatorFromConfig(cfg: SoundConfig): SoundGenerator {
  return (ctx, dest) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = cfg.waveform;
    osc.frequency.value = cfg.frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(cfg.gain, t + cfg.attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.attack + cfg.decay);

    let node: AudioNode = osc;
    if (cfg.filterFreq && cfg.filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = cfg.filterType;
      filter.frequency.value = cfg.filterFreq;
      osc.connect(filter);
      node = filter;
    }
    node.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + cfg.attack + cfg.decay + 0.01);
  };
}

/** Preview a SoundConfig directly (used by Pack Studio) */
export function previewSoundConfig(cfg: SoundConfig): void {
  const ctx = new AudioContext();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);
  generatorFromConfig(cfg)(ctx, masterGain);
}

const sounds: Record<SoundName, SoundGenerator> = {
  // Short mechanical click — quick burst of noise, slight pitch down
  leverPull(ctx, dest) {
    const t = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.linearRampToValueAtTime(800, t + 0.05);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noise.connect(filter).connect(gain).connect(dest);
    noise.start(t);
    noise.stop(t + 0.05);
  },

  // Soft tick — very short sine wave blip at ~800Hz
  tokenTick(ctx, dest) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.02);
  },

  // Ascending chime — 3 sine wave notes (C5, E5, G5), each 100ms
  milestone(ctx, dest) {
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const start = t + i * 0.1;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

      osc.connect(gain).connect(dest);
      osc.start(start);
      osc.stop(start + 0.1);
    });
  },

  // Slot machine bells — rapid alternating high notes (5 notes), 500ms total
  jackpot(ctx, dest) {
    const t = ctx.currentTime;
    const freqs = [1200, 1500, 1200, 1500, 1800];
    const noteDuration = 0.1;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const start = t + i * noteDuration;
      gain.gain.setValueAtTime(0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);

      osc.connect(gain).connect(dest);
      osc.start(start);
      osc.stop(start + noteDuration);
    });
  },

  // Cash register "cha-ching" — metallic noise burst + ascending tone
  commit(ctx, dest) {
    const t = ctx.currentTime;

    // Metallic noise burst
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter).connect(noiseGain).connect(dest);
    noise.start(t);
    noise.stop(t + 0.08);

    // Ascending tone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t + 0.05);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.2);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.4, t + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(oscGain).connect(dest);
    osc.start(t + 0.05);
    osc.stop(t + 0.25);
  },

  // 100K celebration — triumphant fanfare: C5-E5-G5-C6 arpeggiated with harmonics + shimmer
  celebration100k(ctx, dest) {
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const start = t + i * 0.12;
      // Main tone
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
      gain.gain.setValueAtTime(0.35, start + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain).connect(dest);
      osc.start(start);
      osc.stop(start + 0.5);

      // Harmonic overtone
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2;
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0, start);
      gain2.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc2.connect(gain2).connect(dest);
      osc2.start(start);
      osc2.stop(start + 0.35);
    });

    // Final shimmer chord (all notes together)
    const chordStart = t + 0.55;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, chordStart);
      gain.gain.linearRampToValueAtTime(0.2, chordStart + 0.03);
      gain.gain.setValueAtTime(0.2, chordStart + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.8);
      osc.connect(gain).connect(dest);
      osc.start(chordStart);
      osc.stop(chordStart + 0.8);
    });
  },

  // 500K celebration — epic orchestral: rising sweep + fanfare + bell tower finale
  celebration500k(ctx, dest) {
    const t = ctx.currentTime;

    // Rising sweep
    const sweep = ctx.createOscillator();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(200, t);
    sweep.frequency.exponentialRampToValueAtTime(1200, t + 0.6);
    const sweepFilter = ctx.createBiquadFilter();
    sweepFilter.type = 'lowpass';
    sweepFilter.frequency.setValueAtTime(400, t);
    sweepFilter.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
    const sweepGain = ctx.createGain();
    sweepGain.gain.setValueAtTime(0.2, t);
    sweepGain.gain.linearRampToValueAtTime(0.35, t + 0.5);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    sweep.connect(sweepFilter).connect(sweepGain).connect(dest);
    sweep.start(t);
    sweep.stop(t + 0.7);

    // Fanfare notes: Bb4-D5-F5-Bb5-D6
    const fanfare = [466.16, 587.33, 698.46, 932.33, 1174.66];
    fanfare.forEach((freq, i) => {
      const start = t + 0.6 + i * 0.1;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.setValueAtTime(0.2, start + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000;
      osc.connect(filter).connect(gain).connect(dest);
      osc.start(start);
      osc.stop(start + 0.4);
    });

    // Bell tower finale — 3 layered bell strikes
    [0, 0.2, 0.4].forEach((delay, i) => {
      const bellStart = t + 1.2 + delay;
      const freq = [1046.5, 1318.5, 1568][i]; // C6, E6, G6
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Bell-like decay
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, bellStart);
      gain.gain.exponentialRampToValueAtTime(0.001, bellStart + 1.0);
      // Slight detuned second oscillator for richness
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 1.002;
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.25, bellStart);
      gain2.gain.exponentialRampToValueAtTime(0.001, bellStart + 0.8);
      osc.connect(gain).connect(dest);
      osc2.connect(gain2).connect(dest);
      osc.start(bellStart);
      osc.stop(bellStart + 1.0);
      osc2.start(bellStart);
      osc2.stop(bellStart + 0.8);
    });
  },

  // Low buzz — 200ms sawtooth wave at 150Hz
  error(ctx, dest) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 150;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.setValueAtTime(0.3, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  },
};

class SoundManager {
  private static instance: SoundManager;
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.5;
  private masterGain: GainNode | null = null;

  private overrides: Partial<Record<SoundName, SoundGenerator>> = {};

  private constructor() {}

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /** Load a sound pack — overrides specified slots with config-based generators */
  loadPack(slots: Partial<Record<SoundName, SoundConfig>>): void {
    this.overrides = {};
    for (const [name, cfg] of Object.entries(slots) as [SoundName, SoundConfig][]) {
      if (cfg) this.overrides[name] = generatorFromConfig(cfg);
    }
  }

  /** Clear any loaded pack, revert to built-in sounds */
  clearPack(): void {
    this.overrides = {};
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  play(sound: SoundName): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const generator = this.overrides[sound] ?? sounds[sound];
    generator(ctx, this.masterGain!);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }
}

export default SoundManager;
