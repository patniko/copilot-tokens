import { useState, useEffect } from 'react';
import { renderInline } from '../../lib/render-inline';
import type { TileProps } from '../../lib/tile-registry';
import type { SubagentSummary, SubagentType } from '../../../shared/subagent-types';

const AGENT_ICONS: Record<string, string> = {
  explore: '🔍',
  task: '⚡',
  'general-purpose': '🧠',
  'rubber-duck': '🦆',
  'code-review': '📋',
  'configure-copilot': '⚙️',
};

function agentIcon(agentType: SubagentType): string {
  return AGENT_ICONS[agentType] ?? '🤖';
}

function formatElapsed(startedAt: number, completedAt?: number): string {
  const elapsed = (completedAt ?? Date.now()) - startedAt;
  if (elapsed < 1000) return '<1s';
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s`;
  return `${Math.floor(elapsed / 60_000)}m ${Math.floor((elapsed % 60_000) / 1000)}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

interface SubagentTileProps extends TileProps {
  onOpenDetail?: (agentId: string) => void;
}

export default function SubagentTile({ data, isRunning, success, error, onOpenDetail }: SubagentTileProps) {
  const displayName = String(data.displayName ?? data.name ?? 'Sub-agent');
  const description = String(data.description ?? '');
  const agentType = String(data.agentType ?? data.name ?? '') as SubagentType;
  const agentId = data.agentId as string | undefined;
  const toolCallId = data.toolCallId as string | undefined;
  const completed = Boolean(data.completed);
  const agentSuccess = data.success !== undefined ? Boolean(data.success) : success;

  // Poll for live sub-agent summary
  const [summary, setSummary] = useState<SubagentSummary | null>(null);
  const panelId = (data._panelId as string) || 'main';

  useEffect(() => {
    if (completed || !agentId) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const info = await window.subagentAPI?.read(panelId, agentId);
        if (!cancelled && info) setSummary(info as SubagentSummary);
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 2000);
    // Also listen for change events
    const unsub = window.subagentAPI?.onChanged(() => { poll(); }, panelId);
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsub?.();
    };
  }, [agentId, panelId, completed]);

  const intent = summary?.progress?.currentIntent;
  const toolCalls = summary?.progress?.toolCallsCompleted ?? (data.totalToolCalls as number | undefined);
  const tokens = summary?.totalTokens ?? (data.totalTokens as number | undefined);
  const startedAt = summary?.startedAt ?? (data.startedAt as number | undefined);
  const model = summary?.model ?? (data.model as string | undefined);

  const borderColor = error || (completed && agentSuccess === false)
    ? 'var(--accent-red)'
    : completed
    ? 'var(--accent-green)'
    : 'var(--accent-purple)';

  const handleClick = () => {
    const id = agentId || (toolCallId ? undefined : undefined);
    if (id && onOpenDetail) onOpenDetail(id);
  };

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden transition-colors"
      style={{
        borderLeft: `4px solid ${borderColor}`,
        marginLeft: '12px',
        backgroundColor: 'rgba(0,0,0,0.15)',
        cursor: agentId ? 'pointer' : undefined,
      }}
      onClick={handleClick}
      role={agentId ? 'button' : undefined}
      tabIndex={agentId ? 0 : undefined}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1 min-w-0">
        <span className="text-base" style={isRunning && !completed ? { animation: 'pulse-icon 2s ease-in-out infinite' } : undefined}>
          {agentIcon(agentType)}
        </span>
        <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {renderInline(displayName)}
        </span>
        {/* Status badge */}
        {isRunning && !completed && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: 'rgba(168,85,247,0.2)', color: 'var(--accent-purple)' }}>
            running
          </span>
        )}
        {completed && agentSuccess !== false && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: 'rgba(63,185,80,0.2)', color: 'var(--accent-green)' }}>
            done
          </span>
        )}
        {completed && agentSuccess === false && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: 'rgba(248,81,73,0.2)', color: 'var(--accent-red)' }}>
            failed
          </span>
        )}
      </div>

      {/* Description */}
      {description !== '' && (
        <div className="text-xs mb-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {renderInline(description)}
        </div>
      )}

      {/* Current intent */}
      {intent && !completed && (
        <div className="text-xs mb-1.5 italic truncate" style={{ color: 'var(--accent-blue)' }}>
          {intent}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        {startedAt && (
          <span>⏱ {formatElapsed(startedAt, completed ? (summary?.completedAt ?? Date.now()) : undefined)}</span>
        )}
        {toolCalls != null && toolCalls > 0 && (
          <span>🔧 {toolCalls}</span>
        )}
        {tokens != null && tokens > 0 && (
          <span>🎰 {formatTokens(tokens)}</span>
        )}
        {model && (
          <span className="truncate max-w-[120px]">{model}</span>
        )}
      </div>

      {/* Error */}
      {(error || (data.error != null && !error)) && (
        <div className="text-xs font-mono mt-1.5 truncate" style={{ color: 'var(--accent-red)' }}>
          {error || String(data.error)}
        </div>
      )}

      {/* Click hint */}
      {agentId && (
        <div className="text-[9px] mt-1.5 opacity-50" style={{ color: 'var(--text-secondary)' }}>
          Click to inspect
        </div>
      )}

      <style>{`
        @keyframes pulse-icon {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
