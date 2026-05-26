/**
 * SubagentDetailOverlay — full-screen overlay showing sub-agent conversation,
 * tool calls, and a steering input bar for sending messages.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { SubagentInfo, SubagentStatus } from '../../shared/subagent-types';
import type { ConversationMessage, ToolCallMessage, AssistantMessage } from '../lib/types';
import MessageList from './MessageList';

const STATUS_COLORS: Record<SubagentStatus, string> = {
  running: 'var(--accent-green)',
  idle: 'var(--accent-gold)',
  completed: 'var(--accent-blue)',
  failed: 'var(--accent-red)',
  cancelled: 'var(--text-secondary)',
};

const AGENT_ICONS: Record<string, string> = {
  explore: '🔍',
  task: '⚡',
  'general-purpose': '🧠',
  'rubber-duck': '🦆',
  'code-review': '📋',
  'configure-copilot': '⚙️',
};

interface SubagentDetailOverlayProps {
  panelId: string;
  agentId: string | null;
  onClose: () => void;
}

function formatElapsed(startedAt: number, completedAt?: number): string {
  const elapsed = (completedAt ?? Date.now()) - startedAt;
  if (elapsed < 1000) return '<1s';
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s`;
  const mins = Math.floor(elapsed / 60_000);
  const secs = Math.floor((elapsed % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/** Convert SubagentInfo turns/toolCalls/streaming into ConversationMessages for MessageList */
function agentToMessages(agent: SubagentInfo): ConversationMessage[] {
  const msgs: ConversationMessage[] = [];
  let id = 0;

  for (const turn of agent.turns) {
    // Show inbound message as a "user" message from the parent or operator
    if (turn.inboundMessage) {
      msgs.push({
        id: `sa-${agent.agentId}-inbound-${id++}`,
        type: 'user',
        content: turn.inboundMessage.fromAgentId
          ? `[From ${turn.inboundMessage.fromAgentId}] ${turn.inboundMessage.content}`
          : turn.inboundMessage.content,
        timestamp: turn.timestamp,
      });
    }
    // Show agent response
    if (turn.response) {
      msgs.push({
        id: `sa-${agent.agentId}-resp-${id++}`,
        type: 'assistant',
        content: turn.response,
        isStreaming: false,
        timestamp: turn.timestamp,
      } as AssistantMessage);
    }
  }

  // Show tool calls
  for (const tc of agent.toolCalls) {
    msgs.push({
      id: `sa-${agent.agentId}-tc-${tc.toolCallId}`,
      type: 'tool_call',
      toolType: toolTypeFromName(tc.toolName),
      title: tc.toolName,
      data: {
        ...tc.args,
        _toolName: tc.toolName,
        completed: tc.completed,
        success: tc.success,
        result: tc.result,
        error: tc.error,
        output: tc.result,
      },
      toolCallId: tc.toolCallId,
      timestamp: tc.startedAt,
    } as ToolCallMessage);
  }

  // Current streaming content as a live assistant message
  if (agent.streamingContent) {
    msgs.push({
      id: `sa-${agent.agentId}-stream`,
      type: 'assistant',
      content: agent.streamingContent,
      isStreaming: agent.status === 'running',
      timestamp: Date.now(),
    } as AssistantMessage);
  }

  // Sort by timestamp
  msgs.sort((a, b) => a.timestamp - b.timestamp);
  return msgs;
}

function toolTypeFromName(name: string): ToolCallMessage['toolType'] {
  if (name === 'bash' || name === 'shell') return 'bash';
  if (name === 'edit' || name === 'create' || name === 'write') return 'file_edit';
  if (name === 'view' || name === 'read' || name === 'glob' || name === 'grep') return 'file_read';
  return 'generic';
}

