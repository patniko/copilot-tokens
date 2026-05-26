/**
 * MessageList — reusable message renderer extracted from ReelArea.
 * Renders an array of ConversationMessages using the tile registry and built-in tiles.
 * Used in both the main chat feed and the SubagentDetailOverlay.
 */
import type { ConversationMessage } from '../lib/types';
import {
  MessageTile,
  BashTile,
  FileEditTile,
  FileReadTile,
  GenericToolTile,
  ReasoningTile,
  ErrorBanner,
  ModelChangeBanner,
  TruncationWarning,
  CompactionBanner,
  ShutdownReport,
  SkillBanner,
  HookBanner,
} from './tiles';
import { getTileRenderer } from '../lib/tile-registry';

interface MessageListProps {
  messages: ConversationMessage[];
  /** Compact mode reduces spacing for overlay use */
  compact?: boolean;
}

export default function MessageList({ messages, compact }: MessageListProps) {
  const gap = compact ? 'gap-2' : 'gap-4';

  return (
    <div className={`flex flex-col ${gap}`}>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.type === 'assistant' && (
            <MessageTile content={msg.content} isStreaming={msg.isStreaming} />
          )}
          {msg.type === 'tool_call' && renderToolCall(msg)}
          {msg.type === 'reasoning' && (
            <ReasoningTile
              content={msg.content}
              isStreaming={msg.isStreaming}
              reasoningId={msg.reasoningId}
            />
          )}
          {msg.type === 'session_event' && renderSessionEvent(msg)}
        </div>
      ))}
    </div>
  );
}

function renderToolCall(msg: ConversationMessage & { type: 'tool_call' }) {
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

  if (msg.toolType === 'bash') {
    return (
      <BashTile
        command={String(msg.data.command ?? msg.title)}
        output={msg.data.output ? String(msg.data.output) : undefined}
        isRunning={!msg.data.completed}
        progress={msg.data.progress ? String(msg.data.progress) : undefined}
        success={typeof msg.data.success === 'boolean' ? (msg.data.success as boolean) : undefined}
        error={msg.data.error ? String(msg.data.error) : undefined}
      />
    );
  }

  if (msg.toolType === 'file_edit') {
    return (
      <FileEditTile
        path={String(msg.data.path ?? msg.data.fileName ?? msg.title)}
        diff={msg.data.diff ? String(msg.data.diff) : undefined}
        isRunning={!msg.data.completed}
        data={msg.data}
      />
    );
  }

  if (msg.toolType === 'file_read') {
    return (
      <FileReadTile
        path={String(msg.data.path ?? msg.title)}
        content={msg.data.content ? String(msg.data.content) : undefined}
        isRunning={!msg.data.completed}
      />
    );
  }

  return (
    <GenericToolTile
      title={msg.title}
      data={msg.data}
      isRunning={!msg.data.completed}
      success={typeof msg.data.success === 'boolean' ? (msg.data.success as boolean) : undefined}
      error={msg.data.error ? String(msg.data.error) : undefined}
      progress={msg.data.progress ? String(msg.data.progress) : undefined}
    />
  );
}

function renderSessionEvent(msg: ConversationMessage & { type: 'session_event' }) {
  switch (msg.eventType) {
    case 'error':
      return <ErrorBanner errorType={String(msg.data.errorType)} message={String(msg.data.message)} statusCode={msg.data.statusCode as number | undefined} />;
    case 'model_change':
      return <ModelChangeBanner previousModel={msg.data.previousModel as string | undefined} newModel={String(msg.data.newModel)} />;
    case 'truncation':
      return <TruncationWarning tokensRemoved={msg.data.tokensRemoved as number} messagesRemoved={msg.data.messagesRemoved as number} />;
    case 'compaction_start':
      return <CompactionBanner phase="start" />;
    case 'compaction_complete':
      return <CompactionBanner phase="complete" preTokens={msg.data.preTokens as number | undefined} postTokens={msg.data.postTokens as number | undefined} summary={msg.data.summary as string | undefined} />;
    case 'shutdown':
      return (
        <ShutdownReport
          totalRequests={msg.data.totalRequests as number}
          totalApiDurationMs={msg.data.totalApiDurationMs as number}
          linesAdded={msg.data.linesAdded as number}
          linesRemoved={msg.data.linesRemoved as number}
          filesModified={msg.data.filesModified as string[]}
          modelMetrics={msg.data.modelMetrics as Record<string, { requests: { count: number; cost: number }; usage: { inputTokens: number; outputTokens: number } }>}
        />
      );
    case 'skill':
      return <SkillBanner name={String(msg.data.name)} allowedTools={msg.data.allowedTools as string[] | undefined} />;
    case 'hook_start':
    case 'hook_end':
      return <HookBanner hookType={String(msg.data.hookType)} phase={msg.eventType === 'hook_start' ? 'start' : 'end'} success={msg.data.success as boolean | undefined} />;
    default:
      return null;
  }
}
