import { useEffect, useRef, useState, useCallback } from 'react';
import OdometerCounter from './OdometerCounter';
import ContextProgressBar from './ContextProgressBar';

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

export default function TokenDashboard({ inputTokenCount, contextWindow, onStatsUpdate }: TokenDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [gitStats, setGitStats] = useState({ filesChanged: 0, linesAdded: 0, linesRemoved: 0 });
  const statsRef = useRef(stats);

  // Keep ref in sync for event callbacks
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // Report stats upstream (merge token stats + git stats)
  useEffect(() => {
    onStatsUpdate?.({ ...stats, filesChanged: gitStats.filesChanged, linesAdded: gitStats.linesAdded, linesRemoved: gitStats.linesRemoved });
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

  // Subscribe to copilot events
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const unsub = window.copilotAPI.onEvent(handleEvent);
    return unsub;
  }, [handleEvent]);

  const totalTokens = stats.inputTokens + stats.outputTokens;

  return (
    <div className="flex flex-col gap-4">
      {/* Token Counters */}
      <Section title="Tokens">
        <OdometerCounter label="INPUT" value={stats.inputTokens} size="sm" />
        <OdometerCounter label="OUTPUT" value={stats.outputTokens} size="sm" />
        <OdometerCounter label="TOTAL" value={totalTokens} size="md" color="var(--accent-gold)" />
      </Section>

      {/* Context Usage */}
      <Section title="Context Window">
        <ContextProgressBar usedTokens={stats.inputTokens} maxTokens={contextWindow} />
      </Section>

      {/* File Stats */}
      <Section title="File Stats">
        <OdometerCounter label="FILES CHANGED" value={gitStats.filesChanged} size="sm" />
        <div className="flex gap-4">
          <OdometerCounter label="LINES +" value={gitStats.linesAdded} size="sm" color="var(--accent-green)" />
          <OdometerCounter label="LINES −" value={gitStats.linesRemoved} size="sm" color="var(--accent-red)" />
        </div>
      </Section>

      {/* Session Info */}
      <Section title="Session">
        <OdometerCounter label="MESSAGES" value={stats.messagesCount} size="sm" />
        <OdometerCounter label="TOOL CALLS" value={stats.toolCalls} size="sm" />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-3 flex flex-col gap-2">
      <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border-color)] pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}
