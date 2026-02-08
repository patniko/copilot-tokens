import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import logoImg from '../../../logo-128.png';
import type { CopilotEvent } from '../../main/copilot-service';
import type {
  ConversationMessage,
  UserMessage,
  AssistantMessage,
  ToolCallMessage,
} from '../lib/types';
import {
  MessageTile,
  BashTile,
  FileEditTile,
  FileReadTile,
  GenericToolTile,
  UserBubble,
} from './tiles';
import { partyBus, PartyEvents } from '../lib/party-bus';
import { getTileRenderer } from '../lib/tile-registry';
import PermissionDialog from './PermissionDialog';
import type { PermissionRequestData, PermissionDecision } from './PermissionDialog';

interface ReelAreaProps {
  panelId?: string;
  userPrompt: string | null;
  onUserMessage?: (msg: UserMessage) => void;
  onUsage?: (input: number, output: number) => void;
  permissionRequest?: PermissionRequestData | null;
  onPermissionRespond?: (decision: PermissionDecision) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Stable random offsets keyed by message id
const offsetCache = new Map<string, number>();
function getRandomOffset(id: string): number {
  if (!offsetCache.has(id)) {
    offsetCache.set(id, (Math.random() - 0.5) * 20);
  }
  return offsetCache.get(id)!;
}

function toolTypeFromName(toolName: string): ToolCallMessage['toolType'] {
  if (toolName === 'bash' || toolName === 'shell') return 'bash';
  if (toolName === 'edit' || toolName === 'create' || toolName === 'write') return 'file_edit';
  if (toolName === 'view' || toolName === 'read' || toolName === 'glob' || toolName === 'grep') return 'file_read';
  return 'generic';
}

// Tools that should be silently hidden (just update UI state, not shown as tiles)
const HIDDEN_TOOLS = new Set(['report_intent', 'ask_user']);

/** Fields to skip when picking a human-readable subtitle from tool args */
const TITLE_SKIP = new Set(['path', 'file', 'command', 'cmd', 'completed', 'success', '_toolName']);

function toolTitleFromArgs(toolName: string, toolType: ToolCallMessage['toolType'], args: Record<string, unknown>): string {
  if (toolType === 'bash') return String(args.command ?? toolName);
  if (toolType === 'file_edit') return String(args.path ?? toolName);
  if (toolType === 'file_read') return String(args.path ?? args.pattern ?? toolName);
  if (toolName === 'task') return `🤖 Sub-agent: ${String(args.description ?? toolName)}`;
  // Generic: pick the first short string value as a subtitle
  for (const [k, v] of Object.entries(args)) {
    if (TITLE_SKIP.has(k)) continue;
    if (typeof v === 'string' && v.length > 0 && v.length <= 100) {
      return `${toolName}: ${v}`;
    }
  }
  return toolName;
}


export default function ReelArea({ panelId, userPrompt, onUserMessage, onUsage, permissionRequest, onPermissionRespond }: ReelAreaProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [intent, setIntent] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [streamSnippet, setStreamSnippet] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPromptRef = useRef<string | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  // Handle userPrompt changes
  useEffect(() => {
    if (userPrompt !== null && userPrompt !== lastPromptRef.current) {
      lastPromptRef.current = userPrompt;
      const msg: UserMessage = {
        id: generateId(),
        type: 'user',
        content: userPrompt,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, msg]);
      setIsWaiting(true);
      setIsGenerating(true);
      setElapsedSec(0);
      onUserMessage?.(msg);
      currentAssistantIdRef.current = null;
    }
    if (userPrompt === null) {
      lastPromptRef.current = null;
    }
  }, [userPrompt, onUserMessage]);

