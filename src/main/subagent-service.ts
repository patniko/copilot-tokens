/**
 * SubagentTracker — main-process service that tracks all sub-agent state.
 * Single source of truth; renderer fetches summaries/details via IPC.
 */
import type {
  SubagentInfo,
  SubagentSummary,
  SubagentToolCall,
  SubagentTurn,
} from '../shared/subagent-types';

/** Max completed turns to retain per agent (prevents unbounded memory) */
const MAX_TURNS_PER_AGENT = 50;
/** Max streaming content length before truncation */
const MAX_STREAMING_CONTENT = 100_000;
/** Max tool calls to retain per agent */
const MAX_TOOL_CALLS_PER_AGENT = 200;

type ChangeListener = (panelId: string) => void;

export class SubagentTracker {
  /** panelId → agentId → SubagentInfo */
  private agents = new Map<string, Map<string, SubagentInfo>>();
  /** toolCallId → { panelId, agentId } for linking subagent.started tiles to agents */
  private toolCallIndex = new Map<string, { panelId: string; agentId: string }>();

  private changeListeners: ChangeListener[] = [];
  private throttleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  onChange(listener: ChangeListener): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }

  private notifyChange(panelId: string): void {
    // Throttle to max 1 notification per 500ms per panel
    if (this.throttleTimers.has(panelId)) return;
    this.throttleTimers.set(
      panelId,
      setTimeout(() => {
        this.throttleTimers.delete(panelId);
        for (const listener of this.changeListeners) {
          listener(panelId);
        }
      }, 500),
    );
  }

  private ensurePanel(panelId: string): Map<string, SubagentInfo> {
    if (!this.agents.has(panelId)) {
      this.agents.set(panelId, new Map());
    }
    return this.agents.get(panelId)!;
  }

  private resolveAgentId(event: { agentId?: string; toolCallId?: string }, panelId: string): string | undefined {
    if (event.agentId) return event.agentId;
    if (event.toolCallId) {
      const ref = this.toolCallIndex.get(event.toolCallId);
      if (ref && ref.panelId === panelId) return ref.agentId;
    }
    return undefined;
  }

  // --- Lifecycle events ---

  trackStarted(panelId: string, data: {
    agentId?: string;
    toolCallId: string;
    agentName: string;
    agentDisplayName: string;
    agentDescription: string;
  }): void {
    const panel = this.ensurePanel(panelId);
    const agentId = data.agentId || `agent-${data.toolCallId}`;

    const info: SubagentInfo = {
      agentId,
      panelId,
      toolCallId: data.toolCallId,
      name: data.agentName,
      displayName: data.agentDisplayName,
      description: data.agentDescription,
      agentType: data.agentName,
      status: 'running',
      startedAt: Date.now(),
      progress: {
        toolCallsCompleted: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      },
      streamingContent: '',
      turns: [],
      toolCalls: [],
    };

    panel.set(agentId, info);
    this.toolCallIndex.set(data.toolCallId, { panelId, agentId });
    this.notifyChange(panelId);
  }

  trackCompleted(panelId: string, data: {
    agentId?: string;
    toolCallId: string;
    agentName?: string;
    agentDisplayName?: string;
    durationMs?: number;
    model?: string;
    totalTokens?: number;
    totalToolCalls?: number;
  }): void {
    const agentId = this.resolveAgentId(data, panelId);
    if (!agentId) return;
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent) return;

    // Finalize the current streaming content as the last turn
    this.finalizeTurn(agent);

    agent.status = 'completed';
    agent.completedAt = Date.now();
    agent.durationMs = data.durationMs ?? (Date.now() - agent.startedAt);
    if (data.model) agent.model = data.model;
    if (data.totalTokens != null) agent.totalTokens = data.totalTokens;
    if (data.totalToolCalls != null) agent.totalToolCalls = data.totalToolCalls;
    if (data.agentDisplayName) agent.displayName = data.agentDisplayName;
    this.notifyChange(panelId);
  }

  trackFailed(panelId: string, data: {
    agentId?: string;
    toolCallId: string;
    agentName?: string;
    error: string;
    durationMs?: number;
    model?: string;
    totalTokens?: number;
    totalToolCalls?: number;
  }): void {
    const agentId = this.resolveAgentId(data, panelId);
    if (!agentId) return;
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent) return;

    this.finalizeTurn(agent);

    agent.status = 'failed';
    agent.completedAt = Date.now();
    agent.durationMs = data.durationMs ?? (Date.now() - agent.startedAt);
    agent.error = data.error;
    if (data.model) agent.model = data.model;
    if (data.totalTokens != null) agent.totalTokens = data.totalTokens;
    if (data.totalToolCalls != null) agent.totalToolCalls = data.totalToolCalls;
    this.notifyChange(panelId);
  }

  // --- Streaming / progress events (tagged with agentId) ---

  trackStreamingDelta(panelId: string, agentId: string, delta: string): void {
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent) return;
    if (agent.streamingContent.length < MAX_STREAMING_CONTENT) {
      agent.streamingContent += delta;
    }
    // Don't notify on every delta — too noisy; the overlay polls when open
  }

  trackIntent(panelId: string, agentId: string, intent: string): void {
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent) return;
    agent.progress.currentIntent = intent;
    this.notifyChange(panelId);
  }

  trackToolStart(panelId: string, agentId: string, data: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
  }): void {
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent) return;
    if (agent.toolCalls.length >= MAX_TOOL_CALLS_PER_AGENT) {
      agent.toolCalls.shift();
    }
    agent.toolCalls.push({
      toolCallId: data.toolCallId,
      toolName: data.toolName,
      args: data.args,
      completed: false,
      startedAt: Date.now(),
    });
  }

  trackToolComplete(panelId: string, agentId: string, data: {
    toolCallId: string;
    success: boolean;
    result?: string;
    error?: string;
  }): void {
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent) return;
    const tc = agent.toolCalls.find((t) => t.toolCallId === data.toolCallId);
    if (tc) {
      tc.completed = true;
      tc.success = data.success;
      tc.result = data.result;
      tc.error = data.error;
      tc.completedAt = Date.now();
    }
    agent.progress.toolCallsCompleted++;
  }

  trackUsage(panelId: string, agentId: string, inputTokens: number, outputTokens: number): void {
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent) return;
    agent.progress.totalInputTokens += inputTokens;
    agent.progress.totalOutputTokens += outputTokens;
  }

  trackModel(panelId: string, agentId: string, model: string): void {
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent) return;
    agent.model = model;
    agent.progress.resolvedModel = model;
  }

  /** Called when a new assistant turn starts — finalize previous turn content */
  trackTurnStart(panelId: string, agentId: string): void {
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent) return;
    this.finalizeTurn(agent);
  }

  trackIdle(panelId: string, agentId: string): void {
    const agent = this.ensurePanel(panelId).get(agentId);
    if (!agent || agent.status !== 'running') return;
    agent.status = 'idle';
    this.finalizeTurn(agent);
    this.notifyChange(panelId);
  }

  // --- Queries ---

  listSubagents(panelId: string): SubagentSummary[] {
    const panel = this.agents.get(panelId);
    if (!panel) return [];
    return Array.from(panel.values()).map((a) => this.toSummary(a));
  }

  getSubagent(panelId: string, agentId: string): SubagentInfo | undefined {
    return this.agents.get(panelId)?.get(agentId);
  }

  getAgentIdForToolCall(toolCallId: string): { panelId: string; agentId: string } | undefined {
    return this.toolCallIndex.get(toolCallId);
  }

  /** Clean up completed agents older than maxAge (ms) to free memory */
  pruneCompleted(panelId: string, maxAge = 10 * 60 * 1000): void {
    const panel = this.agents.get(panelId);
    if (!panel) return;
    const cutoff = Date.now() - maxAge;
    for (const [id, agent] of panel) {
      if ((agent.status === 'completed' || agent.status === 'failed') && (agent.completedAt ?? 0) < cutoff) {
        panel.delete(id);
        this.toolCallIndex.delete(agent.toolCallId);
      }
    }
  }

  /** Remove all agents for a panel (on session destroy) */
  clearPanel(panelId: string): void {
    const panel = this.agents.get(panelId);
    if (panel) {
      for (const agent of panel.values()) {
        this.toolCallIndex.delete(agent.toolCallId);
      }
      panel.clear();
    }
    this.agents.delete(panelId);
  }

  // --- Internals ---

  private finalizeTurn(agent: SubagentInfo): void {
    if (agent.streamingContent.length === 0) return;
    if (agent.turns.length >= MAX_TURNS_PER_AGENT) {
      agent.turns.shift();
    }
    agent.turns.push({
      turnIndex: agent.turns.length,
      response: agent.streamingContent,
      timestamp: Date.now(),
    });
    agent.streamingContent = '';
  }

  private toSummary(agent: SubagentInfo): SubagentSummary {
    return {
      agentId: agent.agentId,
      panelId: agent.panelId,
      toolCallId: agent.toolCallId,
      name: agent.name,
      displayName: agent.displayName,
      description: agent.description,
      agentType: agent.agentType,
      status: agent.status,
      startedAt: agent.startedAt,
      completedAt: agent.completedAt,
      durationMs: agent.durationMs,
      model: agent.model,
      totalTokens: agent.totalTokens,
      totalToolCalls: agent.totalToolCalls,
      error: agent.error,
      progress: { ...agent.progress },
    };
  }
}
