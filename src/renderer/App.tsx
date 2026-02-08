import { useState, useCallback, useEffect } from 'react';
import { ThemeProvider } from './lib/themes';
import PromptBar from './components/PromptBar';
import TokenDashboard from './components/TokenDashboard';
import type { DashboardStats } from './components/TokenDashboard';
import Leaderboard from './components/Leaderboard';
import Settings from './components/Settings';
import ReelArea from './components/ReelArea';
import CommitButton from './components/CommitButton';
import MilestoneOverlay from './components/MilestoneOverlay';
import { useMilestones } from './hooks/useMilestones';

export default function App() {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userPrompt, setUserPrompt] = useState<string | null>(null);
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [inputTokens, setInputTokens] = useState(0);
  const [cwd, setCwd] = useState('');
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const { activeMilestone, checkStats, dismissMilestone } = useMilestones();

  // Load CWD + git info on mount
  useEffect(() => {
    if (!window.cwdAPI) return;
    window.cwdAPI.get().then((dir) => {
      if (dir) {
        setCwd(dir);
        window.cwdAPI.gitInfo(dir).then((info) => {
          setGitBranch(info.isRepo ? (info.branch ?? null) : null);
        });
      }
    });
  }, []);

  const refreshGitInfo = useCallback((dir: string) => {
    setCwd(dir);
    if (window.cwdAPI) {
      window.cwdAPI.gitInfo(dir).then((info) => {
        setGitBranch(info.isRepo ? (info.branch ?? null) : null);
      });
    }
  }, []);

  const handleBrowseCwd = useCallback(async () => {
    if (!window.cwdAPI) return;
    const dir = await window.cwdAPI.browse();
    if (dir) refreshGitInfo(dir);
  }, [refreshGitInfo]);

  const handleStatsUpdate = useCallback(
    (stats: DashboardStats) => { checkStats(stats); },
    [checkStats],
  );

  const handleUsage = useCallback((input: number, _output: number) => {
    setInputTokens((prev) => prev + input);
  }, []);

  // Track changed files from copilot events
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const unsub = window.copilotAPI.onEvent((event: unknown) => {
      const ev = event as Record<string, unknown> | null;
      if (!ev || typeof ev !== 'object') return;
      // Handle both old and new event shapes for file tracking
      if (ev.type === 'tool.start') {
        const toolName = ev.toolName as string | undefined;
        const args = (ev.args ?? {}) as Record<string, unknown>;
        if (toolName === 'edit' || toolName === 'create' || toolName === 'write') {
          const filePath = String(args.path ?? args.file ?? '');
          if (filePath) {
            setChangedFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
          }
        }
      }
    });
    return unsub;
  }, []);

  const handleSend = useCallback((prompt: string) => {
    setUserPrompt(prompt);
    requestAnimationFrame(() => setUserPrompt(null));
  }, []);

  return (
    <ThemeProvider>
      <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono">
        {/* Title Bar */}
        <header className="flex items-center justify-center py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] relative">
          <div className="flex items-center gap-2">
            <img src="./logo-128.png" alt="GitHub Tokens" className="w-7 h-7" />
            <h1 className="text-2xl font-bold tracking-widest text-[var(--accent-gold)] neon-glow">
              GITHUB TOKENS
            </h1>
          </div>
          <div className="absolute right-4 flex items-center gap-2">
            <button
              onClick={() => { setSettingsOpen(true); setLeaderboardOpen(false); }}
              className="text-xl hover:scale-110 transition-transform cursor-pointer"
              title="Settings"
            >
              ⚙️
            </button>
            <button
              onClick={() => { setLeaderboardOpen(true); setSettingsOpen(false); }}
              className="text-xl hover:scale-110 transition-transform cursor-pointer"
              title="Leaderboard"
            >
              🏆
            </button>
          </div>
        </header>

        {/* CWD Status Bar */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-primary)] text-xs">
          <span className="text-[var(--text-secondary)]">📂</span>
          <button
            onClick={handleBrowseCwd}
            className="font-mono text-[var(--text-primary)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer truncate max-w-[600px]"
            title={cwd || 'Click to set working directory'}
          >
            {cwd || '(no working directory set — click to choose)'}
          </button>
          {gitBranch && (
            <>
              <span className="text-[var(--border-color)]">|</span>
              <span className="text-[var(--accent-green)] flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>
                {gitBranch}
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            {cwd && (
              <>
                <button
                  onClick={() => window.utilAPI?.openInVSCode(cwd)}
                  className="px-2 py-0.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 transition-colors cursor-pointer flex items-center gap-1"
                  title="Open in VS Code"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.583 2.213l-12.2 11.37L2 11.287l1.96-1.1 3.78 2.58L17.583.213V2.213zM5.383 13.97L2 15.71l3.383 2.297L17.583 7.07V21.787l-12.2-7.817zm12.2 9.6l4.417-2.297V3.517L17.583 1.22v21.563z"/></svg>
                  <span className="text-[10px]">Code</span>
                </button>
                <button
                  onClick={() => window.utilAPI?.openCopilotShell(cwd)}
                  className="px-2 py-0.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent-purple)] hover:bg-[var(--accent-purple)]/10 transition-colors cursor-pointer flex items-center gap-1"
                  title="Open Copilot in terminal"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                  <span className="text-[10px]">Terminal</span>
                </button>
              </>
            )}
            <button
              onClick={handleBrowseCwd}
              className="px-2 py-0.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 transition-colors cursor-pointer text-[10px]"
            >
              Change
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex flex-1 overflow-hidden">
          {/* Token Dashboard (Left Panel) */}
          <aside className="w-64 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 flex flex-col gap-4 overflow-y-auto">
            <h2 className="text-sm uppercase tracking-wider text-[var(--text-secondary)]">Token Dashboard</h2>
            <TokenDashboard inputTokenCount={inputTokens} onStatsUpdate={handleStatsUpdate} />
            <CommitButton changedFiles={changedFiles} visible={changedFiles.length > 0} />
          </aside>

          {/* Reel / Conversation Area (Center) */}
          <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <ReelArea userPrompt={userPrompt} onUsage={handleUsage} />

            {/* Prompt Bar (Bottom) */}
            <PromptBar onSend={handleSend} />
          </section>
        </main>
        <Leaderboard isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
        <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onCwdChange={refreshGitInfo} />
        <MilestoneOverlay milestone={activeMilestone} onComplete={dismissMilestone} />
      </div>
    </ThemeProvider>
  );
}
