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
  const { activeMilestone, checkStats, dismissMilestone } = useMilestones();

  const handleStatsUpdate = useCallback(
    (stats: DashboardStats) => { checkStats(stats); },
    [checkStats],
  );

  // Track changed files from copilot events
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const unsub = window.copilotAPI.onEvent((event: unknown) => {
      const ev = event as Record<string, unknown> | null;
      if (!ev || typeof ev !== 'object') return;
      if (ev.type === 'tool_call.file_edit') {
        const filePath = (ev.file ?? ev.path ?? '') as string;
        if (filePath) {
          setChangedFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
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
          <h1 className="text-2xl font-bold tracking-widest text-[var(--accent-gold)] neon-glow">
            🎰 COPILOT SLOTS
          </h1>
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

        {/* Main Content */}
        <main className="flex flex-1 overflow-hidden">
          {/* Token Dashboard (Left Panel) */}
          <aside className="w-64 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 flex flex-col gap-4 overflow-y-auto">
            <h2 className="text-sm uppercase tracking-wider text-[var(--text-secondary)]">Token Dashboard</h2>
            <TokenDashboard onStatsUpdate={handleStatsUpdate} />
            <CommitButton changedFiles={changedFiles} visible={changedFiles.length > 0} />
          </aside>

          {/* Reel / Conversation Area (Center) */}
          <section className="flex-1 flex flex-col">
            <ReelArea userPrompt={userPrompt} />

            {/* Prompt Bar (Bottom) */}
            <PromptBar onSend={handleSend} />
          </section>
        </main>
        <Leaderboard isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
        <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <MilestoneOverlay milestone={activeMilestone} onComplete={dismissMilestone} />
      </div>
    </ThemeProvider>
  );
}
