/** Shared sub-agent types used by both main process and renderer */

export type SubagentStatus = 'running' | 'idle' | 'completed' | 'failed' | 'cancelled';

export type SubagentType =
  | 'explore'
  | 'task'
  | 'general-purpose'
  | 'rubber-duck'
  | 'code-review'
  | 'configure-copilot'
  | string; // custom agents

export interface SubagentTurn {
  turnIndex: number;
  /** Accumulated assistant response text for this turn */
  response: string;
  /** Inbound message that triggered this turn (undefined for turn 0) */
  inboundMessage?: { fromAgentId?: string; content: string };
  timestamp: number;
}

export interface SubagentToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  completed: boolean;
  success?: boolean;
  result?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

export interface SubagentProgress {
  currentIntent?: string;
  toolCallsCompleted: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  resolvedModel?: string;
}

export interface SubagentInfo {
  agentId: string;
  panelId: string;
  toolCallId: string;
  name: string;
  displayName: string;
  description: string;
  agentType: SubagentType;
  status: SubagentStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  model?: string;
  totalTokens?: number;
  totalToolCalls?: number;
  error?: string;
  progress: SubagentProgress;
  /** Streaming assistant content for the current turn */
  streamingContent: string;
  /** Completed turns */
  turns: SubagentTurn[];
  /** Active tool calls within this agent */
  toolCalls: SubagentToolCall[];
}

/** Summary sent over IPC for the SubagentBar (lightweight, no full turns/content) */
export interface SubagentSummary {
  agentId: string;
  panelId: string;
  toolCallId: string;
  name: string;
  displayName: string;
  description: string;
  agentType: SubagentType;
  status: SubagentStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  model?: string;
  totalTokens?: number;
  totalToolCalls?: number;
  error?: string;
  progress: SubagentProgress;
}

/** Capabilities exposed to renderer for gating steering UI */
export interface SubagentCapabilities {
  canWrite: boolean;
  canCancel: boolean;
}
