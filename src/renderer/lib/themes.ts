import { createContext, createElement, useEffect, useState, type ReactNode } from 'react';

export interface Theme {
  name: 'neon-arcade' | 'retro-casino' | 'minimal';
  label: string;
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accentGold: string;
    accentPurple: string;
    accentBlue: string;
    accentGreen: string;
    accentRed: string;
  };
  effects: {
    neonGlow: boolean;
    particles: boolean;
  };
}

export const themes: Record<Theme['name'], Theme> = {
  'neon-arcade': {
    name: 'neon-arcade',
    label: 'Neon Arcade',
    colors: {
      bgPrimary: '#0d1117',
      bgSecondary: '#161b22',
      border: '#30363d',
      textPrimary: '#e6edf3',
      textSecondary: '#8b949e',
      accentGold: '#fbbf24',
      accentPurple: '#a855f7',
      accentBlue: '#3b82f6',
      accentGreen: '#3fb950',
      accentRed: '#f85149',
    },
    effects: { neonGlow: true, particles: true },
  },
  'retro-casino': {
    name: 'retro-casino',
    label: 'Retro Casino',
    colors: {
      bgPrimary: '#1a0a0a',
      bgSecondary: '#2d1515',
      border: '#5c2020',
      textPrimary: '#ffd700',
      textSecondary: '#cc9900',
      accentGold: '#ffd700',
      accentPurple: '#a855f7',
      accentBlue: '#3b82f6',
      accentGreen: '#3fb950',
      accentRed: '#dc2626',
    },
    effects: { neonGlow: false, particles: true },
  },
  minimal: {
    name: 'minimal',
    label: 'Minimal',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f5f5f5',
      border: '#e5e7eb',
      textPrimary: '#1f2937',
      textSecondary: '#6b7280',
      accentGold: '#2563eb',
      accentPurple: '#7c3aed',
      accentBlue: '#2563eb',
      accentGreen: '#16a34a',
      accentRed: '#dc2626',
    },
    effects: { neonGlow: false, particles: false },
  },
};

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (name: Theme['name']) => void;
  themes: typeof themes;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: themes['neon-arcade'],
  setTheme: () => {},
  themes,
});

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--bg-primary', c.bgPrimary);
  root.style.setProperty('--bg-secondary', c.bgSecondary);
  root.style.setProperty('--border-color', c.border);
  root.style.setProperty('--text-primary', c.textPrimary);
  root.style.setProperty('--text-secondary', c.textSecondary);
  root.style.setProperty('--accent-gold', c.accentGold);
  root.style.setProperty('--accent-purple', c.accentPurple);
  root.style.setProperty('--accent-blue', c.accentBlue);
  root.style.setProperty('--accent-green', c.accentGreen);
  root.style.setProperty('--accent-red', c.accentRed);

  if (theme.effects.neonGlow) {
    root.style.setProperty(
      '--neon-glow',
      `0 0 10px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.2)`,
    );
  } else {
    root.style.setProperty('--neon-glow', 'none');
  }

  root.setAttribute('data-theme', theme.name);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(themes['neon-arcade']);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (name: Theme['name']) => {
    const next = themes[name];
    if (next) setThemeState(next);
  };

  return createElement(
    ThemeContext.Provider,
    { value: { theme, setTheme, themes } },
    children,
  );
}
