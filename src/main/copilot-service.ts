import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { app } from 'electron';
import { execSync } from 'child_process';
import Store from 'electron-store';

// Dynamic import to load ESM SDK in Electron's CJS main process
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type CopilotClientType = import('@github/copilot-sdk').CopilotClient;
type CopilotSessionType = import('@github/copilot-sdk').CopilotSession;
type MCPServerConfig = import('@github/copilot-sdk').MCPServerConfig;
type CustomAgentConfig = import('@github/copilot-sdk').CustomAgentConfig;

// These types exist in the SDK but aren't re-exported from the index
type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
interface UserInputRequest {
  question: string;
  choices?: string[];
  allowFreeform?: boolean;
}
interface UserInputResponse {
  answer: string;
  wasFreeform: boolean;
}
interface SessionHooks {
  onPreToolUse?: (input: { timestamp: number; cwd: string; toolName: string; toolArgs: unknown }, invocation: { sessionId: string }) => Promise<Record<string, unknown> | void>;
  onPostToolUse?: (input: { timestamp: number; cwd: string; toolName: string; toolArgs: unknown; toolResult: unknown }, invocation: { sessionId: string }) => Promise<Record<string, unknown> | void>;
  onUserPromptSubmitted?: (input: { timestamp: number; cwd: string; prompt: string }, invocation: { sessionId: string }) => Promise<Record<string, unknown> | void>;
  onSessionStart?: (input: { timestamp: number; cwd: string; source: string; initialPrompt?: string }, invocation: { sessionId: string }) => Promise<Record<string, unknown> | void>;
  onSessionEnd?: (input: { timestamp: number; cwd: string; reason: string; finalMessage?: string; error?: string }, invocation: { sessionId: string }) => Promise<Record<string, unknown> | void>;
  onErrorOccurred?: (input: { timestamp: number; cwd: string; error: string; errorContext: string; recoverable: boolean }, invocation: { sessionId: string }) => Promise<Record<string, unknown> | void>;
}

