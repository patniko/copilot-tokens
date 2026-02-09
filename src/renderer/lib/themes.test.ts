import { describe, it, expect, afterEach } from 'vitest';
import {
  themes,
  registerTheme,
  removeUserTheme,
  type Theme,
} from './themes';

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    name: 'test-theme',
    label: 'Test Theme',
    colors: {
      bgPrimary: '#000',
      bgSecondary: '#111',
      border: '#222',
      textPrimary: '#fff',
      textSecondary: '#aaa',
      accentGold: '#ffd700',
      accentPurple: '#a855f7',
      accentBlue: '#3b82f6',
      accentGreen: '#3fb950',
      accentRed: '#f85149',
    },
    effects: { neonGlow: false, particles: false },
    ...overrides,
  };
}

describe('themes', () => {
  afterEach(() => {
    // Clean up any test themes
    delete themes['test-theme'];
    delete themes['user-custom'];
  });

  describe('built-in themes', () => {
    it('includes neon-arcade, retro-casino, and minimal', () => {
      expect(themes['neon-arcade']).toBeDefined();
      expect(themes['retro-casino']).toBeDefined();
      expect(themes['minimal']).toBeDefined();
    });

    it('each built-in theme has required color properties', () => {
      const requiredColors = [
        'bgPrimary', 'bgSecondary', 'border',
        'textPrimary', 'textSecondary',
        'accentGold', 'accentPurple', 'accentBlue', 'accentGreen', 'accentRed',
      ] as const;

      for (const theme of Object.values(themes)) {
        for (const color of requiredColors) {
          expect(theme.colors[color]).toBeTruthy();
        }
      }
    });

    it('each built-in theme has name matching its key', () => {
      for (const [key, theme] of Object.entries(themes)) {
        expect(theme.name).toBe(key);
      }
    });
  });

  describe('registerTheme', () => {
    it('adds a new theme to the registry', () => {
      const theme = makeTheme();
      registerTheme(theme);
      expect(themes['test-theme']).toBe(theme);
    });

    it('overwrites an existing theme with the same name', () => {
      const theme1 = makeTheme({ label: 'First' });
      const theme2 = makeTheme({ label: 'Second' });
      registerTheme(theme1);
      registerTheme(theme2);
      expect(themes['test-theme'].label).toBe('Second');
    });
  });

  describe('removeUserTheme', () => {
    it('removes a theme marked as isUserTheme', () => {
      const theme = makeTheme({ name: 'user-custom', isUserTheme: true });
      registerTheme(theme);
      expect(themes['user-custom']).toBeDefined();
      removeUserTheme('user-custom');
      expect(themes['user-custom']).toBeUndefined();
    });

    it('does not remove a built-in theme', () => {
      removeUserTheme('neon-arcade');
      expect(themes['neon-arcade']).toBeDefined();
    });

    it('does not remove a non-user theme even if registered', () => {
      const theme = makeTheme({ name: 'test-theme', isUserTheme: false });
      registerTheme(theme);
      removeUserTheme('test-theme');
      expect(themes['test-theme']).toBeDefined();
    });

    it('is a no-op for non-existent theme names', () => {
      expect(() => removeUserTheme('nonexistent')).not.toThrow();
    });
  });
});
