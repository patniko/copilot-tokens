/**
 * SubagentBar — persistent compact bar showing active sub-agents.
 * Panel-scoped: sits above the PromptBar inside each ChatPanel.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { SubagentSummary, SubagentStatus } from '../../shared/subagent-types';

const STATUS_DOT: Record<SubagentStatus, { color: string; label: string }> = {
  running: { color: 'var(--accent-green)', label: 'running' },
  idle: { color: 'var(--accent-gold)', label: 'idle' },
  completed: { color: 'var(--accent-blue)', label: 'done' },
  failed: { color: 'var(--accent-red)', label: 'failed' },
  cancelled: { color: 'var(--text-secondary)', label: 'cancelled' },
};

const AGENT_ICONS: Record<string, string> = {
  explore: '🔍',
  task: '⚡',
  'general-purpose': '🧠',
  'rubber-duck': '🦆',
  'code-review': '📋',
  'configure-copilot': '⚙️',
};

interface SubagentBarProps {
  panelId: string;
  onOpenDetail: (agentId: string) => void;
}

export default function SubagentBar({ panelId, onOpenDetail }: SubagentBarProps) {
  const [agents, setAgents] = useState<SubagentSummary[]>([]);

  const refresh = useCallback(async () => {
    try {
      const list = await window.subagentAPI?.list(panelId);
      if (list) setAgents(list);
    } catch { /* ignore */ }
  }, [panelId]);

  useEffect(() => {
    refresh();
    const unsub = window.subagentAPI?.onChanged(() => refresh(), panelId);
    // Also poll every 3s for elapsed time updates
    const interval = setInterval(refresh, 3000);
    return () => {
      unsub?.();
      clearInterval(interval);
    };
  }, [panelId, refresh]);

  // Only show active agents (running or idle), plus recently completed/failed (last 30s)
  const cutoff = Date.now() - 30_000;
  const visible = agents.filter(
    (a) => a.status === 'running' || a.status === 'idle' || (a.completedAt && a.completedAt > cutoff),
  );

  if (visible.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden border-t"
        style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(0,0,0,0.2)' }}
      >
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-thin">
          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--text-secondary)' }}>
            AGENTS
          </span>
          {visible.map((agent) => (
            <AgentChip key={agent.agentId} agent={agent} onClick={() => onOpenDetail(agent.agentId)} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function AgentChip({ agent, onClick }: { agent: SubagentSummary; onClick: () => void }) {
  const dot = STATUS_DOT[agent.status] ?? STATUS_DOT.running;
  const icon = AGENT_ICONS[agent.agentType] ?? '🤖';
  const elapsed = formatElapsed(agent.startedAt, agent.completedAt);
  const isActive = agent.status === 'running' || agent.status === 'idle';

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all hover:scale-105 active:scale-95"
      style={{
        backgroundColor: isActive ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
        color: 'var(--text-primary)',
        border: `1px solid ${isActive ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {/* Status dot */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          backgroundColor: dot.color,
          boxShadow: isActive ? `0 0 4px ${dot.color}` : undefined,
          animation: agent.status === 'running' ? 'chip-pulse 2s ease-in-out infinite' : undefined,
        }}
      />
      <span>{icon}</span>
      <span className="truncate max-w-[100px]">{agent.displayName}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{elapsed}</span>
      <style>{`
        @keyframes chip-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </button>
  );
}

function formatElapsed(startedAt: number, completedAt?: number): string {
  const elapsed = (completedAt ?? Date.now()) - startedAt;
  if (elapsed < 1000) return '<1s';
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s`;
  return `${Math.floor(elapsed / 60_000)}m`;
}
