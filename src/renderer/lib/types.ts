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
  timestamp: number;
}

export type ConversationMessage = UserMessage | AssistantMessage | ToolCallMessage;