export default function SubagentDetailOverlay({ panelId, agentId, onClose }: SubagentDetailOverlayProps) {
  const [agent, setAgent] = useState<SubagentInfo | null>(null);
  const [steerInput, setSteerInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Poll agent detail
  const refresh = useCallback(async () => {
    if (!agentId) return;
    try {
      const info = await window.subagentAPI?.read(panelId, agentId);
      if (info) setAgent(info);
    } catch { /* ignore */ }
  }, [panelId, agentId]);

  useEffect(() => {
    if (!agentId) return;
    refresh();
    const unsub = window.subagentAPI?.onChanged(() => refresh(), panelId);
    const interval = setInterval(refresh, 1500);
    return () => {
      unsub?.();
      clearInterval(interval);
    };
  }, [panelId, agentId, refresh]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [agent]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Focus input on open
  useEffect(() => {
    if (agentId) inputRef.current?.focus();
  }, [agentId]);

  const handleSend = async () => {
    if (!steerInput.trim() || !agentId || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const result = await window.subagentAPI?.write(panelId, agentId, steerInput.trim());
      if (result && !result.success) {
        setSendError(result.error ?? 'Failed to send');
      } else {
        setSteerInput('');
      }
      refresh();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    }
    setSending(false);
  };

  const handleCancel = async () => {
    if (!agentId) return;
    const result = await window.subagentAPI?.cancel(panelId, agentId);
    if (result && !result.success) {
      setSendError(result.error ?? 'Failed to cancel');
    }
    refresh();
  };

  if (!agentId) return null;

  const messages = agent ? agentToMessages(agent) : [];
  const icon = AGENT_ICONS[agent?.agentType ?? ''] ?? '🤖';
  const statusColor = STATUS_COLORS[agent?.status ?? 'running'];
  const isActive = agent?.status === 'running' || agent?.status === 'idle';

  return (
    <AnimatePresence>
      <motion.div
        key="subagent-backdrop"
        className="fixed inset-0 z-40 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        key="subagent-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <div
          className="pointer-events-auto w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xl">{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                  {agent?.displayName ?? 'Sub-agent'}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${statusColor}22`, color: statusColor }}
                >
                  {agent?.status ?? 'loading'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {agent?.startedAt && <span>⏱ {formatElapsed(agent.startedAt, agent.completedAt)}</span>}
                {agent?.progress.toolCallsCompleted ? <span>🔧 {agent.progress.toolCallsCompleted}</span> : null}
                {(agent?.totalTokens ?? 0) > 0 && <span>🎰 {formatTokens(agent!.totalTokens!)}</span>}
                {agent?.model && <span className="truncate max-w-[150px]">{agent.model}</span>}
                {agent?.progress.currentIntent && (
                  <span className="italic truncate max-w-[200px]" style={{ color: 'var(--accent-blue)' }}>
                    {agent.progress.currentIntent}
                  </span>
                )}
              </div>
            </div>
            {/* Cancel button */}
            {isActive && (
              <button
                onClick={handleCancel}
                className="text-xs px-2 py-1 rounded transition-colors hover:bg-red-900/30"
                style={{ color: 'var(--accent-red)', border: '1px solid rgba(248,81,73,0.3)' }}
              >
                Cancel
              </button>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="text-lg leading-none opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-primary)' }}
            >
              ✕
            </button>
          </div>

          {/* Description */}
          {agent?.description && (
            <div className="px-5 py-2 text-xs" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {agent.description}
            </div>
          )}

          {/* Conversation body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-5">
            {messages.length > 0 ? (
              <MessageList messages={messages} compact />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
                  {agent?.status === 'running' ? (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl" style={{ animation: 'pulse-icon 2s ease-in-out infinite' }}>
                        {icon}
                      </span>
                      <span className="text-sm">Agent is working…</span>
                    </div>
                  ) : (
                    <span className="text-sm">No conversation data yet</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error banner */}
          {agent?.error && (
            <div className="px-5 py-2 text-xs font-mono" style={{ color: 'var(--accent-red)', backgroundColor: 'rgba(248,81,73,0.08)', borderTop: '1px solid rgba(248,81,73,0.2)' }}>
              {agent.error}
            </div>
          )}

          {/* Steering input bar */}
          <div className="px-4 py-3 shrink-0 flex flex-col gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(0,0,0,0.15)' }}>
            {sendError && (
              <div className="text-[10px] px-1" style={{ color: 'var(--accent-red)' }}>
                {sendError}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={steerInput}
                onChange={(e) => { setSteerInput(e.target.value); setSendError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                placeholder={isActive ? 'Send steering instructions to this agent…' : 'Agent is no longer active'}
                disabled={!isActive}
                className="flex-1 text-sm px-3 py-2 rounded-lg border-none outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  opacity: isActive ? 1 : 0.5,
                }}
              />
              <button
                onClick={handleSend}
                disabled={!isActive || !steerInput.trim() || sending}
                className="text-xs px-3 py-2 rounded-lg font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                style={{
                  backgroundColor: 'var(--accent-purple)',
                  color: 'white',
                }}
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <style>{`
        @keyframes pulse-icon {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </AnimatePresence>
  );
}