// CopilotEvent union type (renderer-facing)
export type CopilotEvent =
  | { type: 'assistant.message_delta'; delta: string }
  | { type: 'assistant.message'; content: string }
  | { type: 'assistant.intent'; intent: string }
  | { type: 'assistant.usage'; inputTokens: number; outputTokens: number; model: string }
  | { type: 'assistant.reasoning_delta'; reasoningId: string; delta: string }
  | { type: 'assistant.reasoning'; reasoningId: string; content: string }
  | { type: 'assistant.turn_start'; turnId: string }
  | { type: 'assistant.turn_end'; turnId: string }
  | { type: 'tool.start'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool.progress'; toolCallId: string; message: string }
  | { type: 'tool.partial'; toolCallId: string; output: string }
  | { type: 'tool.complete'; toolCallId: string; success: boolean; result?: string; error?: string }
  | { type: 'subagent.started'; toolCallId: string; name: string; displayName: string; description: string }
  | { type: 'subagent.completed'; toolCallId: string; name: string }
  | { type: 'subagent.failed'; toolCallId: string; name: string; error: string }
  | { type: 'session.usage_info'; currentTokens: number; tokenLimit: number }
  | { type: 'session.idle' }
  | { type: 'session.error'; errorType: string; message: string; statusCode?: number }
  | { type: 'session.model_change'; previousModel?: string; newModel: string }
  | { type: 'session.truncation'; tokensRemoved: number; messagesRemoved: number }
  | { type: 'session.shutdown'; totalRequests: number; totalApiDurationMs: number; linesAdded: number; linesRemoved: number; filesModified: string[]; modelMetrics: Record<string, unknown> }
  | { type: 'session.compaction_start' }
  | { type: 'session.compaction_complete'; success: boolean; preTokens?: number; postTokens?: number; summary?: string }
  | { type: 'skill.invoked'; name: string; allowedTools?: string[] }
  | { type: 'hook.start'; hookType: string }
  | { type: 'hook.end'; hookType: string; success: boolean }
  | { type: 'ask_user.request'; question: string; choices?: string[]; allowFreeform?: boolean };

export type EventCallback = (event: CopilotEvent) => void;

async function loadSDK(): Promise<typeof import('@github/copilot-sdk')> {
  return import('@github/copilot-sdk');
}

type ToolDef = import('@github/copilot-sdk').Tool;

/** Build native Electron tools via defineTool() */
function buildNativeTools(): ToolDef[] {
  const { Notification, clipboard, desktopCapturer, screen, shell } = require('electron') as typeof import('electron');
  const { execSync } = require('child_process') as typeof import('child_process');
  const tools: ToolDef[] = [];

  // Desktop notification
  tools.push({
    name: 'desktop_notification',
    description: 'Show a native desktop notification with a title and body message',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notification title' },
        body: { type: 'string', description: 'Notification body text' },
      },
      required: ['title', 'body'],
    },
    handler: async (args: unknown) => {
      const { title, body } = args as { title: string; body: string };
      new Notification({ title, body }).show();
      return `Notification shown: "${title}"`;
    },
  });

  // Clipboard read
  tools.push({
    name: 'clipboard_read',
    description: 'Read the current contents of the system clipboard',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      return clipboard.readText() || '(clipboard is empty)';
    },
  });

  // Clipboard write
  tools.push({
    name: 'clipboard_write',
    description: 'Write text to the system clipboard',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to write to clipboard' },
      },
      required: ['text'],
    },
    handler: async (args: unknown) => {
      const { text } = args as { text: string };
      clipboard.writeText(text);
      return `Written ${text.length} chars to clipboard`;
    },
  });

  // System info
  tools.push({
    name: 'system_info',
    description: 'Get system information: OS, architecture, CPU, memory, display, user',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const os = require('os') as typeof import('os');
      const displays = screen.getAllDisplays();
      return JSON.stringify({
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
        freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
        displays: displays.map(d => ({ width: d.size.width, height: d.size.height, scaleFactor: d.scaleFactor })),
        user: os.userInfo().username,
        uptime: `${Math.round(os.uptime() / 3600)}h`,
      }, null, 2);
    },
  });

  // App launcher
  tools.push({
    name: 'open_url',
    description: 'Open a URL or file path in the default system application',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'URL or file path to open' },
      },
      required: ['target'],
    },
    handler: async (args: unknown) => {
      const { target } = args as { target: string };
      await shell.openExternal(target);
      return `Opened: ${target}`;
    },
  });

  // Sound playback
  tools.push({
    name: 'play_sound',
    description: 'Play one of the app\'s built-in sound effects: leverPull, tokenTick, milestone, jackpot, commit, error, celebration100k, celebration500k, yoloOn, yoloOff',
    parameters: {
      type: 'object',
      properties: {
        sound: { type: 'string', description: 'Sound name to play' },
      },
      required: ['sound'],
    },
    handler: async (args: unknown) => {
      const { sound } = args as { sound: string };
      // The renderer will handle playback via event
      return `Sound "${sound}" requested`;
    },
  });

  return tools;
}

/** Resolve the path to the Copilot CLI.
 *  Prefers the system-installed CLI (works reliably in packaged builds),
 *  then falls back to bundled node_modules paths for dev mode. */
function resolveCopilotCliPath(): string {
  // 1. System-installed CLI (e.g., via npm -g or homebrew)
  const systemPaths = [
    '/opt/homebrew/bin/copilot',
    '/usr/local/bin/copilot',
    join(homedir(), '.local', 'bin', 'copilot'),
  ];
  for (const p of systemPaths) {
    if (existsSync(p)) return p;
  }
  // Try `which copilot` as a catch-all
  try {
    const found = execSync('which copilot', { encoding: 'utf-8' }).trim();
    if (found && existsSync(found)) return found;
  } catch { /* not found */ }

  // 2. ASAR-unpacked path (packaged builds with bundled CLI)
  const appPath = app.getAppPath();
  const unpackedPath = join(appPath + '.unpacked', 'node_modules', '@github', 'copilot', 'index.js');
  if (existsSync(unpackedPath)) return unpackedPath;

  // 3. Adjacent to app path (non-asar packaged builds)
  const adjacentPath = join(appPath, 'node_modules', '@github', 'copilot', 'index.js');
  if (existsSync(adjacentPath)) return adjacentPath;

  // 4. Walk up from __dirname (dev mode)
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'node_modules', '@github', 'copilot', 'index.js');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return '';
}