  // Listen to copilot events (panel-specific channel)
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const unsubscribe = window.copilotAPI.onEvent((raw: unknown) => {
      const event = raw as CopilotEvent;

      switch (event.type) {
        case 'assistant.message_delta': {
          setIsWaiting(false);
          // Feed the streaming snippet for the activity bar
          setStreamSnippet((prev) => {
            const next = prev + event.delta;
            // Keep only the last ~120 chars for the preview
            return next.length > 120 ? next.slice(-120) : next;
          });
          setMessages((prev) => {
            const currentId = currentAssistantIdRef.current;
            if (currentId) {
              return prev.map((m) =>
                m.id === currentId && m.type === 'assistant'
                  ? { ...m, content: m.content + event.delta }
                  : m,
              );
            }
            const newId = generateId();
            currentAssistantIdRef.current = newId;
            const msg: AssistantMessage = {
              id: newId,
              type: 'assistant',
              content: event.delta,
              timestamp: Date.now(),
              isStreaming: true,
            };
            return [...prev, msg];
          });
          break;
        }

        case 'assistant.message': {
          // Final message — just mark streaming done, content already accumulated from deltas
          setStreamSnippet('');
          setMessages((prev) => {
            const currentId = currentAssistantIdRef.current;
            if (currentId) {
              return prev.map((m) =>
                m.id === currentId && m.type === 'assistant'
                  ? { ...m, isStreaming: false }
                  : m,
              );
            }
            return prev;
          });
          break;
        }

        case 'assistant.intent': {
          setIsWaiting(false);
          setIntent(event.intent);
          break;
        }

        case 'assistant.usage': {
          onUsage?.(event.inputTokens, event.outputTokens);
          break;
        }

        case 'tool.start': {
          setIsWaiting(false);
          setStreamSnippet('');
          partyBus.emit(PartyEvents.TOOL_START, event.toolName, event.toolCallId);
          // report_intent: update the intent badge instead of creating a tile
          if (event.toolName === 'report_intent') {
            const intentText = String(event.args.intent ?? event.args.description ?? '');
            if (intentText) setIntent(intentText);
            break;
          }
          // Skip other hidden tools
          if (HIDDEN_TOOLS.has(event.toolName)) break;
          const tt = toolTypeFromName(event.toolName);
          const title = toolTitleFromArgs(event.toolName, tt, event.args);
          const msg: ToolCallMessage = {
            id: generateId(),
            type: 'tool_call',
            toolType: tt,
            title,
            data: { ...event.args, completed: false, _toolName: event.toolName },
            toolCallId: event.toolCallId,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, msg]);
          // Tool calls interrupt assistant streaming — reset so next deltas start fresh
          currentAssistantIdRef.current = null;
          break;
        }

        case 'tool.partial': {
          setMessages((prev) =>
            prev.map((m) =>
              m.type === 'tool_call' && m.toolCallId === event.toolCallId
                ? { ...m, data: { ...m.data, output: (m.data.output ? String(m.data.output) : '') + event.output } }
                : m,
            ),
          );
          break;
        }

        case 'tool.progress': {
          setMessages((prev) =>
            prev.map((m) =>
              m.type === 'tool_call' && m.toolCallId === event.toolCallId
                ? { ...m, data: { ...m.data, progress: event.message } }
                : m,
            ),
          );
          break;
        }

        case 'tool.complete': {
          partyBus.emit(
            event.success ? PartyEvents.TOOL_COMPLETE : PartyEvents.TOOL_ERROR,
            event.toolCallId,
            event.error,
          );
          setMessages((prev) =>
            prev.map((m) => {
              if (m.type !== 'tool_call' || m.toolCallId !== event.toolCallId) return m;
              const updated: Record<string, unknown> = { ...m.data, completed: true, success: event.success };
              if (event.error) updated.error = event.error;
              if (event.result) {
                if (m.toolType === 'bash' && !m.data.output) updated.output = event.result;
                else if (m.toolType === 'file_edit') updated.result = event.result;
                else if (m.toolType === 'file_read') updated.content = event.result;
                else updated.result = event.result;
              }
              return { ...m, data: updated };
            }),
          );
          break;
        }

        case 'subagent.started': {
          const msg: ToolCallMessage = {
            id: generateId(),
            type: 'tool_call',
            toolType: 'generic',
            title: `🤖 ${event.displayName}: ${event.description}`,
            data: { name: event.name, completed: false },
            toolCallId: event.toolCallId,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, msg]);
          break;
        }

        case 'subagent.completed': {
          setMessages((prev) =>
            prev.map((m) =>
              m.type === 'tool_call' && m.toolCallId === event.toolCallId
                ? { ...m, data: { ...m.data, completed: true, success: true } }
                : m,
            ),
          );
          break;
        }

        case 'subagent.failed': {
          setMessages((prev) =>
            prev.map((m) =>
              m.type === 'tool_call' && m.toolCallId === event.toolCallId
                ? { ...m, data: { ...m.data, completed: true, success: false, error: event.error } }
                : m,
            ),
          );
          break;
        }

        case 'session.idle': {
          setIsWaiting(false);
          setIsGenerating(false);
          setStreamSnippet('');
          partyBus.emit(PartyEvents.SESSION_IDLE);
          setMessages((prev) =>
            prev.map((m) =>
              m.type === 'assistant' && m.isStreaming
                ? { ...m, isStreaming: false }
                : m,
            ),
          );
          currentAssistantIdRef.current = null;
          setIntent(null);
          break;
        }
      }
    }, panelId);

    return unsubscribe;
  }, [onUsage, panelId]);

  // Elapsed time timer while generating
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Auto-scroll on new messages or permission request
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, permissionRequest]);

  const springTransition = useMemo(
    () => ({ type: 'spring' as const, stiffness: 300, damping: 25 }),
    [],
  );

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-4 text-[var(--text-secondary)]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <img src={logoImg} alt="Copilot Tokens" className="w-16 h-16 opacity-60" />
          <p className="text-lg font-medium text-[var(--text-primary)]">What would you like to build?</p>
          <p className="text-sm max-w-md text-center leading-relaxed">
            Describe a task, paste an error, or ask a question — your agent will get to work.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-6 flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const xOffset = getRandomOffset(msg.id);

            return (
              <motion.div
                key={msg.id}
                initial={{ y: 100, opacity: 0, scale: 0.9, x: xOffset }}
                animate={{ y: 0, opacity: 1, scale: 1, x: xOffset }}
                transition={springTransition}
                layout
              >
                {msg.type === 'user' && <UserBubble content={msg.content} />}
                {msg.type === 'assistant' && (
                  <MessageTile content={msg.content} isStreaming={msg.isStreaming} />
                )}
                {msg.type === 'tool_call' && (() => {
                  const toolName = msg.data._toolName as string | undefined;
                  const CustomTile = toolName ? getTileRenderer(toolName) : undefined;
                  if (CustomTile) {
                    return (
                      <CustomTile
                        title={msg.title}
                        data={msg.data}
                        isRunning={!msg.data.completed}
                        success={typeof msg.data.success === 'boolean' ? (msg.data.success as boolean) : undefined}
                        error={msg.data.error ? String(msg.data.error) : undefined}
                        progress={msg.data.progress ? String(msg.data.progress) : undefined}
                      />
                    );
                  }
                  return null;
                })()}
                {msg.type === 'tool_call' && !getTileRenderer(msg.data._toolName as string) && msg.toolType === 'bash' && (
                  <BashTile
                    command={String(msg.data.command ?? msg.title)}
                    output={msg.data.output ? String(msg.data.output) : undefined}
                    isRunning={!msg.data.completed}
                    progress={msg.data.progress ? String(msg.data.progress) : undefined}
                    success={typeof msg.data.success === 'boolean' ? (msg.data.success as boolean) : undefined}
                    error={msg.data.error ? String(msg.data.error) : undefined}
                  />
                )}
                {msg.type === 'tool_call' && !getTileRenderer(msg.data._toolName as string) && msg.toolType === 'file_edit' && (
                  <FileEditTile
                    path={String(msg.data.path ?? msg.data.fileName ?? msg.title)}
                    diff={msg.data.diff ? String(msg.data.diff) : undefined}
                    isRunning={!msg.data.completed}
                    data={msg.data}
                  />
                )}
                {msg.type === 'tool_call' && !getTileRenderer(msg.data._toolName as string) && msg.toolType === 'file_read' && (
                  <FileReadTile
                    path={String(msg.data.path ?? msg.title)}
                    content={msg.data.content ? String(msg.data.content) : undefined}
                    isRunning={!msg.data.completed}
                  />
                )}
                {msg.type === 'tool_call' && !getTileRenderer(msg.data._toolName as string) && msg.toolType === 'generic' && (
                  <GenericToolTile
                    title={msg.title}
                    data={msg.data}
                    isRunning={!msg.data.completed}
                    success={typeof msg.data.success === 'boolean' ? (msg.data.success as boolean) : undefined}
                    error={msg.data.error ? String(msg.data.error) : undefined}
                    progress={msg.data.progress ? String(msg.data.progress) : undefined}
                  />
                )}
              </motion.div>
            );
          })}

          {/* Permission request — inline in chat */}
          {permissionRequest && onPermissionRespond && (
            <motion.div
              key="permission"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <PermissionDialog request={permissionRequest} onRespond={onPermissionRespond} />
            </motion.div>
          )}

          {/* Thinking indicator — shown after user sends, before first event */}
          {isWaiting && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'var(--accent-purple)' }}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <span className="text-sm text-[var(--text-secondary)] italic">Thinking…</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky activity bar — always visible at bottom during generation */}
      <AnimatePresence>
        {isGenerating && !isWaiting && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="shrink-0 flex items-center gap-3 px-4 py-2 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]"
          >
            {/* Animated progress bar */}
            <div className="relative w-5 h-5 shrink-0">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent"
                style={{ borderTopColor: 'var(--accent-purple)', borderRightColor: 'var(--accent-blue)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>

            {/* Intent or status + streaming preview */}
            <div className="flex-1 min-w-0">
              {intent ? (
                <span className="text-xs font-medium text-[var(--accent-purple)] truncate block">
                  {intent}
                </span>
              ) : streamSnippet ? (
                <span className="text-xs text-[var(--text-secondary)] truncate block opacity-70">
                  {streamSnippet.trimStart()}
                </span>
              ) : (
                <span className="text-xs text-[var(--text-secondary)] italic">Agent is working…</span>
              )}
            </div>

            {/* Elapsed time */}
            <span className="text-[10px] tabular-nums text-[var(--text-secondary)] shrink-0">
              {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
