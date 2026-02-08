import { useEffect, useRef, useState, useCallback } from 'react';
import OdometerCounter from './OdometerCounter';
import ContextProgressBar from './ContextProgressBar';
import { partyBus, PartyEvents } from '../lib/party-bus';

export interface DashboardStats {
  inputTokens: number;
  outputTokens: number;
  realOutputTokens: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  messagesCount: number;
  toolCalls: number;
}

interface TokenDashboardProps {
  inputTokenCount?: number;
  contextWindow?: number;
  onStatsUpdate?: (stats: DashboardStats) => void;
  panelIds?: string[];
}

const initialStats: DashboardStats = {
  inputTokens: 0,
  outputTokens: 0,
  realOutputTokens: 0,
  filesChanged: 0,
  linesAdded: 0,
  linesRemoved: 0,
  messagesCount: 0,
  toolCalls: 0,
};

export default function TokenDashboard({ inputTokenCount, contextWindow, onStatsUpdate, panelIds }: TokenDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [gitStats, setGitStats] = useState<{ filesChanged: number; linesAdded: number; linesRemoved: number } | null>(null);
  const [contextUsage, setContextUsage] = useState<{ currentTokens: number; tokenLimit: number } | null>(null);
  const statsRef = useRef(stats);

  // Keep ref in sync for event callbacks
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // Report stats upstream (merge token stats + git stats)
  const prevTotalRef = useRef(0);
  useEffect(() => {
    // Wait for initial git stats poll before reporting, so milestones get a correct baseline
    if (!gitStats) return;
    const merged = { ...stats, filesChanged: gitStats.filesChanged, linesAdded: gitStats.linesAdded, linesRemoved: gitStats.linesRemoved };
    onStatsUpdate?.(merged);
    // Emit Party Bus events when crossing token thresholds
    const total = stats.inputTokens + stats.outputTokens;
    const prev = prevTotalRef.current;
    for (const t of [1000, 5000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]) {
      if (prev < t && total >= t) partyBus.emit(PartyEvents.TOKENS_CROSSED(t), total);
    }
    prevTotalRef.current = total;
  }, [stats, gitStats, onStatsUpdate]);

  // Sync inputTokenCount prop
  useEffect(() => {
    if (inputTokenCount != null) {
      setStats((prev) => ({ ...prev, inputTokens: inputTokenCount }));
    }
  }, [inputTokenCount]);

  // Poll real git stats every 3 seconds
  useEffect(() => {
    const poll = async () => {
      if (!window.cwdAPI) return;
      const cwd = await window.cwdAPI.get();
      if (!cwd) return;
      const gs = await window.cwdAPI.gitStats(cwd);
      setGitStats({ filesChanged: gs.filesChanged, linesAdded: gs.linesAdded, linesRemoved: gs.linesRemoved });
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleEvent = useCallback((event: unknown) => {
    const ev = event as Record<string, unknown> | null;
    if (!ev || typeof ev !== 'object') return;
    const type = ev.type as string | undefined;
    if (!type) return;

    if (type === 'session.usage_info') {
      setContextUsage({
        currentTokens: (ev.currentTokens ?? 0) as number,
        tokenLimit: (ev.tokenLimit ?? 0) as number,
      });
      return;
    }

    setStats((prev) => {
      const next = { ...prev };

      if (type === 'assistant.message_delta') {
        const delta = (ev.delta ?? ev.content ?? '') as string;
        // Rough estimate until real usage event arrives
        next.outputTokens += Math.max(1, Math.ceil(delta.length / 4));
      }

      if (type === 'session.idle') {
        next.messagesCount += 1;
      }

      if (type === 'assistant.usage') {
        const input = (ev.inputTokens ?? 0) as number;
        const output = (ev.outputTokens ?? 0) as number;
        // Input tokens = current context size (use latest, not cumulative)
        if (input > 0) next.inputTokens = input;
        // Output tokens = accumulate real counts, replace the delta estimate
        if (output > 0) {
          // Subtract the delta-based estimate we added during streaming, add the real count
          next.outputTokens = prev.realOutputTokens + output;
          next.realOutputTokens = prev.realOutputTokens + output;
        }
      }

      if (type === 'tool.start') {
        next.toolCalls += 1;
      }

      // Trigger a git stats refresh after tool completions
      if (type === 'tool.complete' || type === 'session.idle') {
        if (window.cwdAPI) {
          window.cwdAPI.get().then((cwd) => {
            if (cwd) {
              window.cwdAPI.gitStats(cwd).then((gs) => {
                setGitStats({ filesChanged: gs.filesChanged, linesAdded: gs.linesAdded, linesRemoved: gs.linesRemoved });
              });
            }
          });
        }
      }

      return next;
    });
  }, []);

  // Subscribe to copilot events (all panels)
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const ids = panelIds && panelIds.length > 0 ? panelIds : ['main'];
    const unsubs = ids.map(id => window.copilotAPI.onEvent(handleEvent, id));
    return () => unsubs.forEach(u => u());
  }, [handleEvent, panelIds?.join(',')]);

  const totalTokens = stats.inputTokens + stats.outputTokens;

  return (
    <div className="flex flex-col gap-2">
      {/* Token Counters */}
      <Section title="Tokens">
        <OdometerCounter label="INPUT" value={stats.inputTokens} size="sm" />
        <OdometerCounter label="OUTPUT" value={stats.outputTokens} size="sm" />
        <OdometerCounter label="TOTAL" value={totalTokens} size="sm" color="var(--accent-gold)" />
      </Section>

      {/* Context Usage */}
      <Section title="Context Window">
        <ContextProgressBar
          usedTokens={contextUsage?.currentTokens ?? stats.inputTokens}
          maxTokens={contextUsage?.tokenLimit ?? contextWindow}
        />
      </Section>

      {/* File Stats */}
      <Section title="Changes">
        <div className="flex gap-4 items-end">
          <OdometerCounter label="FILES" value={gitStats?.filesChanged ?? 0} size="sm" />
          <OdometerCounter label="+" value={gitStats?.linesAdded ?? 0} size="sm" color="var(--accent-green)" />
          <OdometerCounter label="−" value={gitStats?.linesRemoved ?? 0} size="sm" color="var(--accent-red)" />
        </div>
      </Section>

      {/* Session Info */}
      <Section title="Session">
        <div className="flex gap-4 items-end">
          <OdometerCounter label="MESSAGES" value={stats.messagesCount} size="sm" />
          <OdometerCounter label="TOOLS" value={stats.toolCalls} size="sm" />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card px-3 py-2 flex flex-col gap-1.5">
      <h3 className="text-[9px] uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border-color)] pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}