/** Load MCP server configs from ~/.copilot/mcp-config.json and installed plugins */
export function loadMCPServers(): Record<string, MCPServerConfig> {
  const servers: Record<string, MCPServerConfig> = {};
  const copilotDir = join(homedir(), '.copilot');

  // 1. ~/.copilot/mcp-config.json
  const mcpConfigPath = join(copilotDir, 'mcp-config.json');
  if (existsSync(mcpConfigPath)) {
    try {
      const cfg = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
      if (cfg.mcpServers) Object.assign(servers, cfg.mcpServers);
    } catch { /* skip malformed config */ }
  }

  // 2. Installed plugins (~/.copilot/installed-plugins/*/*/.mcp.json)
  const pluginsDir = join(copilotDir, 'installed-plugins');
  if (existsSync(pluginsDir)) {
    try {
      for (const ns of readdirSync(pluginsDir)) {
        const nsDir = join(pluginsDir, ns);
        for (const plugin of readdirSync(nsDir)) {
          const mcpPath = join(nsDir, plugin, '.mcp.json');
          if (existsSync(mcpPath)) {
            try {
              const cfg = JSON.parse(readFileSync(mcpPath, 'utf-8'));
              if (cfg.mcpServers) Object.assign(servers, cfg.mcpServers);
            } catch { /* skip */ }
          }
        }
      }
    } catch { /* skip */ }
  }

  return servers;
}

export interface SystemPromptConfig {
  mode: 'append' | 'replace';
  content: string;
}

interface SettingsStoreSchema {
  systemPrompt: SystemPromptConfig;
  features: FeatureFlags;
  reasoningEffort: ReasoningEffort | null;
  customAgents: CustomAgentConfig[];
}

export interface FeatureFlags {
  customTools: boolean;
  askUser: boolean;
  reasoning: boolean;
  infiniteSessions: boolean;
  hooks: boolean;
  customAgents: boolean;
  sessionEvents: boolean;
}

const defaultFeatures: FeatureFlags = {
  customTools: true,
  askUser: true,
  reasoning: true,
  infiniteSessions: true,
  hooks: true,
  customAgents: false,
  sessionEvents: true,
};

const settingsStore = new Store<SettingsStoreSchema>({
  name: 'settings',
  defaults: {
    systemPrompt: { mode: 'append', content: '' },
    features: defaultFeatures,
    reasoningEffort: 'medium',
    customAgents: [],
  },
});

export class CopilotService {
  private static instance: CopilotService;
  private client: CopilotClientType | null = null;
  private sessions = new Map<string, CopilotSessionType>();
  private started = false;

  private workingDirectory: string | undefined;
  private model: string = 'claude-sonnet-4';

  // Permission handler set by the IPC layer
  // Returns 'allow' (one-time), 'deny', or 'always' (persist rule)
  private permissionCallback: ((request: Record<string, unknown>) => Promise<'allow' | 'deny' | 'always'>) | null = null;

  // User input handler: renderer provides answers to ask_user requests
  private userInputCallback: ((request: UserInputRequest) => Promise<UserInputResponse>) | null = null;

  private constructor() {}

  static getInstance(): CopilotService {
    if (!CopilotService.instance) {
      CopilotService.instance = new CopilotService();
    }
    return CopilotService.instance;
  }

  setWorkingDirectory(dir: string): void {
    if (dir && dir !== this.workingDirectory) {
      this.workingDirectory = dir;
      // Destroy all sessions so they pick up the new CWD
      for (const [id, session] of this.sessions) {
        session.destroy().catch(() => {});
        this.sessions.delete(id);
      }
    }
  }

  setModel(model: string): void {
    if (model && model !== this.model) {
      this.model = model;
      for (const [id, session] of this.sessions) {
        session.destroy().catch(() => {});
        this.sessions.delete(id);
      }
    }
  }

  getModel(): string {
    return this.model;
  }

  setPermissionHandler(handler: (request: Record<string, unknown>) => Promise<'allow' | 'deny' | 'always'>): void {
    this.permissionCallback = handler;
  }

