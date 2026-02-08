import { useState, useCallback, useEffect, useRef } from 'react';
import { ThemeProvider } from './lib/themes';
import PromptBar from './components/PromptBar';
import TokenDashboard from './components/TokenDashboard';
import type { DashboardStats } from './components/TokenDashboard';
import Leaderboard from './components/Leaderboard';
import Settings from './components/Settings';
import ReelArea from './components/ReelArea';
import CommitButton from './components/CommitButton';
import MilestoneOverlay from './components/MilestoneOverlay';
import PermissionDialog from './components/PermissionDialog';
import type { PermissionRequestData, PermissionDecision } from './components/PermissionDialog';
import { useMilestones } from './hooks/useMilestones';

export default function App() {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userPrompt, setUserPrompt] = useState<string | null>(null);
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [inputTokens, setInputTokens] = useState(0);
  const [cwd, setCwd] = useState('');
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState('claude-sonnet-4');
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string; contextWindow: number }[]>([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const { activeMilestone, checkStats, dismissMilestone } = useMilestones();

  // YOLO mode state
  const [yoloMode, setYoloMode] = useState(false);

  // Session recording refs
  const latestStatsRef = useRef<DashboardStats | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  // Reset key — incrementing remounts ReelArea + TokenDashboard
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    setInputTokens(0);
    setChangedFiles([]);
    setUserPrompt(null);
    latestStatsRef.current = null;
    sessionStartRef.current = null;
    setResetKey((k) => k + 1);
  }, []);

  // Permission request state
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequestData | null>(null);

  useEffect(() => {
    if (!window.copilotAPI?.onPermissionRequest) return;
    return window.copilotAPI.onPermissionRequest((request) => {
      setPermissionRequest(request as PermissionRequestData);
    });
  }, []);

  const handlePermissionRespond = useCallback((decision: PermissionDecision) => {
    if (decision === 'always' && permissionRequest) {
      // Persist an "always allow" rule for this kind under the CWD
      const pathPrefix = permissionRequest.cwd || cwd;
      if (pathPrefix) {
        window.copilotAPI?.addPermissionRule(permissionRequest.kind, pathPrefix);
      }
    }
    window.copilotAPI?.respondPermission(decision);
    setPermissionRequest(null);
  }, [permissionRequest, cwd]);

  // Load CWD + git info + model on mount
  useEffect(() => {
    if (window.cwdAPI) {
      window.cwdAPI.get().then((dir) => {
        if (dir) {
          setCwd(dir);
          window.cwdAPI.gitInfo(dir).then((info) => {
            setGitBranch(info.isRepo ? (info.branch ?? null) : null);
          });
        }
      });
    }
    if (window.modelAPI) {
      window.modelAPI.get().then(setCurrentModel);
      window.modelAPI.list().then(setAvailableModels).catch(() => {});
    }
  }, []);

  const refreshGitInfo = useCallback((dir: string) => {
    setCwd(dir);
    if (window.cwdAPI) {
      window.cwdAPI.gitInfo(dir).then((info) => {
        setGitBranch(info.isRepo ? (info.branch ?? null) : null);
      });
    }
  }, []);

  const handleModelSwitch = useCallback((modelId: string) => {
    setCurrentModel(modelId);
    setModelDropdownOpen(false);
    window.modelAPI?.set(modelId);
  }, []);

  const handleBrowseCwd = useCallback(async () => {
    if (!window.cwdAPI) return;
    const dir = await window.cwdAPI.browse();
    if (dir) refreshGitInfo(dir);
  }, [refreshGitInfo]);

  // Persistent "super" border when above 500K tokens
  const [superMode, setSuperMode] = useState(false);

  const handleStatsUpdate = useCallback(
    (stats: DashboardStats) => {
      latestStatsRef.current = stats;
      checkStats(stats);
      const total = stats.inputTokens + stats.outputTokens;
      if (total >= 500_000 && !superMode) setSuperMode(true);
    },
    [checkStats, superMode],
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
    if (!sessionStartRef.current) sessionStartRef.current = Date.now();
    setUserPrompt(prompt);
    requestAnimationFrame(() => setUserPrompt(null));
  }, []);

  // Record session to leaderboard when agent goes idle
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const unsub = window.copilotAPI.onEvent((event: unknown) => {
      const ev = event as Record<string, unknown> | null;
      if (!ev || typeof ev !== 'object' || ev.type !== 'session.idle') return;
      const stats = latestStatsRef.current;
      const start = sessionStartRef.current;
      if (!stats || !start || stats.inputTokens === 0) return;
      const durationMs = Date.now() - start;
      window.statsAPI?.recordSession({
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        messagesCount: stats.messagesCount,
        filesChanged: stats.filesChanged,
        linesAdded: stats.linesAdded,
        linesRemoved: stats.linesRemoved,
        toolCalls: stats.toolCalls,
        durationMs,
      });
      // Reset for next session segment
      sessionStartRef.current = null;
    });
    return unsub;
  }, []);

  return (
    <ThemeProvider>
      <div className={`flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono${superMode ? ' super-border' : ''}`}>
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
              onClick={handleReset}
              className="text-xl hover:scale-110 transition-transform cursor-pointer"
              title="New Chat"
            >
              🔄
            </button>
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
          <span className="text-[var(--border-color)]">|</span>
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="text-[var(--accent-purple)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer flex items-center gap-1"
            >
              🧠 {availableModels.find(m => m.id === currentModel)?.name || currentModel}
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`}><path d="M0 2l4 4 4-4z"/></svg>
            </button>
            {modelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
                  {availableModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleModelSwitch(m.id)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        m.id === currentModel
                          ? 'bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      <span className="text-[var(--text-secondary)] shrink-0">
                        {m.contextWindow ? `${Math.round(m.contextWindow / 1000)}K` : ''}
                      </span>
                    </button>
                  ))}
                  {availableModels.length === 0 && (
                    <div className="px-3 py-2 text-xs text-[var(--text-secondary)]">Loading…</div>
                  )}
                </div>
              </>
            )}
          </div>
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
              onClick={() => {
                const next = !yoloMode;
                setYoloMode(next);
                window.copilotAPI?.setYoloMode(next);
              }}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 font-bold text-[10px] ${
                yoloMode
                  ? 'text-[var(--accent-gold)] bg-[var(--accent-gold)]/15'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
              }`}
              title={yoloMode ? 'YOLO mode ON — auto-approving read/write/shell under project' : 'Enable YOLO mode — skip permission prompts for project files'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 0L0 14h9l-2 10L20 10h-9l2-10z"/></svg>
              YOLO
            </button>
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
            <TokenDashboard key={resetKey} inputTokenCount={inputTokens} contextWindow={availableModels.find(m => m.id === currentModel)?.contextWindow} onStatsUpdate={handleStatsUpdate} />
            <CommitButton changedFiles={changedFiles} visible={changedFiles.length > 0} />
          </aside>

          {/* Reel / Conversation Area (Center) */}
          <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <ReelArea key={resetKey} userPrompt={userPrompt} onUsage={handleUsage} />

            {/* Prompt Bar (Bottom) */}
            <PromptBar onSend={handleSend} />
          </section>
        </main>
        <Leaderboard isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
        <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onCwdChange={refreshGitInfo} onModelChange={setCurrentModel} />
        <MilestoneOverlay milestone={activeMilestone} onComplete={dismissMilestone} />
        <PermissionDialog request={permissionRequest} onRespond={handlePermissionRespond} />
      </div>
    </ThemeProvider>
  );
}
