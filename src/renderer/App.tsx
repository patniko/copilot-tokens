import { useState, useCallback, useEffect, useRef } from 'react';
import logoImg from '../../logo-128.png';
import { ThemeProvider } from './lib/themes';
import TokenDashboard from './components/TokenDashboard';
import type { DashboardStats } from './components/TokenDashboard';
import Settings from './components/Settings';
import SplitLayout from './components/SplitLayout';
import CommitButton from './components/CommitButton';
import MilestoneOverlay from './components/MilestoneOverlay';
import AvatarMenu from './components/AvatarMenu';
import PackStudio from './components/PackStudio';
import AchievementsModal from './components/AchievementsModal';
import SessionReplay from './components/SessionReplay';
import SessionBrowser from './components/SessionBrowser';
import LevelBadge from './components/LevelBadge';
import CwdDropdown from './components/CwdDropdown';
import LevelUpOverlay from './components/LevelUpOverlay';
import TabBar from './components/TabBar';
import type { ProjectTab, TabActivity } from './components/TabBar';
import { useSessionRecorder } from './hooks/useSessionRecorder';
import { useBadges } from './hooks/useBadges';
import { addSessionToProgress, type LevelProgress } from './lib/level-system';
import { partyBus, PartyEvents } from './lib/party-bus';
import SoundManager from './lib/sound-manager';
import type { PermissionRequestData, PermissionDecision } from './components/PermissionDialog';
import { useMilestones } from './hooks/useMilestones';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [packStudioOpen, setPackStudioOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [achievementsTab, setAchievementsTab] = useState<'stats' | 'trophies'>('stats');
  const [replaySessionTimestamp, setReplaySessionTimestamp] = useState<number | null>(null);
  const [sessionBrowserOpen, setSessionBrowserOpen] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const [inputTokens, setInputTokens] = useState(0);
  const [currentModel, setCurrentModel] = useState('');
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string; contextWindow: number }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const { activeMilestone, checkStats, dismissMilestone } = useMilestones();
  const sessionRecorder = useSessionRecorder();
  const { trigger: triggerBadge } = useBadges();

  // YOLO visual effects (global)
  const [yoloFlash, setYoloFlash] = useState(false);
  const [yoloCool, setYoloCool] = useState(false);

  // Agent activity state (for logo bounce)
  const [agentActive, setAgentActive] = useState(false);

  // Session recording refs
  const latestStatsRef = useRef<DashboardStats | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const conversationEventsRef = useRef<Record<string, unknown>[]>([]);

  // Reset key — incrementing remounts TokenDashboard
  const [resetKey, setResetKey] = useState(0);

  // --- Tab state ---
  const tabCounter = useRef(0);
  const initialTabId = `tab-${tabCounter.current}`;
  const [tabs, setTabs] = useState<ProjectTab[]>([
    { id: initialTabId, cwd: '', gitBranch: null, changedFiles: [], panels: [{ id: `${initialTabId}:main`, userPrompt: null, resetKey: 0 }], panelCounter: 0, yoloMode: false },
  ]);
  const [activeTabId, setActiveTabId] = useState(initialTabId);
  const [tabActivity, setTabActivity] = useState<Record<string, TabActivity>>({});

  // Derived active tab helpers
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const cwd = activeTab.cwd;
  const gitBranch = activeTab.gitBranch;
  const changedFiles = activeTab.changedFiles;
  const panels = activeTab.panels;
  const yoloMode = activeTab.yoloMode;

  // Update a specific tab's state
  const updateTab = useCallback((tabId: string, updater: (tab: ProjectTab) => ProjectTab) => {
    setTabs(prev => prev.map(t => t.id === tabId ? updater(t) : t));
  }, []);

  // All panel IDs across all tabs (for global event listeners)
  const allPanelIds = tabs.flatMap(t => t.panels.map(p => p.id));

  const handleReset = useCallback(() => {
    setInputTokens(0);
    latestStatsRef.current = null;
    sessionStartRef.current = null;
    conversationEventsRef.current = [];
    sessionRecorder.reset();
    setResetKey((k) => k + 1);
    // Reset active tab's panels to just its main panel
    updateTab(activeTabId, (tab) => ({
      ...tab,
      changedFiles: [],
      panels: [{ id: `${tab.id}:main`, userPrompt: null, resetKey: Date.now() }],
      panelCounter: 0,
    }));
  }, [sessionRecorder, activeTabId, updateTab]);

  // Permission request state + reaction time tracking
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequestData | null>(null);
  const permissionShownAt = useRef<number | null>(null);
  const [reactionBest, setReactionBest] = useState<{ timeMs: number; previousBest: number } | null>(null);

  useEffect(() => {
    if (!window.copilotAPI?.onPermissionRequest) return;
    return window.copilotAPI.onPermissionRequest((request) => {
      permissionShownAt.current = Date.now();
      setPermissionRequest(request as PermissionRequestData);
    });
  }, []);

  const handlePermissionRespond = useCallback((decision: PermissionDecision) => {
    // Measure reaction time
    if (permissionShownAt.current) {
      const reactionMs = Date.now() - permissionShownAt.current;
      permissionShownAt.current = null;
      window.statsAPI?.recordReactionTime(reactionMs).then((result) => {
        if (result.isNewBest) {
          setReactionBest({ timeMs: result.timeMs, previousBest: result.previousBest });
          SoundManager.getInstance().play('milestone');
          setTimeout(() => setReactionBest(null), 4000);
        }
      });
    }
    if (decision === 'always' && permissionRequest) {
      const pathPrefix = permissionRequest.cwd || cwd;
      if (pathPrefix) {
        window.copilotAPI?.addPermissionRule(permissionRequest.kind, pathPrefix);
      }
    }
    window.copilotAPI?.respondPermission(decision);
    setPermissionRequest(null);
  }, [permissionRequest, cwd]);

  const [mcpServers, setMcpServers] = useState<{ name: string; type: string; command: string }[]>([]);
  const [mcpDropdownOpen, setMcpDropdownOpen] = useState(false);

  // Load CWD + git info + model + MCP servers on mount
  useEffect(() => {
    if (window.cwdAPI) {
      window.cwdAPI.get().then((dir) => {
        if (dir) {
          updateTab(activeTabId, (tab) => ({ ...tab, cwd: dir }));
          window.cwdAPI.gitInfo(dir).then((info) => {
            updateTab(activeTabId, (tab) => ({ ...tab, gitBranch: info.isRepo ? (info.branch ?? null) : null }));
          });
          // Seed changed files from existing git diff
          window.cwdAPI.gitStats(dir).then((stats) => {
            if (stats.files.length > 0) {
              updateTab(activeTabId, (tab) => {
                const merged = new Set([...tab.changedFiles, ...stats.files]);
                return { ...tab, changedFiles: [...merged] };
              });
            }
          });
        }
      });
    }
    if (window.modelAPI) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModelsLoading(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModelsError(null);
      window.modelAPI.list().then((models) => {
        setAvailableModels(models);
        // Set current model from backend preference, or first available
        window.modelAPI!.get().then((saved) => {
          const match = models.find(m => m.id === saved);
          setCurrentModel(match ? saved : models[0]?.id ?? '');
          setModelsLoading(false);
        });
      }).catch((err) => {
        setModelsError(err?.message || 'Failed to load models');
        setModelsLoading(false);
      });
    }
    if (window.mcpAPI) {
      window.mcpAPI.list().then(setMcpServers).catch(() => {});
    }
  }, []);

  const refreshGitInfo = useCallback((dir: string) => {
    updateTab(activeTabId, (tab) => ({ ...tab, cwd: dir }));
    if (window.cwdAPI) {
      // Sync CWD to main process — destroys sessions for this tab's panels
      // so they pick up the new working directory on next message.
      const panelIds = tabs.find(t => t.id === activeTabId)?.panels.map(p => p.id);
      window.cwdAPI.set(dir, panelIds);
      window.cwdAPI.gitInfo(dir).then((info) => {
        updateTab(activeTabId, (tab) => ({ ...tab, gitBranch: info.isRepo ? (info.branch ?? null) : null }));
      });
      window.cwdAPI.gitStats(dir).then((stats) => {
        updateTab(activeTabId, (tab) => ({ ...tab, changedFiles: stats.files }));
      });
    }
  }, [activeTabId, tabs, updateTab]);

  const refreshChangedFiles = useCallback(() => {
    if (window.cwdAPI && cwd) {
      window.cwdAPI.gitStats(cwd).then((stats) => {
        updateTab(activeTabId, (tab) => ({ ...tab, changedFiles: stats.files }));
      });
    }
  }, [cwd, activeTabId, updateTab]);

  const handleModelSwitch = useCallback((modelId: string) => {
    setCurrentModel(modelId);
    setModelDropdownOpen(false);
    setModelsError(null);
    window.modelAPI?.set(modelId);
  }, []);

  const retryLoadModels = useCallback(() => {
    if (!window.modelAPI) return;
    setModelsLoading(true);
    setModelsError(null);
    window.modelAPI.list().then((models) => {
      setAvailableModels(models);
      window.modelAPI!.get().then((saved) => {
        const match = models.find(m => m.id === saved);
        setCurrentModel(match ? saved : models[0]?.id ?? '');
        setModelsLoading(false);
      });
    }).catch((err) => {
      setModelsError(err?.message || 'Failed to load models');
      setModelsLoading(false);
    });
  }, []);

  const handleBrowseCwd = useCallback(async () => {
    if (!window.cwdAPI) return;
    const panelIds = tabs.find(t => t.id === activeTabId)?.panels.map(p => p.id);
    const dir = await window.cwdAPI.browse(panelIds);
    if (dir) refreshGitInfo(dir);
  }, [refreshGitInfo, activeTabId, tabs]);

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

  // Track changed files from copilot events (all panels across all tabs)
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const handler = (event: unknown) => {
      const ev = event as Record<string, unknown> | null;
      if (!ev || typeof ev !== 'object') return;
      if (ev.type === 'tool.start') {
        const toolName = ev.toolName as string | undefined;
        const args = (ev.args ?? {}) as Record<string, unknown>;
        if (toolName === 'edit' || toolName === 'create' || toolName === 'write') {
          const filePath = String(args.path ?? args.file ?? '');
          if (filePath) {
            // Find which tab this panel belongs to, update its changedFiles
            setTabs(prev => prev.map(tab => {
              const panelIds = tab.panels.map(p => p.id);
              // If this event came from one of this tab's panels, update it
              // (we listen on all panels, but update the right tab)
              return tab;
            }));
            // For simplicity, update active tab's changedFiles
            updateTab(activeTabId, (tab) => ({
              ...tab,
              changedFiles: tab.changedFiles.includes(filePath) ? tab.changedFiles : [...tab.changedFiles, filePath],
            }));
          }
        }
      }
    };
    const unsubs = allPanelIds.map(pid => window.copilotAPI.onEvent(handler, pid));
    return () => unsubs.forEach(u => u());
  }, [allPanelIds.join(','), activeTabId, updateTab]);

  // Capture raw copilot events for conversation persistence
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const handler = (event: unknown) => {
      const ev = event as Record<string, unknown> | null;
      if (ev && typeof ev === 'object') {
        conversationEventsRef.current.push(ev);
      }
    };
    const unsubs = allPanelIds.map(pid => window.copilotAPI.onEvent(handler, pid));
    return () => unsubs.forEach(u => u());
  }, [allPanelIds.join(',')]);

  // Track per-tab agent activity from copilot events
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const panelToTab = new Map<string, string>();
    for (const tab of tabs) {
      for (const panel of tab.panels) {
        panelToTab.set(panel.id, tab.id);
      }
    }
    const handlers = allPanelIds.map(pid => {
      const handler = (event: unknown) => {
        const ev = event as Record<string, unknown> | null;
        if (!ev || typeof ev !== 'object') return;
        const tabId = panelToTab.get(pid);
        if (!tabId) return;
        if (ev.type === 'assistant.turn_start') {
          setTabActivity(prev => ({ ...prev, [tabId]: 'active' }));
        } else if (ev.type === 'ask_user.request') {
          setTabActivity(prev => ({ ...prev, [tabId]: 'waiting' }));
        } else if (ev.type === 'session.idle') {
          setTabActivity(prev => ({ ...prev, [tabId]: 'idle' }));
        }
      };
      return window.copilotAPI.onEvent(handler, pid);
    });
    return () => handlers.forEach(u => u());
  }, [allPanelIds.join(','), tabs]);

  // Set tab to waiting when permission dialog is shown
  useEffect(() => {
    if (permissionRequest) {
      setTabActivity(prev => ({ ...prev, [activeTabId]: 'waiting' }));
    }
  }, [permissionRequest, activeTabId]);

  const handlePanelSend = useCallback((panelId: string, prompt: string) => {
    if (!currentModel) {
      setModelsError(modelsLoading ? 'Models are still loading, please wait…' : 'No model selected. Please select a model first.');
      return;
    }
    if (!sessionStartRef.current) sessionStartRef.current = Date.now();
    // Time-of-day badges
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 6) triggerBadge('badge-night-owl');
    if (hour >= 4 && hour < 6) triggerBadge('badge-early-bird');
    // Record user message for conversation persistence
    conversationEventsRef.current.push({ type: 'user.message', content: prompt });
    // Dual agents badge: if already generating from another panel, two are running
    if (agentActive && panels.length > 1) triggerBadge('badge-dual-agents');
    setAgentActive(true);
    updateTab(activeTabId, (tab) => ({
      ...tab,
      panels: tab.panels.map(p =>
        p.id === panelId ? { ...p, userPrompt: prompt } : p,
      ),
    }));
    requestAnimationFrame(() => {
      updateTab(activeTabId, (tab) => ({
        ...tab,
        panels: tab.panels.map(p =>
          p.id === panelId ? { ...p, userPrompt: null } : p,
        ),
      }));
    });
  }, [currentModel, modelsLoading, triggerBadge, agentActive, panels.length, activeTabId, updateTab]);

  const handleSend = useCallback((prompt: string) => {
    handlePanelSend(`${activeTabId}:main`, prompt);
  }, [handlePanelSend, activeTabId]);

  const handleAddPanel = useCallback(() => {
    updateTab(activeTabId, (tab) => {
      const next = tab.panelCounter + 1;
      const newId = `${tab.id}:split-${next}`;
      const newPanels = [...tab.panels, { id: newId, userPrompt: null, resetKey: 0 }];
      if (newPanels.length === 2) triggerBadge('badge-first-split');
      if (newPanels.length >= 3) triggerBadge('badge-3-panels');
      return { ...tab, panels: newPanels, panelCounter: next };
    });
  }, [triggerBadge, activeTabId, updateTab]);

  const handleClosePanel = useCallback((panelId: string) => {
    updateTab(activeTabId, (tab) => {
      if (tab.panels.length <= 1) return tab;
      return { ...tab, panels: tab.panels.filter(p => p.id !== panelId) };
    });
    window.copilotAPI?.destroySession(panelId);
  }, [activeTabId, updateTab]);

  // Record session to leaderboard when agent goes idle
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const handler = (event: unknown) => {
      const ev = event as Record<string, unknown> | null;
      if (!ev || typeof ev !== 'object' || ev.type !== 'session.idle') return;
      setAgentActive(false);
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
      }, start);
      // Save session replay events
      sessionRecorder.save();

      // Save conversation log for session restore
      if (conversationEventsRef.current.length > 0) {
        window.statsAPI?.saveConversationLog(start, conversationEventsRef.current);
        conversationEventsRef.current = [];
      }

      // Session-based badges
      if (durationMs > 10 * 60 * 1000) triggerBadge('badge-marathon');
      if (durationMs < 30 * 1000 && stats.toolCalls > 0) triggerBadge('badge-speed-demon');
      if (stats.toolCalls >= 10) triggerBadge('badge-10-tools');
      window.statsAPI?.getAllSessions().then((all) => {
        if (all && all.length >= 5) triggerBadge('badge-5-sessions');
      });

      // Update level progress
      window.statsAPI?.getLevelProgress().then((lp) => {
        const { progress: updated, leveledUp, newLevel } = addSessionToProgress(
          lp as LevelProgress,
          stats,
        );
        window.statsAPI?.setLevelProgress(updated);
        if (leveledUp) {
          partyBus.emit(PartyEvents.LEVEL_UP, { level: newLevel });
          setLevelUpLevel(newLevel);
        }
      });

      // Reset for next session segment
      sessionStartRef.current = null;

      // Refresh git changed files after agent finishes
      if (window.cwdAPI) {
        // Update all tabs that have a CWD set
        setTabs(prev => {
          const updated = [...prev];
          for (const tab of updated) {
            if (!tab.cwd) continue;
            window.cwdAPI.gitStats(tab.cwd).then((gs) => {
              if (gs.files.length > 0) {
                setTabs(p => p.map(t => {
                  if (t.id !== tab.id) return t;
                  const merged = new Set([...t.changedFiles, ...gs.files]);
                  return { ...t, changedFiles: [...merged] };
                }));
              }
            });
          }
          return updated;
        });
      }
    };
    const unsubs = allPanelIds.map(pid => window.copilotAPI.onEvent(handler, pid));
    return () => unsubs.forEach(u => u());
  }, [allPanelIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Tab operations ---
  const handleAddTab = useCallback(async () => {
    tabCounter.current += 1;
    const newTabId = `tab-${tabCounter.current}`;
    const newTab: ProjectTab = {
      id: newTabId,
      cwd: '',
      gitBranch: null,
      changedFiles: [],
      panels: [{ id: `${newTabId}:main`, userPrompt: null, resetKey: 0 }],
      panelCounter: 0,
      yoloMode: false,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    // Open directory picker for the new tab
    if (window.cwdAPI) {
      const dir = await window.cwdAPI.browse([`${newTabId}:main`]);
      if (dir) {
        updateTab(newTabId, (tab) => ({ ...tab, cwd: dir }));
        window.cwdAPI.gitInfo(dir).then((info) => {
          updateTab(newTabId, (tab) => ({ ...tab, gitBranch: info.isRepo ? (info.branch ?? null) : null }));
        });
        window.cwdAPI.gitStats(dir).then((stats) => {
          if (stats.files.length > 0) {
            updateTab(newTabId, (tab) => ({ ...tab, changedFiles: stats.files }));
          }
        });
      }
    }
  }, [updateTab]);

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev;
      // Destroy all sessions for this tab's panels
      const tab = prev.find(t => t.id === tabId);
      if (tab) {
        for (const panel of tab.panels) {
          window.copilotAPI?.destroySession(panel.id);
        }
      }
      const next = prev.filter(t => t.id !== tabId);
      // If closing the active tab, switch to the nearest one
      setActiveTabId(current => {
        if (current === tabId) {
          const closedIdx = prev.findIndex(t => t.id === tabId);
          return next[Math.min(closedIdx, next.length - 1)]?.id ?? next[0].id;
        }
        return current;
      });
      return next;
    });
  }, []);

  const handleSwitchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    // Sync YOLO mode to permission service for the new tab
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      window.copilotAPI?.setYoloMode(tab.yoloMode);
      // Sync CWD to stats for the active tab
      if (tab.cwd) window.cwdAPI?.set(tab.cwd, tab.panels.map(p => p.id));
    }
  }, [tabs]);

  return (
    <ThemeProvider>
      <div className={`flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono${superMode ? ' super-border' : ''}`}>
        {/* Title Bar */}
        <header className="flex items-center justify-center pt-8 pb-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] relative" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <div className="absolute left-4 bottom-2 flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <LevelBadge
              compact
              onOpenLeaderboard={() => { setAchievementsTab('stats'); setAchievementsOpen(true); }}
              onOpenTrophyCase={() => { setAchievementsTab('trophies'); setAchievementsOpen(true); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-widest text-[var(--accent-gold)] neon-glow flex items-center gap-2">
              COPILOT
              <img
                src={logoImg}
                alt="Copilot Tokens"
                className={`w-7 h-7${agentActive ? ' logo-bounce' : ''}`}
              />
              TOKENS
            </h1>
          </div>
          <div className="absolute right-4 flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <CommitButton changedFiles={changedFiles} visible={changedFiles.length > 0} onSendFeedback={handleSend} onCommitSuccess={() => triggerBadge('badge-first-commit')} onFilesChanged={refreshChangedFiles} />
          </div>
        </header>

        {/* Project Tab Bar */}
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          tabActivity={tabActivity}
          onSwitchTab={handleSwitchTab}
          onAddTab={handleAddTab}
          onCloseTab={handleCloseTab}
        />

        {/* CWD Status Bar */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-primary)] text-xs">
          <CwdDropdown
            cwd={cwd}
            gitBranch={gitBranch}
            onBrowse={handleBrowseCwd}
            onSelectRecent={(dir) => refreshGitInfo(dir)}
            onBranchSwitch={() => refreshGitInfo(cwd)}
          />
          <span className="text-[var(--border-color)]">|</span>
          <div className="relative">
            <button
              onClick={() => modelsError ? retryLoadModels() : setModelDropdownOpen(!modelDropdownOpen)}
              className={`transition-colors cursor-pointer flex items-center gap-1 ${
                modelsError ? 'text-red-400 hover:text-red-300' :
                modelsLoading ? 'text-[var(--text-secondary)]' :
                'text-[var(--accent-purple)] hover:text-[var(--accent-gold)]'
              }`}
              title={modelsError ?? undefined}
            >
              {modelsLoading ? '⏳ Loading models…' :
               modelsError ? '⚠️ Models unavailable — click to retry' :
               <>🧠 {availableModels.find(m => m.id === currentModel)?.name || currentModel}</>}
              {!modelsLoading && !modelsError && <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`}><path d="M0 2l4 4 4-4z"/></svg>}
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
          <span className="text-[var(--border-color)]">|</span>
          <div className="relative">
            <button
              onClick={() => setMcpDropdownOpen(!mcpDropdownOpen)}
              className={`flex items-center gap-1 transition-colors cursor-pointer ${
                mcpServers.length > 0
                  ? 'text-[var(--accent-green)] hover:text-[var(--accent-gold)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title={`${mcpServers.length} MCP server${mcpServers.length !== 1 ? 's' : ''} connected`}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2zm0 1.5h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5zM2 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H2zm0 1.5h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5zM12 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>
              {mcpServers.length} MCP
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`transition-transform ${mcpDropdownOpen ? 'rotate-180' : ''}`}><path d="M0 2l4 4 4-4z"/></svg>
            </button>
            {mcpDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMcpDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-[var(--border-color)] text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                    MCP Servers ({mcpServers.length})
                  </div>
                  {mcpServers.length === 0 && (
                    <div className="px-3 py-3 text-xs text-[var(--text-secondary)]">No MCP servers configured</div>
                  )}
                  {mcpServers.map((s) => (
                    <div key={s.name} className="px-3 py-2 flex items-center gap-2 border-b border-[var(--border-color)] last:border-b-0">
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[var(--text-primary)] truncate">{s.name}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] truncate">{s.type} · {s.command}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1">
            {cwd && (
              <>
                <button
                  onClick={() => window.utilAPI?.openFolder(cwd)}
                  className="px-2 py-0.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 transition-colors cursor-pointer flex items-center gap-1"
                  title="Open in Finder"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  <span className="text-[10px]">Folder</span>
                </button>
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
                updateTab(activeTabId, (tab) => ({ ...tab, yoloMode: next }));
                window.copilotAPI?.setYoloMode(next);
                SoundManager.getInstance().play(next ? 'yoloOn' : 'yoloOff');
                if (next) {
                  setYoloFlash(true);
                  setTimeout(() => setYoloFlash(false), 1200);
                  triggerBadge('badge-yolo');
                } else {
                  setYoloCool(true);
                  setTimeout(() => setYoloCool(false), 1500);
                }
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
          </div>
        </div>

        {/* Model error/loading banner */}
        {modelsError && !modelsLoading && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border-b border-red-500/30 text-xs text-red-300">
            <span>⚠️ {modelsError}</span>
            <button
              onClick={retryLoadModels}
              className="ml-auto px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => setModelsError(null)}
              className="text-red-400 hover:text-red-200 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Content */}
        <main className="flex flex-1 overflow-hidden">
          {/* Token Dashboard (Left Panel) */}
          <aside className="w-64 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 flex flex-col gap-2 overflow-hidden">
            <h2 className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Token Dashboard</h2>
            <div className="flex-1 min-h-0">
              <TokenDashboard key={resetKey} inputTokenCount={inputTokens} contextWindow={availableModels.find(m => m.id === currentModel)?.contextWindow} onStatsUpdate={handleStatsUpdate} panelIds={allPanelIds} />
            </div>
            <div className="shrink-0">
              <AvatarMenu
                onOpenSettings={() => { setSettingsOpen(true); setPackStudioOpen(false); }}
                onOpenAchievements={(tab) => { setAchievementsTab(tab); setAchievementsOpen(true); }}
                onOpenPackStudio={() => { setPackStudioOpen(true); setSettingsOpen(false); }}
              />
            </div>
          </aside>

          {/* Reel / Conversation Area (Center) */}
          <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {sessionBrowserOpen ? (
              <SessionBrowser
                onSelect={async (session) => {
                  setSessionBrowserOpen(false);
                  if (session.cwd) {
                    updateTab(activeTabId, (tab) => ({ ...tab, cwd: session.cwd! }));
                    window.cwdAPI?.set(session.cwd, panels.map(p => p.id));
                    refreshGitInfo(session.cwd);
                  }
                  // Load conversation history
                  const log = await window.statsAPI?.getConversationLog(session.timestamp);
                  const events = log?.events;
                  triggerBadge('badge-load-session');
                  handleReset();
                  if (events && events.length > 0) {
                    // Set initialEvents on the main panel after reset
                    updateTab(activeTabId, (tab) => ({
                      ...tab,
                      panels: [{ id: `${tab.id}:main`, userPrompt: null, resetKey: Date.now(), initialEvents: events }],
                    }));
                  }
                }}
                onClose={() => setSessionBrowserOpen(false)}
                onResumeSDK={async (sessionId) => {
                  setSessionBrowserOpen(false);
                  handleReset();
                  try {
                    await window.sessionsAPI?.resume(sessionId, `${activeTabId}:main`);
                  } catch (err) {
                    console.error('Failed to resume session:', err);
                  }
                }}
              />
            ) : (
              <SplitLayout
                panels={panels}
                onUsage={handleUsage}
                onPanelSend={handlePanelSend}
                cwd={cwd}
                onBrowseCwd={handleBrowseCwd}
                permissionRequest={permissionRequest}
                onPermissionRespond={handlePermissionRespond}
                onNewSession={handleReset}
                onLoadSession={() => setSessionBrowserOpen(true)}
                onSplitSession={handleAddPanel}
                onClosePanel={handleClosePanel}
                onBadge={triggerBadge}
              />
            )}
          </section>
        </main>
        <AchievementsModal isOpen={achievementsOpen} onClose={() => setAchievementsOpen(false)} onReplaySession={(ts) => { setAchievementsOpen(false); setReplaySessionTimestamp(ts); }} initialTab={achievementsTab} />
        <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onModelChange={setCurrentModel} />
        <PackStudio isOpen={packStudioOpen} onClose={() => setPackStudioOpen(false)} />
        <SessionReplay sessionTimestamp={replaySessionTimestamp} onClose={() => setReplaySessionTimestamp(null)} />
        <MilestoneOverlay milestone={activeMilestone} onComplete={dismissMilestone} />
        <LevelUpOverlay level={levelUpLevel} onComplete={() => setLevelUpLevel(null)} />

        {/* YOLO activation flash */}
        {yoloFlash && (
          <div className="yolo-flash fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
            <div className="yolo-flash-text text-6xl font-black select-none">
              🔥 YOLO 🔥
            </div>
          </div>
        )}

        {/* YOLO deactivation — coward mode */}
        {yoloCool && (
          <div className="yolo-cool fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
            <div className="yolo-cool-text text-5xl font-black select-none">
              🐔 safe mode 🛡️
            </div>
          </div>
        )}
        {/* Reaction time personal best celebration */}
        {reactionBest && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] animate-bounce">
            <div className="bg-[var(--accent-gold)]/90 text-black px-6 py-3 rounded-xl shadow-2xl text-center">
              <div className="text-2xl font-black">⚡ NEW PERSONAL BEST! ⚡</div>
              <div className="text-lg font-bold mt-1">{reactionBest.timeMs.toLocaleString()}ms reaction time</div>
              {reactionBest.previousBest < Infinity && (
                <div className="text-sm opacity-80 mt-0.5">Previous: {reactionBest.previousBest.toLocaleString()}ms</div>
              )}
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}