  setUserInputHandler(handler: (request: UserInputRequest) => Promise<UserInputResponse>): void {
    this.userInputCallback = handler;
  }

  getFeatures(): FeatureFlags {
    return settingsStore.get('features');
  }

  setFeatures(features: FeatureFlags): void {
    settingsStore.set('features', features);
    // Restart sessions to pick up new config
    for (const [id, session] of this.sessions) {
      session.destroy().catch(() => {});
      this.sessions.delete(id);
    }
  }

  getReasoningEffort(): ReasoningEffort | null {
    return settingsStore.get('reasoningEffort');
  }

  setReasoningEffort(effort: ReasoningEffort | null): void {
    settingsStore.set('reasoningEffort', effort);
    for (const [id, session] of this.sessions) {
      session.destroy().catch(() => {});
      this.sessions.delete(id);
    }
  }

  getCustomAgents(): CustomAgentConfig[] {
    return settingsStore.get('customAgents');
  }

  setCustomAgents(agents: CustomAgentConfig[]): void {
    settingsStore.set('customAgents', agents);
    for (const [id, session] of this.sessions) {
      session.destroy().catch(() => {});
      this.sessions.delete(id);
    }
  }

  async listSessions(): Promise<{ sessionId: string; startTime: string; modifiedTime: string; summary?: string }[]> {
    await this.ensureStarted();
    const sessions = await this.client!.listSessions();
    return sessions.map(s => ({
      sessionId: s.sessionId,
      startTime: s.startTime.toISOString(),
      modifiedTime: s.modifiedTime.toISOString(),
      summary: s.summary,
    }));
  }

  async resumeSession(sessionId: string, panelId = 'main'): Promise<void> {
    await this.ensureStarted();
    // Destroy existing session for this panel if any
    const existing = this.sessions.get(panelId);
    if (existing) {
      await existing.destroy().catch(() => {});
      this.sessions.delete(panelId);
    }
    const opts: Record<string, unknown> = {
      model: this.model,
      streaming: true,
    };
    if (this.workingDirectory) opts.workingDirectory = this.workingDirectory;
    const session = await this.client!.resumeSession(sessionId, opts as Parameters<CopilotClientType['resumeSession']>[1]);
    this.sessions.set(panelId, session);
  }

  getSystemPrompt(): SystemPromptConfig {
    return settingsStore.get('systemPrompt');
  }

  setSystemPrompt(config: SystemPromptConfig): void {
    settingsStore.set('systemPrompt', config);
    // Destroy all sessions so the new prompt takes effect
    for (const [id, session] of this.sessions) {
      session.destroy().catch(() => {});
      this.sessions.delete(id);
    }
  }

  async listModels(): Promise<{ id: string; name: string; contextWindow: number }[]> {
    await this.ensureStarted();
    const models = await this.client!.listModels();
    return models.map(m => ({
      id: m.id,
      name: m.name,
      contextWindow: m.capabilities?.limits?.max_context_window_tokens ?? 0,
    }));
  }

  async refreshModels(): Promise<{ id: string; name: string; contextWindow: number }[]> {
    await this.ensureStarted();
    // Clear SDK's internal model cache to force a fresh fetch
    (this.client as unknown as { modelsCache: unknown }).modelsCache = null;
    return this.listModels();
  }

  async ensureStarted(): Promise<void> {
    if (!this.started) {
      const { CopilotClient } = await loadSDK();
      const cliPath = resolveCopilotCliPath();
      console.log('[CopilotService] Resolved CLI path:', cliPath || '(SDK default)');
      const opts: Record<string, unknown> = { autoStart: false };
      if (cliPath) opts.cliPath = cliPath;
      // When using a bundled .js CLI in packaged Electron, process.execPath is
      // the Electron binary. ELECTRON_RUN_AS_NODE makes it behave as plain Node.
      // Not needed for system-installed CLI (no .js extension → uses shebang).
      if (app.isPackaged && cliPath.endsWith('.js')) {
        opts.env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
      }
      this.client = new CopilotClient(opts as ConstructorParameters<typeof CopilotClient>[0]);
      await this.client.start();
      this.started = true;
    }
  }

