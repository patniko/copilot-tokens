// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionBrowser from './SessionBrowser';

// Mock motion/react to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_target: any, prop: string) => {
      // Return a forwardRef component for any HTML element
      return (props: any) => {
        const { children, ...rest } = props;
        const Component = prop as any;
        return <Component {...rest}>{children}</Component>;
      };
    },
  }),
  AnimatePresence: ({ children }: any) => children,
}));

function makeSession(overrides: any = {}) {
  return {
    timestamp: Date.now(),
    cwd: '/Users/testuser/projects/myapp',
    inputTokens: 5000,
    outputTokens: 3000,
    messagesCount: 10,
    filesChanged: 3,
    toolCalls: 7,
    durationMs: 125_000,
    ...overrides,
  };
}

describe('SessionBrowser', () => {
  beforeEach(() => {
    // Mock window APIs
    (window as any).statsAPI = {
      getAllSessions: vi.fn().mockResolvedValue([]),
    };
    (window as any).sessionsAPI = undefined;
  });

  it('renders loading state initially', () => {
    // Make getAllSessions never resolve to keep loading state
    (window as any).statsAPI.getAllSessions = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Loading sessions…')).toBeInTheDocument();
  });

  it('shows empty state when no sessions', async () => {
    (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([]);
    render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText('No past sessions found')).toBeInTheDocument();
  });

  describe('formatting helpers (tested via rendered output)', () => {
    it('formats duration as minutes and seconds', async () => {
      const session = makeSession({ durationMs: 125_000 }); // 2m 5s
      (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([session]);
      render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(await screen.findByText(/2m 5s/)).toBeInTheDocument();
    });

    it('formats short duration as seconds only', async () => {
      const session = makeSession({ durationMs: 45_000 }); // 45s
      (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([session]);
      render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(await screen.findByText(/45s/)).toBeInTheDocument();
    });

    it('formats duration with no remaining seconds', async () => {
      const session = makeSession({ durationMs: 120_000 }); // exactly 2m
      (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([session]);
      render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(await screen.findByText(/2m$/)).toBeInTheDocument();
    });

    it('formats tokens in K notation', async () => {
      const session = makeSession({ inputTokens: 5000, outputTokens: 3000 }); // 8.0K
      (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([session]);
      render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(await screen.findByText(/8\.0K/)).toBeInTheDocument();
    });

    it('formats tokens in M notation for millions', async () => {
      const session = makeSession({ inputTokens: 500_000, outputTokens: 750_000 }); // 1.3M
      (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([session]);
      render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(await screen.findByText(/1\.3M/)).toBeInTheDocument();
    });

    it('formats small token counts as plain numbers', async () => {
      const session = makeSession({ inputTokens: 500, outputTokens: 200 }); // 700
      (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([session]);
      render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(await screen.findByText(/700/)).toBeInTheDocument();
    });

    it('shortens paths by replacing /Users/xxx with ~', async () => {
      const session = makeSession({ cwd: '/Users/testuser/projects/myapp' });
      (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([session]);
      render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(await screen.findByText(/~\/projects\/myapp/)).toBeInTheDocument();
    });

    it('displays date as Today for current-day sessions', async () => {
      const session = makeSession({ timestamp: Date.now() });
      (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([session]);
      render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(await screen.findByText(/Today/)).toBeInTheDocument();
    });

    it('displays date as Yesterday for yesterday sessions', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(14, 30, 0, 0);
      const session = makeSession({ timestamp: yesterday.getTime() });
      (window as any).statsAPI.getAllSessions = vi.fn().mockResolvedValue([session]);
      render(<SessionBrowser onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(await screen.findByText(/Yesterday/)).toBeInTheDocument();
    });
  });
});
