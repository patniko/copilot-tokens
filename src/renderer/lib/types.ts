export interface UserMessage {
  id: string;
  type: 'user';
  content: string;
  timestamp: number;
}

export interface AssistantMessage {
  id: string;
  type: 'assistant';
  content: string;
  timestamp: number;
  isStreaming: boolean;
}

export interface ToolCallMessage {
  id: string;
  type: 'tool_call';
  toolType: 'bash' | 'file_edit' | 'file_read' | 'generic';
  title: string;
  data: Record<string, unknown>;
  toolCallId?: string;
  timestamp: number;
}

export interface ReasoningMessage {
  id: string;
  type: 'reasoning';
  reasoningId: string;
  content: string;
  isStreaming: boolean;
  timestamp: number;
}

export interface AskUserMessage {
  id: string;
  type: 'ask_user';
  question: string;
  choices?: string[];
  allowFreeform?: boolean;
  responded: boolean;
  selectedAnswer?: string;
  timestamp: number;
}

export interface SessionEventMessage {
  id: string;
  type: 'session_event';
  eventType: 'error' | 'model_change' | 'truncation' | 'compaction_start' | 'compaction_complete' | 'shutdown' | 'turn_start' | 'turn_end' | 'skill' | 'hook_start' | 'hook_end';
  data: Record<string, unknown>;
  timestamp: number;
}

export type ConversationMessage = UserMessage | AssistantMessage | ToolCallMessage | ReasoningMessage | AskUserMessage | SessionEventMessage;