  async ensureSession(panelId = 'main'): Promise<CopilotSessionType> {
    await this.ensureStarted();
    let session = this.sessions.get(panelId);
    if (!session) {
      const features = this.getFeatures();
      const opts: Record<string, unknown> = {
        model: this.model,
        streaming: true,
        excludedTools: [],
        mcpServers: loadMCPServers(),
      };
      if (this.workingDirectory) {
        opts.workingDirectory = this.workingDirectory;
      }
      // Apply custom system prompt if configured
      const promptConfig = this.getSystemPrompt();
      if (promptConfig.content.trim()) {
        opts.systemMessage = {
          mode: promptConfig.mode,
          content: promptConfig.content,
        };
      }
      if (this.permissionCallback) {
        const cb = this.permissionCallback;
        opts.onPermissionRequest = async (request: Record<string, unknown>) => {
          const decision = await cb(request);
          return {
            kind: decision === 'deny' ? 'denied-interactively-by-user' : 'approved',
          };
        };
      }
      // Ask User handler
      if (features.askUser && this.userInputCallback) {
        opts.onUserInputRequest = this.userInputCallback;
      }
      // Reasoning effort
      const effort = this.getReasoningEffort();
      if (features.reasoning && effort) {
        opts.reasoningEffort = effort;
      }
      // Infinite sessions
      if (features.infiniteSessions) {
        opts.infiniteSessions = { enabled: true };
      }
      // Custom agents
      if (features.customAgents) {
        const agents = this.getCustomAgents();
        if (agents.length > 0) {
          opts.customAgents = agents;
        }
      }
      // Session hooks
      if (features.hooks) {
        const hooks: SessionHooks = {
          onSessionStart: async (input: { timestamp: number; cwd: string; source: string }) => {
            return { additionalContext: `Session started at ${new Date(input.timestamp).toLocaleString()} in ${input.cwd}` };
          },
          onUserPromptSubmitted: async (_input: { timestamp: number; cwd: string; prompt: string }) => {
            return { additionalContext: undefined };
          },
          onPreToolUse: async (_input: { timestamp: number; cwd: string; toolName: string; toolArgs: unknown }) => {
            return {};
          },
          onPostToolUse: async (_input: { timestamp: number; cwd: string; toolName: string; toolArgs: unknown; toolResult: unknown }) => {
            return {};
          },
          onErrorOccurred: async (input: { timestamp: number; cwd: string; error: string; errorContext: string; recoverable: boolean }) => {
            if (input.recoverable) {
              return { errorHandling: 'retry', retryCount: 1 };
            }
            return {};
          },
          onSessionEnd: async (_input: { timestamp: number; cwd: string; reason: string }) => {
            return {};
          },
        };
        opts.hooks = hooks;
      }
      // Custom tools (native Electron capabilities)
      if (features.customTools) {
        opts.tools = buildNativeTools();
      }
      session = await this.client!.createSession(opts as Parameters<CopilotClientType['createSession']>[0]);
      this.sessions.set(panelId, session);
    }
    return session;
  }

  /** Destroy and remove a specific panel session */
  async destroySession(panelId: string): Promise<void> {
    const session = this.sessions.get(panelId);
    if (session) {
      await session.destroy().catch(() => {});
      this.sessions.delete(panelId);
    }
  }

  private abortResolves = new Map<string, () => void>();

