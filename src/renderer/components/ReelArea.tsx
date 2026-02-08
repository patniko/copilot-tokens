import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

interface ReelAreaProps {
  userPrompt: string | null;
  onUserMessage?: (msg: UserMessage) => void;
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


export default function ReelArea({ userPrompt, onUserMessage }: ReelAreaProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
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
      onUserMessage?.(msg);
      // Reset so next assistant deltas start a fresh message
      currentAssistantIdRef.current = null;
    }
    if (userPrompt === null) {
      lastPromptRef.current = null;
    }
  }, [userPrompt, onUserMessage]);

  // Listen to copilot events
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const unsubscribe = window.copilotAPI.onEvent((raw: unknown) => {
      const event = raw as CopilotEvent;

      switch (event.type) {
        case 'assistant.message_delta': {
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

        case 'tool_call.bash': {
          const msg: ToolCallMessage = {
            id: generateId(),
            type: 'tool_call',
            toolType: 'bash',
            title: event.command,
            data: { command: event.command, output: event.output },
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, msg]);
          break;
        }

        case 'tool_call.file_edit': {
          const msg: ToolCallMessage = {
            id: generateId(),
            type: 'tool_call',
            toolType: 'file_edit',
            title: event.path,
            data: { path: event.path, diff: event.diff },
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, msg]);
          break;
        }

        case 'tool_call.file_read': {
          const msg: ToolCallMessage = {
            id: generateId(),
            type: 'tool_call',
            toolType: 'file_read',
            title: event.path,
            data: { path: event.path, content: event.content },
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, msg]);
          break;
        }

        case 'session.idle': {
          setMessages((prev) =>
            prev.map((m) =>
              m.type === 'assistant' && m.isStreaming
                ? { ...m, isStreaming: false }
                : m,
            ),
          );
          currentAssistantIdRef.current = null;
          break;
        }
      }
    });

    return unsubscribe;
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const springTransition = useMemo(
    () => ({ type: 'spring' as const, stiffness: 300, damping: 25 }),
    [],
  );

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
        <span className="text-6xl">🎰</span>
        <p className="text-lg">Pull the lever to start!</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
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
              {msg.type === 'tool_call' && msg.toolType === 'bash' && (
                <BashTile
                  command={String(msg.data.command ?? msg.title)}
                  output={msg.data.output ? String(msg.data.output) : undefined}
                />
              )}
              {msg.type === 'tool_call' && msg.toolType === 'file_edit' && (
                <FileEditTile
                  path={String(msg.data.path ?? msg.title)}
                  diff={msg.data.diff ? String(msg.data.diff) : undefined}
                />
              )}
              {msg.type === 'tool_call' && msg.toolType === 'file_read' && (
                <FileReadTile
                  path={String(msg.data.path ?? msg.title)}
                  content={msg.data.content ? String(msg.data.content) : undefined}
                />
              )}
              {msg.type === 'tool_call' && msg.toolType === 'generic' && (
                <GenericToolTile title={msg.title} data={msg.data} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
