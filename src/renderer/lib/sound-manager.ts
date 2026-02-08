export type SoundName = 'leverPull' | 'tokenTick' | 'milestone' | 'jackpot' | 'commit' | 'error';

type SoundGenerator = (ctx: AudioContext, dest: GainNode) => void;

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

  private constructor() {}

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
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
    sounds[sound](ctx, this.masterGain!);
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