  async sendMessage(prompt: string, onEvent: EventCallback, attachments?: { path: string }[], panelId = 'main'): Promise<void> {
    const session = await this.ensureSession(panelId);
    const features = this.getFeatures();

    const done = new Promise<void>((resolve) => {
      this.abortResolves.set(panelId, resolve);
      const unsub = session.on((event) => {
        switch (event.type) {
          case 'assistant.message_delta':
            onEvent({
              type: 'assistant.message_delta',
              delta: (event.data as { deltaContent?: string }).deltaContent ?? '',
            });
            break;
          case 'assistant.message':
            onEvent({
              type: 'assistant.message',
              content: (event.data as { content?: string }).content ?? '',
            });
            break;
          case 'assistant.intent':
            onEvent({
              type: 'assistant.intent',
              intent: (event.data as { intent?: string }).intent ?? '',
            });
            break;
          case 'assistant.usage': {
            const usage = event.data as { inputTokens?: number; outputTokens?: number; model?: string };
            onEvent({
              type: 'assistant.usage',
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              model: usage.model ?? '',
            });
            break;
          }
          case 'assistant.reasoning_delta': {
            if (!features.reasoning) break;
            const rd = event.data as { reasoningId?: string; deltaContent?: string };
            onEvent({
              type: 'assistant.reasoning_delta',
              reasoningId: rd.reasoningId ?? '',
              delta: rd.deltaContent ?? '',
            });
            break;
          }
          case 'assistant.reasoning': {
            if (!features.reasoning) break;
            const r = event.data as { reasoningId?: string; content?: string };
            onEvent({
              type: 'assistant.reasoning',
              reasoningId: r.reasoningId ?? '',
              content: r.content ?? '',
            });
            break;
          }
          case 'assistant.turn_start': {
            if (!features.sessionEvents) break;
            const ts = event.data as { turnId?: string };
            onEvent({ type: 'assistant.turn_start', turnId: ts.turnId ?? '' });
            break;
          }
          case 'assistant.turn_end': {
            if (!features.sessionEvents) break;
            const te = event.data as { turnId?: string };
            onEvent({ type: 'assistant.turn_end', turnId: te.turnId ?? '' });
            break;
          }
          case 'tool.execution_start': {
            const data = event.data as { toolCallId?: string; toolName?: string; arguments?: Record<string, unknown>; toolArgs?: Record<string, unknown> };
            onEvent({
              type: 'tool.start',
              toolCallId: data.toolCallId ?? '',
              toolName: data.toolName ?? '',
              args: data.arguments ?? data.toolArgs ?? {},
            });
            break;
          }
          case 'tool.execution_progress': {
            const data = event.data as { toolCallId?: string; progressMessage?: string };
            onEvent({
              type: 'tool.progress',
              toolCallId: data.toolCallId ?? '',
              message: data.progressMessage ?? '',
            });
            break;
          }
          case 'tool.execution_partial_result': {
            const data = event.data as { toolCallId?: string; partialOutput?: string };
            onEvent({
              type: 'tool.partial',
              toolCallId: data.toolCallId ?? '',
              output: data.partialOutput ?? '',
            });
            break;
          }
          case 'tool.execution_complete': {
            const data = event.data as {
              toolCallId?: string;
              success?: boolean;
              result?: { content?: string };
              error?: { message?: string };
            };
            onEvent({
              type: 'tool.complete',
              toolCallId: data.toolCallId ?? '',
              success: data.success ?? true,
              result: data.result?.content,
              error: data.error?.message,
            });
            break;
          }
          case 'subagent.started': {
            const data = event.data as { toolCallId?: string; agentName?: string; agentDisplayName?: string; agentDescription?: string; name?: string; displayName?: string; description?: string };
            onEvent({
              type: 'subagent.started',
              toolCallId: data.toolCallId ?? '',
              name: data.agentName ?? data.name ?? '',
              displayName: data.agentDisplayName ?? data.displayName ?? data.agentName ?? data.name ?? '',
              description: data.agentDescription ?? data.description ?? '',
            });
            break;
          }
          case 'subagent.completed': {
            const data = event.data as { toolCallId?: string; agentName?: string; name?: string };
            onEvent({
              type: 'subagent.completed',
              toolCallId: data.toolCallId ?? '',
              name: data.agentName ?? data.name ?? '',
            });
            break;
          }
          case 'subagent.failed': {
            const data = event.data as { toolCallId?: string; agentName?: string; name?: string; error?: string };
            onEvent({
              type: 'subagent.failed',
              toolCallId: data.toolCallId ?? '',
              name: data.agentName ?? data.name ?? '',
              error: data.error ?? 'Unknown error',
            });
            break;
          }
          case 'session.error': {
            if (!features.sessionEvents) break;
            const se = event.data as { errorType?: string; message?: string; statusCode?: number };
            onEvent({
              type: 'session.error',
              errorType: se.errorType ?? 'unknown',
              message: se.message ?? '',
              statusCode: se.statusCode,
            });
            break;
          }
          case 'session.model_change': {
            if (!features.sessionEvents) break;
            const mc = event.data as { previousModel?: string; newModel?: string };
            onEvent({
              type: 'session.model_change',
              previousModel: mc.previousModel,
              newModel: mc.newModel ?? '',
            });
            break;
          }
          case 'session.truncation': {
            if (!features.sessionEvents) break;
            const tr = event.data as { tokensRemovedDuringTruncation?: number; messagesRemovedDuringTruncation?: number };
            onEvent({
              type: 'session.truncation',
              tokensRemoved: tr.tokensRemovedDuringTruncation ?? 0,
              messagesRemoved: tr.messagesRemovedDuringTruncation ?? 0,
            });
            break;
          }
          case 'session.shutdown': {
            if (!features.sessionEvents) break;
            const sd = event.data as {
              totalPremiumRequests?: number;
              totalApiDurationMs?: number;
              codeChanges?: { linesAdded?: number; linesRemoved?: number; filesModified?: string[] };
              modelMetrics?: Record<string, unknown>;
            };
            onEvent({
              type: 'session.shutdown',
              totalRequests: sd.totalPremiumRequests ?? 0,
              totalApiDurationMs: sd.totalApiDurationMs ?? 0,
              linesAdded: sd.codeChanges?.linesAdded ?? 0,
              linesRemoved: sd.codeChanges?.linesRemoved ?? 0,
              filesModified: sd.codeChanges?.filesModified ?? [],
              modelMetrics: sd.modelMetrics ?? {},
            });
            break;
          }
          case 'session.compaction_start': {
            if (!features.sessionEvents) break;
            onEvent({ type: 'session.compaction_start' });
            break;
          }
          case 'session.compaction_complete': {
            if (!features.sessionEvents) break;
            const cc = event.data as { success?: boolean; preCompactionTokens?: number; postCompactionTokens?: number; summaryContent?: string };
            onEvent({
              type: 'session.compaction_complete',
              success: cc.success ?? true,
              preTokens: cc.preCompactionTokens,
              postTokens: cc.postCompactionTokens,
              summary: cc.summaryContent,
            });
            break;
          }
          case 'skill.invoked': {
            if (!features.sessionEvents) break;
            const sk = event.data as { name?: string; allowedTools?: string[] };
            onEvent({
              type: 'skill.invoked',
              name: sk.name ?? '',
              allowedTools: sk.allowedTools,
            });
            break;
          }
          case 'hook.start': {
            if (!features.hooks) break;
            const hs = event.data as { hookType?: string };
            onEvent({ type: 'hook.start', hookType: hs.hookType ?? '' });
            break;
          }
          case 'hook.end': {
            if (!features.hooks) break;
            const he = event.data as { hookType?: string; success?: boolean };
            onEvent({ type: 'hook.end', hookType: he.hookType ?? '', success: he.success ?? true });
            break;
          }
          case 'session.usage_info': {
            const data = event.data as { currentTokens?: number; tokenLimit?: number };
            onEvent({
              type: 'session.usage_info',
              currentTokens: data.currentTokens ?? 0,
              tokenLimit: data.tokenLimit ?? 0,
            });
            break;
          }
          case 'session.idle':
            onEvent({ type: 'session.idle' });
            unsub();
            this.abortResolves.delete(panelId);
            resolve();
            break;
        }
      });
    });

    const sendOpts: { prompt: string; attachments?: { type: 'file'; path: string }[] } = { prompt };
    if (attachments?.length) {
      sendOpts.attachments = attachments.map(a => ({ type: 'file' as const, path: a.path }));
    }
    await session.send(sendOpts);
    await done;
  }

  async abort(panelId = 'main'): Promise<void> {
    const session = this.sessions.get(panelId);
    if (session) {
      await session.abort();
    }
    const resolve = this.abortResolves.get(panelId);
    if (resolve) {
      resolve();
      this.abortResolves.delete(panelId);
    }
  }

  async stop(): Promise<void> {
    for (const [id, session] of this.sessions) {
      await session.destroy().catch(() => {});
      this.sessions.delete(id);
    }
    if (this.started && this.client) {
      await this.client.stop();
      this.started = false;
    }
  }
}
