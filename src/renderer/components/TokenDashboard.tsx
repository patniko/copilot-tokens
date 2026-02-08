import { useEffect, useRef, useState, useCallback } from 'react';
import OdometerCounter from './OdometerCounter';

export interface DashboardStats {
  inputTokens: number;
  outputTokens: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  messagesCount: number;
  toolCalls: number;
}

interface TokenDashboardProps {
  inputTokenCount?: number;
  onStatsUpdate?: (stats: DashboardStats) => void;
}

const initialStats: DashboardStats = {
  inputTokens: 0,
  outputTokens: 0,
  filesChanged: 0,
  linesAdded: 0,
  linesRemoved: 0,
  messagesCount: 0,
  toolCalls: 0,
};

export default function TokenDashboard({ inputTokenCount, onStatsUpdate }: TokenDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const statsRef = useRef(stats);

  // Keep ref in sync for event callbacks
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // Report stats upstream
  useEffect(() => {
    onStatsUpdate?.(stats);
  }, [stats, onStatsUpdate]);

  // Sync inputTokenCount prop
  useEffect(() => {
    if (inputTokenCount != null) {
      setStats((prev) => ({ ...prev, inputTokens: inputTokenCount }));
    }
  }, [inputTokenCount]);

  const handleEvent = useCallback((event: unknown) => {
    const ev = event as Record<string, unknown> | null;
    if (!ev || typeof ev !== 'object') return;
    const type = ev.type as string | undefined;
    if (!type) return;

    setStats((prev) => {
      const next = { ...prev };

      if (type === 'assistant.message_delta') {
        const delta = (ev.delta ?? ev.content ?? '') as string;
        next.outputTokens += Math.max(1, Math.ceil(delta.length / 4));
        next.messagesCount = Math.max(prev.messagesCount, 1);
      }

      if (type === 'assistant.usage') {
        const input = (ev.inputTokens ?? 0) as number;
        const output = (ev.outputTokens ?? 0) as number;
        next.inputTokens += input;
        // Prefer real output token count over our estimate when available
        if (output > 0) next.outputTokens = output;
      }

      if (type === 'tool.start') {
        next.toolCalls += 1;
        const toolName = (ev.toolName ?? '') as string;
        if (toolName === 'edit' || toolName === 'create' || toolName === 'write') {
          next.filesChanged += 1;
        }
      }

      if (type === 'tool.complete') {
        const toolCallId = (ev.toolCallId ?? '') as string;
        const result = (ev.result ?? '') as string;
        // Try to detect file edits from result diffs
        if (result && toolCallId) {
          const lines = result.split('\n');
          for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) next.linesAdded += 1;
            if (line.startsWith('-') && !line.startsWith('---')) next.linesRemoved += 1;
          }
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

      {/* File Stats */}
      <Section title="File Stats">
        <OdometerCounter label="FILES CHANGED" value={stats.filesChanged} size="sm" />
        <div className="flex gap-4">
          <OdometerCounter label="LINES +" value={stats.linesAdded} size="sm" color="var(--accent-green)" />
          <OdometerCounter label="LINES −" value={stats.linesRemoved} size="sm" color="var(--accent-red)" />
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
