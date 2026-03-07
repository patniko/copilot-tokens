import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockAudioContext() {
  const mockGainNode = {
    gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn().mockReturnThis(),
  };
  const mockOscillator = {
    type: 'sine',
    frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn().mockReturnValue(mockGainNode),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const mockFilter = {
    type: 'lowpass',
    frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    Q: { value: 0 },
    connect: vi.fn().mockReturnValue(mockGainNode),
  };
  const mockBufferSource = {
    buffer: null,
    connect: vi.fn().mockReturnValue(mockFilter),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const mockBuffer = {
    getChannelData: vi.fn().mockReturnValue(new Float32Array(4410)),
  };
  const mockWaveShaper = {
    curve: null,
    connect: vi.fn().mockReturnValue(mockGainNode),
  };

  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: {},
    createOscillator: vi.fn().mockReturnValue(mockOscillator),
    createGain: vi.fn().mockReturnValue(mockGainNode),
    createBiquadFilter: vi.fn().mockReturnValue(mockFilter),
    createBufferSource: vi.fn().mockReturnValue(mockBufferSource),
    createBuffer: vi.fn().mockReturnValue(mockBuffer),
    createWaveShaper: vi.fn().mockReturnValue(mockWaveShaper),
    resume: vi.fn(),
  };
  return { ctx, mockGainNode, mockOscillator, mockFilter };
}

let savedAudioContext: typeof globalThis.AudioContext | undefined;
let latestMockCtx: ReturnType<typeof createMockAudioContext>['ctx'];

beforeEach(() => {
  vi.resetModules();
  savedAudioContext = globalThis.AudioContext;
  const { ctx } = createMockAudioContext();
  latestMockCtx = ctx;
  // Use a real function (not arrow) so `new` works as a constructor
  function MockAudioContext(this: unknown) {
    return Object.assign(this ?? {}, ctx);
  }
  MockAudioContext.prototype = ctx;
  globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;
});

afterEach(() => {
  if (savedAudioContext !== undefined) {
    globalThis.AudioContext = savedAudioContext;
  } else {
    // @ts-expect-error -- restoring undefined in jsdom
    delete globalThis.AudioContext;
  }
});

describe('generatorFromConfig', () => {
  it('returns a function', async () => {
    const { generatorFromConfig } = await import('./sound-manager');
    const gen = generatorFromConfig({
      waveform: 'sine',
      frequency: 440,
      attack: 0.01,
      decay: 0.1,
      gain: 0.5,
    });
    expect(typeof gen).toBe('function');
  });

  it('returned function calls AudioContext APIs', async () => {
    const { generatorFromConfig } = await import('./sound-manager');
    const gen = generatorFromConfig({
      waveform: 'square',
      frequency: 880,
      attack: 0.02,
      decay: 0.2,
      gain: 0.4,
    });

    const { ctx, mockOscillator, mockGainNode } = createMockAudioContext();
    gen(ctx as unknown as AudioContext, mockGainNode as unknown as GainNode);

    expect(ctx.createOscillator).toHaveBeenCalled();
    expect(ctx.createGain).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
    expect(mockOscillator.stop).toHaveBeenCalled();
    expect(mockOscillator.type).toBe('square');
    expect(mockOscillator.frequency.value).toBe(880);
  });

  it('creates BiquadFilter when filterFreq and filterType are set', async () => {
    const { generatorFromConfig } = await import('./sound-manager');
    const gen = generatorFromConfig({
      waveform: 'sine',
      frequency: 440,
      attack: 0.01,
      decay: 0.1,
      gain: 0.5,
      filterFreq: 2000,
      filterType: 'lowpass',
    });

    const { ctx, mockGainNode } = createMockAudioContext();
    gen(ctx as unknown as AudioContext, mockGainNode as unknown as GainNode);

    expect(ctx.createBiquadFilter).toHaveBeenCalled();
  });

  it('does not create BiquadFilter when no filter options', async () => {
    const { generatorFromConfig } = await import('./sound-manager');
    const gen = generatorFromConfig({
      waveform: 'sine',
      frequency: 440,
      attack: 0.01,
      decay: 0.1,
      gain: 0.5,
    });

    const { ctx, mockGainNode } = createMockAudioContext();
    gen(ctx as unknown as AudioContext, mockGainNode as unknown as GainNode);

    expect(ctx.createBiquadFilter).not.toHaveBeenCalled();
  });
});

describe('SoundManager', () => {
  it('getInstance returns the same instance', async () => {
    const { default: SoundManager } = await import('./sound-manager');
    const a = SoundManager.getInstance();
    const b = SoundManager.getInstance();
    expect(a).toBe(b);
  });

  it('play() triggers sound when enabled', async () => {
    const { default: SoundManager } = await import('./sound-manager');
    const mgr = SoundManager.getInstance();
    // Enabled by default — should not throw
    expect(() => mgr.play('tokenTick')).not.toThrow();
    // AudioContext was used — verify createOscillator was called on the mock
    expect(latestMockCtx.createOscillator).toHaveBeenCalled();
  });

  it('play() is a no-op when disabled', async () => {
    const { default: SoundManager } = await import('./sound-manager');
    const mgr = SoundManager.getInstance();
    mgr.setEnabled(false);
    mgr.play('tokenTick');
    // AudioContext should never be used when disabled
    expect(latestMockCtx.createOscillator).not.toHaveBeenCalled();
  });

  it('setEnabled / isEnabled toggles correctly', async () => {
    const { default: SoundManager } = await import('./sound-manager');
    const mgr = SoundManager.getInstance();
    expect(mgr.isEnabled()).toBe(true);
    mgr.setEnabled(false);
    expect(mgr.isEnabled()).toBe(false);
    mgr.setEnabled(true);
    expect(mgr.isEnabled()).toBe(true);
  });

  it('setVolume / getVolume works', async () => {
    const { default: SoundManager } = await import('./sound-manager');
    const mgr = SoundManager.getInstance();
    mgr.setVolume(0.8);
    expect(mgr.getVolume()).toBe(0.8);
  });

  it('setVolume clamps negative values to 0', async () => {
    const { default: SoundManager } = await import('./sound-manager');
    const mgr = SoundManager.getInstance();
    mgr.setVolume(-0.5);
    expect(mgr.getVolume()).toBe(0);
  });

  it('setVolume clamps values above 1 to 1', async () => {
    const { default: SoundManager } = await import('./sound-manager');
    const mgr = SoundManager.getInstance();
    mgr.setVolume(2);
    expect(mgr.getVolume()).toBe(1);
  });

  it('loadPack overrides specific sound slots', async () => {
    const { default: SoundManager, generatorFromConfig } = await import('./sound-manager');
    const mgr = SoundManager.getInstance();

    const customConfig = {
      waveform: 'triangle' as OscillatorType,
      frequency: 999,
      attack: 0.05,
      decay: 0.3,
      gain: 0.7,
    };

    mgr.loadPack({ tokenTick: customConfig });
    // Playing should use the overridden generator, not throw
    expect(() => mgr.play('tokenTick')).not.toThrow();

    // Other sounds should still work (use built-in)
    expect(() => mgr.play('error')).not.toThrow();
  });

  it('clearPack reverts to built-in sounds', async () => {
    const { default: SoundManager } = await import('./sound-manager');
    const mgr = SoundManager.getInstance();

    mgr.loadPack({
      tokenTick: {
        waveform: 'triangle',
        frequency: 999,
        attack: 0.05,
        decay: 0.3,
        gain: 0.7,
      },
    });
    mgr.clearPack();

    // After clearing, play should use the built-in sound without issue
    expect(() => mgr.play('tokenTick')).not.toThrow();
  });
});
