import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { app } from 'electron';
import { execSync } from 'child_process';
import Store from 'electron-store';
import { getPersistedOAuthToken, getActiveSource } from './auth-service';
import { getActiveProfile, getActiveProfileId, getProfile, type ConnectionProfile, type ProfileConnection } from './profile-service';
import { SubagentTracker } from './subagent-service';

// Dynamic import to load ESM SDK in Electron's CJS main process
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type CopilotClientType = import('@github/copilot-sdk').CopilotClient;
type CopilotSessionType = import('@github/copilot-sdk').CopilotSession;
type MCPServerConfig = import('@github/copilot-sdk').MCPServerConfig;
type CustomAgentConfig = import('@github/copilot-sdk').CustomAgentConfig;
type RuntimeConnectionType = import('@github/copilot-sdk').RuntimeConnection;

// These types exist in the SDK but aren't re-exported from the index
type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface ModelInfoResult {
  id: string;
  name: string;
  contextWindow: number;
  supportedReasoningEfforts?: ReasoningEffort[];
  defaultReasoningEffort?: ReasoningEffort;
}
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

// Rich quota snapshot from assistant.usage events
export interface QuotaSnapshot {
  isUnlimitedEntitlement: boolean;
  entitlementRequests: number;
  usedRequests: number;
  usageAllowedWithExhaustedQuota: boolean;
  overage: number;
  overageAllowedWithExhaustedQuota: boolean;
  remainingPercentage: number;
  resetDate?: string;
}

// CopilotEvent union type (renderer-facing)
export type CopilotEvent =
  | { type: 'assistant.message_delta'; delta: string }
  | { type: 'assistant.message'; content: string }
  | { type: 'assistant.intent'; intent: string }
  | { type: 'assistant.usage'; inputTokens: number; outputTokens: number; model: string; cost?: number; duration?: number; cacheReadTokens?: number; cacheWriteTokens?: number; quotaSnapshots?: Record<string, QuotaSnapshot>; copilotUsage?: { tokenDetails: { batchSize: number; costPerBatch: number; tokenCount: number; tokenType: string }[]; totalNanoAiu: number } }
  | { type: 'assistant.reasoning_delta'; reasoningId: string; delta: string }
  | { type: 'assistant.reasoning'; reasoningId: string; content: string }
  | { type: 'assistant.turn_start'; turnId: string }
  | { type: 'assistant.turn_end'; turnId: string }
  | { type: 'tool.start'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool.progress'; toolCallId: string; message: string }
  | { type: 'tool.partial'; toolCallId: string; output: string }
  | { type: 'tool.complete'; toolCallId: string; success: boolean; result?: string; error?: string }
  | { type: 'subagent.started'; toolCallId: string; name: string; displayName: string; description: string; agentId?: string }
  | { type: 'subagent.completed'; toolCallId: string; name: string; agentId?: string; durationMs?: number; model?: string; totalTokens?: number; totalToolCalls?: number }
  | { type: 'subagent.failed'; toolCallId: string; name: string; error: string; agentId?: string }
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
type DefineToolFn = typeof import('@github/copilot-sdk').defineTool;

// Cached reference to SDK's defineTool (loaded lazily since SDK is ESM)
let _defineTool: DefineToolFn | null = null;
async function getDefineTool(): Promise<DefineToolFn> {
  if (!_defineTool) {
    const sdk = await loadSDK();
    _defineTool = sdk.defineTool;
  }
  return _defineTool;
}

/** Build native Electron tools using SDK's type-safe defineTool() */
async function buildNativeTools(): Promise<ToolDef[]> {
  const { Notification, clipboard, screen, shell } = require('electron') as typeof import('electron');
  const dt = await getDefineTool();
  const tools: ToolDef[] = [];

  tools.push(dt('desktop_notification', {
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
  }));

  tools.push(dt('clipboard_read', {
    description: 'Read the current contents of the system clipboard',
    parameters: { type: 'object', properties: {} },
    handler: async () => clipboard.readText() || '(clipboard is empty)',
  }));

  tools.push(dt('clipboard_write', {
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
  }));

  tools.push(dt('system_info', {
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
  }));

  tools.push(dt('open_url', {
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
  }));

  tools.push(dt('play_sound', {
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
      return `Sound "${sound}" requested`;
    },
  }));

  return tools;
}

/** Resolve the path to the Copilot CLI.
 *  Prefers the system-installed CLI (works reliably in packaged builds),
 *  then falls back to bundled node_modules paths for dev mode. */
const platformPkg = `copilot-${process.platform}-${process.arch}`;

/** Resolve the system-installed CLI binary (global npm, homebrew, etc.) */
function resolveSystemCli(): string {
  const systemPaths = [
    '/opt/homebrew/bin/copilot',
    '/usr/local/bin/copilot',
    join(homedir(), '.local', 'bin', 'copilot'),
  ];
  for (const p of systemPaths) {
    if (existsSync(p)) return p;
  }
  try {
    const found = execSync('which copilot', { encoding: 'utf-8' }).trim();
    if (found && existsSync(found)) return found;
  } catch { /* not found */ }
  return '';
}

/** Resolve the bundled CLI shipped inside the app or in node_modules (dev). */
function resolveBundledCliPath(): string {
  const nativeBin = `@github/${platformPkg}/copilot${process.platform === 'win32' ? '.exe' : ''}`;
  const jsFallback = join('@github', 'copilot', 'index.js');

  // 1. ASAR-unpacked paths (packaged builds with bundled CLI)
  const appPath = app.getAppPath();
  const unpackedBase = appPath + '.unpacked';
  const unpackedNative = join(unpackedBase, 'node_modules', nativeBin);
  if (existsSync(unpackedNative)) return unpackedNative;
  const unpackedJs = join(unpackedBase, 'node_modules', jsFallback);
  if (existsSync(unpackedJs)) return unpackedJs;

  // 2. Adjacent to app path (non-asar packaged builds)
  const adjacentNative = join(appPath, 'node_modules', nativeBin);
  if (existsSync(adjacentNative)) return adjacentNative;
  const adjacentJs = join(appPath, 'node_modules', jsFallback);
  if (existsSync(adjacentJs)) return adjacentJs;

  // 3. Walk up from __dirname (dev mode)
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidateNative = join(dir, 'node_modules', nativeBin);
    if (existsSync(candidateNative)) return candidateNative;
    const candidateJs = join(dir, 'node_modules', jsFallback);
    if (existsSync(candidateJs)) return candidateJs;
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

export type CliMode =
  | { type: 'bundled' }
  | { type: 'installed' }
  | { type: 'remote'; url: string };

export interface ServerModeConfig {
  enabled: boolean;
  port: number;
}

export interface ServerInfo {
  enabled: boolean;
  port: number;
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  externalSessionCount: number;
}

interface SettingsStoreSchema {
  systemPrompt: SystemPromptConfig;
  features: FeatureFlags;
  reasoningEffort: ReasoningEffort | null;
  customAgents: CustomAgentConfig[];
  cliMode: CliMode;
  compactionThresholds: { background: number; bufferExhaustion: number };
  skillDirectories: string[];
  disabledSkills: string[];
  serverMode: ServerModeConfig;
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
  customAgents: true,
  sessionEvents: true,
};

const settingsStore = new Store<SettingsStoreSchema>({
  name: 'settings',
  defaults: {
    systemPrompt: { mode: 'append', content: '' },
    features: defaultFeatures,
    reasoningEffort: null,
    customAgents: [],
    cliMode: { type: 'bundled' },
    compactionThresholds: { background: 0.80, bufferExhaustion: 0.95 },
    skillDirectories: [],
    disabledSkills: [],
    serverMode: { enabled: false, port: 19900 },
  },
});

// Migrate: old default of 'medium' should become null (let model use its natural reasoning depth)
if (settingsStore.get('reasoningEffort') === 'medium') {
  settingsStore.set('reasoningEffort', null);
}

/** Map a profile connection to the SDK ProviderConfig (for BYOK). Returns null for Copilot-native connections. */
function buildProviderConfig(conn: ProfileConnection): Record<string, unknown> | null {
  switch (conn.type) {
    case 'anthropic':
      return { type: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: conn.apiKey };
    case 'openai':
      return { type: 'openai', baseUrl: conn.baseUrl || 'https://api.openai.com/v1', apiKey: conn.apiKey };
    case 'azure':
      return { type: 'azure', baseUrl: conn.baseUrl, apiKey: conn.apiKey, azure: { apiVersion: conn.apiVersion ?? '2024-10-21' } };
    case 'custom':
      return { type: 'openai', baseUrl: conn.baseUrl, apiKey: conn.apiKey, bearerToken: conn.bearerToken };
    default:
      return null; // copilot-cli and copilot-remote don't use session-level provider
  }
}

export class CopilotService {
  private static instance: CopilotService;
  private client: CopilotClientType | null = null;
  private sessions = new Map<string, CopilotSessionType>();
  private started = false;

  // Server mode: track our own session IDs vs external ones
  private ownSessionIds = new Set<string>();
  private externalSessionCount = 0;
  private lifecycleUnsub: (() => void) | null = null;

  private workingDirectory: string | undefined;
  // Per-panel CWD overrides (for multi-tab support)
  private panelCwds = new Map<string, string>();
  private model: string = 'claude-sonnet-4';
  // Per-panel excluded tools
  private panelExcludedTools = new Map<string, string[]>();
  // Per-panel profile overrides (panelId → profileId). Falls back to global active profile.
  private panelProfiles = new Map<string, string>();
  // Per-panel model overrides (panelId → modelId). Falls back to profile model → global model.
  private panelModels = new Map<string, string>();
  // Per-panel reasoning effort overrides
  private panelReasoningEffort = new Map<string, ReasoningEffort | null>();

  // Permission handler set by the IPC layer
  // Returns 'allow' (one-time), 'deny', or 'always' (persist rule)
  private permissionCallback: ((request: Record<string, unknown>) => Promise<'allow' | 'deny' | 'always'>) | null = null;

  // User input handler: renderer provides answers to ask_user requests
  private userInputCallback: ((request: UserInputRequest) => Promise<UserInputResponse>) | null = null;

  // Delegate handler: fires when an agent wants to create a new tab
  private delegateCallback: ((data: { prompt: string; description?: string; sourcePanelId: string }) => void) | null = null;

  // Celebrate handler: fires when an agent wants to trigger a celebration overlay
  private celebrateCallback: ((data: { message: string; emoji: string; effect: string; sound: string }) => void) | null = null;

  // Sub-agent tracker — single source of truth for all sub-agent state
  readonly subagentTracker = new SubagentTracker();
  // Per-session long-lived unsubscribers for sub-agent event tracking
  private sessionSubagentUnsubs = new Map<string, () => void>();

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
        session.disconnect().catch(() => {});
        this.sessions.delete(id);
      }
    }
  }

  /** Set CWD for specific panels (tab-scoped) without affecting other tabs' sessions. */
  setWorkingDirectoryForPanels(panelIds: string[], dir: string): void {
    // Keep global fallback in sync so new panels default to the latest CWD
    this.workingDirectory = dir;
    for (const pid of panelIds) {
      this.panelCwds.set(pid, dir);
      const session = this.sessions.get(pid);
      if (session) {
        session.disconnect().catch(() => {});
        this.sessions.delete(pid);
      }
    }
  }

  setModel(model: string): void {
    if (model) {
      this.model = model;
      // Only updates the global default for new sessions.
      // Per-panel models are set via setModelForPanels() which recycles only those sessions.
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

  setDelegateHandler(handler: (data: { prompt: string; description?: string; sourcePanelId: string }) => void): void {
    this.delegateCallback = handler;
  }

  setCelebrateHandler(handler: (data: { message: string; emoji: string; effect: string; sound: string }) => void): void {
    this.celebrateCallback = handler;
  }

  /** Set excluded tools for a panel and recycle its session. */
  setExcludedTools(panelId: string, tools: string[]): void {
    this.panelExcludedTools.set(panelId, tools);
    const session = this.sessions.get(panelId);
    if (session) {
      session.disconnect().catch(() => {});
      this.sessions.delete(panelId);
    }
  }

  getExcludedTools(panelId: string): string[] {
    return this.panelExcludedTools.get(panelId) ?? [];
  }

  /** Set a per-panel profile override. */
  setPanelProfile(panelId: string, profileId: string): void {
    this.panelProfiles.set(panelId, profileId);
    // Recycle this panel's session to pick up new profile
    const session = this.sessions.get(panelId);
    if (session) {
      session.disconnect().catch(() => {});
      this.sessions.delete(panelId);
    }
  }

  getPanelProfile(panelId: string): string | undefined {
    return this.panelProfiles.get(panelId);
  }

  /** Set a per-panel model override. */
  setPanelModel(panelId: string, model: string): void {
    this.panelModels.set(panelId, model);
    const session = this.sessions.get(panelId);
    if (session) {
      session.disconnect().catch(() => {});
      this.sessions.delete(panelId);
    }
  }

  getPanelModel(panelId: string): string | undefined {
    return this.panelModels.get(panelId);
  }

  /** Set model for specific panels only (tab-scoped). Only recycles those panels' sessions. */
  /** Set model for specific panels only (tab-scoped). Uses session.setModel() for live switching. */
  async setModelForPanels(panelIds: string[], model: string): Promise<void> {
    for (const pid of panelIds) {
      this.panelModels.set(pid, model);
      const session = this.sessions.get(pid);
      if (session) {
        try {
          await session.setModel(model);
        } catch {
          // Fall back to session recycling if setModel not supported
          session.disconnect().catch(() => {});
          this.sessions.delete(pid);
        }
      }
    }
  }

  /** Set profile for specific panels only (tab-scoped). Only recycles those panels' sessions. */
  setProfileForPanels(panelIds: string[], profileId: string): void {
    for (const pid of panelIds) {
      this.panelProfiles.set(pid, profileId);
      const session = this.sessions.get(pid);
      if (session) {
        session.disconnect().catch(() => {});
        this.sessions.delete(pid);
      }
    }
  }

  /** Set reasoning effort for specific panels (tab-scoped). Recycles sessions to apply. */
  setReasoningForPanels(panelIds: string[], effort: ReasoningEffort | null): void {
    for (const pid of panelIds) {
      if (effort === null) {
        this.panelReasoningEffort.delete(pid);
      } else {
        this.panelReasoningEffort.set(pid, effort);
      }
      // Must recycle session — reasoning effort is set at session creation time
      const session = this.sessions.get(pid);
      if (session) {
        session.disconnect().catch(() => {});
        this.sessions.delete(pid);
      }
    }
  }

  /** List models for a specific profile (returns enabledModels for BYOK, or CLI models). */
  async listModelsForProfile(profileId: string): Promise<ModelInfoResult[]> {
    const profile = getProfile(profileId) ?? getActiveProfile();
    if (profile.enabledModels?.length) {
      return profile.enabledModels.map(id => ({ id, name: id, contextWindow: 0 }));
    }
    await this.ensureStarted();
    const models = await this.client!.listModels();
    return models.map(m => ({
      id: m.id,
      name: m.name,
      contextWindow: m.capabilities?.limits?.max_context_window_tokens ?? 0,
      supportedReasoningEfforts: m.supportedReasoningEfforts as ReasoningEffort[] | undefined,
      defaultReasoningEffort: m.defaultReasoningEffort as ReasoningEffort | undefined,
    }));
  }

  /** Resolve the effective profile for a panel (panel override → global active). */
  resolveProfileForPanel(panelId: string): ConnectionProfile {
    const panelProfileId = this.panelProfiles.get(panelId);
    if (panelProfileId) {
      const p = getProfile(panelProfileId);
      if (p) return p;
    }
    return getActiveProfile();
  }

  getFeatures(): FeatureFlags {
    return settingsStore.get('features');
  }

  setFeatures(features: FeatureFlags): void {
    settingsStore.set('features', features);
    // Restart sessions to pick up new config
    for (const [id, session] of this.sessions) {
      session.disconnect().catch(() => {});
      this.sessions.delete(id);
    }
  }

  getReasoningEffort(): ReasoningEffort | null {
    return settingsStore.get('reasoningEffort');
  }

  setReasoningEffort(effort: ReasoningEffort | null): void {
    settingsStore.set('reasoningEffort', effort);
    for (const [id, session] of this.sessions) {
      session.disconnect().catch(() => {});
      this.sessions.delete(id);
    }
  }

  getCustomAgents(): CustomAgentConfig[] {
    return settingsStore.get('customAgents');
  }

  setCustomAgents(agents: CustomAgentConfig[]): void {
    settingsStore.set('customAgents', agents);
    for (const [id, session] of this.sessions) {
      session.disconnect().catch(() => {});
      this.sessions.delete(id);
    }
  }

  getCompactionThresholds(): { background: number; bufferExhaustion: number } {
    return settingsStore.get('compactionThresholds');
  }

  setCompactionThresholds(thresholds: { background: number; bufferExhaustion: number }): void {
    settingsStore.set('compactionThresholds', thresholds);
    // Restart sessions to apply new thresholds
    for (const [id, session] of this.sessions) {
      session.disconnect().catch(() => {});
      this.sessions.delete(id);
    }
  }

  getSkillDirectories(): string[] {
    return settingsStore.get('skillDirectories');
  }

  setSkillDirectories(dirs: string[]): void {
    settingsStore.set('skillDirectories', dirs);
    for (const [id, session] of this.sessions) {
      session.disconnect().catch(() => {});
      this.sessions.delete(id);
    }
  }

  getDisabledSkills(): string[] {
    return settingsStore.get('disabledSkills');
  }

  setDisabledSkills(skills: string[]): void {
    settingsStore.set('disabledSkills', skills);
    for (const [id, session] of this.sessions) {
      session.disconnect().catch(() => {});
      this.sessions.delete(id);
    }
  }

  getCliMode(): CliMode {
    return settingsStore.get('cliMode');
  }

  setCliMode(mode: CliMode): void {
    settingsStore.set('cliMode', mode);
    // Tear down client so ensureStarted re-creates it with new mode
    this.stop();
  }

  // ── Server Mode ──────────────────────────────────────────────────────

  getServerModeConfig(): ServerModeConfig {
    return settingsStore.get('serverMode');
  }

  getServerInfo(): ServerInfo {
    const config = this.getServerModeConfig();
    return {
      enabled: config.enabled,
      port: config.port,
      state: this.started ? 'connected' : 'disconnected',
      externalSessionCount: this.externalSessionCount,
    };
  }

  /** Enable server mode: restart client on a fixed TCP port so external agents can connect. */
  async enableServerMode(port = 19900): Promise<void> {
    // Save session IDs for resumption after client restart
    const sessionEntries = [...this.sessions.entries()].map(([panelId, session]) => ({
      panelId,
      sessionId: session.sessionId,
    }));

    // Tear down current client
    for (const [, session] of this.sessions) {
      await session.disconnect().catch(() => {});
    }
    this.sessions.clear();
    this.ownSessionIds.clear();
    this.externalSessionCount = 0;
    if (this.lifecycleUnsub) {
      this.lifecycleUnsub();
      this.lifecycleUnsub = null;
    }
    if (this.started && this.client) {
      await this.client.stop();
    }
    this.client = null;
    this.started = false;

    // Persist and restart with TCP
    settingsStore.set('serverMode', { enabled: true, port });
    await this.ensureStarted();

    // Resume sessions so chat history is preserved
    for (const { panelId, sessionId } of sessionEntries) {
      try {
        const opts = this.buildResumeOpts(panelId);
        const resumed = await this.client!.resumeSession(sessionId, opts as Parameters<CopilotClientType['resumeSession']>[1]);
        this.sessions.set(panelId, resumed);
        this.ownSessionIds.add(resumed.sessionId);
      } catch {
        console.warn(`[CopilotService] Could not resume session ${sessionId} after server mode enable`);
      }
    }

    console.log(`[CopilotService] Server mode enabled on port ${port}`);
  }

  /** Disable server mode: restart client in default stdio mode, resume sessions. */
  async disableServerMode(): Promise<void> {
    const sessionEntries = [...this.sessions.entries()].map(([panelId, session]) => ({
      panelId,
      sessionId: session.sessionId,
    }));

    for (const [, session] of this.sessions) {
      await session.disconnect().catch(() => {});
    }
    this.sessions.clear();
    this.ownSessionIds.clear();
    this.externalSessionCount = 0;
    if (this.lifecycleUnsub) {
      this.lifecycleUnsub();
      this.lifecycleUnsub = null;
    }
    if (this.started && this.client) {
      await this.client.stop();
    }
    this.client = null;
    this.started = false;

    settingsStore.set('serverMode', { ...this.getServerModeConfig(), enabled: false });
    await this.ensureStarted();

    for (const { panelId, sessionId } of sessionEntries) {
      try {
        const opts = this.buildResumeOpts(panelId);
        const resumed = await this.client!.resumeSession(sessionId, opts as Parameters<CopilotClientType['resumeSession']>[1]);
        this.sessions.set(panelId, resumed);
      } catch {
        console.warn(`[CopilotService] Could not resume session ${sessionId} after server mode disable`);
      }
    }

    console.log('[CopilotService] Server mode disabled, back to stdio');
  }

  /** Switch to a new active profile. Restarts client if CLI backend changed, otherwise recycles only sessions using the global profile. */
  async applyProfile(previousProfileId: string): Promise<void> {
    const prev = getProfile(previousProfileId);
    const next = getActiveProfile();

    const prevIsCliBackend = !prev || prev.connection.type === 'copilot-cli' || prev.connection.type === 'copilot-remote';
    const nextIsCliBackend = next.connection.type === 'copilot-cli' || next.connection.type === 'copilot-remote';

    // If CLI backend type changed, full client restart is needed
    const needsClientRestart = prevIsCliBackend !== nextIsCliBackend
      || (prev?.connection.type !== next.connection.type)
      || (prev?.connection.type === 'copilot-cli' && next.connection.type === 'copilot-cli' && prev.connection.cliMode !== next.connection.cliMode)
      || (prev?.connection.type === 'copilot-remote' && next.connection.type === 'copilot-remote' && prev.connection.url !== next.connection.url);

    if (needsClientRestart) {
      await this.stop();
    } else {
      // Only recycle sessions that don't have their own panel-level profile override
      for (const [id, session] of this.sessions) {
        if (!this.panelProfiles.has(id)) {
          session.disconnect().catch(() => {});
          this.sessions.delete(id);
        }
      }
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
      await existing.disconnect().catch(() => {});
      this.sessions.delete(panelId);
    }
    const opts = this.buildResumeOpts(panelId);
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
      session.disconnect().catch(() => {});
      this.sessions.delete(id);
    }
  }

  async listModels(): Promise<ModelInfoResult[]> {
    // If active profile is BYOK with curated enabledModels, return those instead of CLI models
    const profile = getActiveProfile();
    if (profile.enabledModels?.length) {
      return profile.enabledModels.map(id => ({ id, name: id, contextWindow: 0 }));
    }
    await this.ensureStarted();
    const models = await this.client!.listModels();
    return models.map(m => ({
      id: m.id,
      name: m.name,
      contextWindow: m.capabilities?.limits?.max_context_window_tokens ?? 0,
      supportedReasoningEfforts: m.supportedReasoningEfforts as ReasoningEffort[] | undefined,
      defaultReasoningEffort: m.defaultReasoningEffort as ReasoningEffort | undefined,
    }));
  }

  async refreshModels(): Promise<ModelInfoResult[]> {
    await this.ensureStarted();
    // Clear SDK's internal model cache to force a fresh fetch
    (this.client as unknown as { modelsCache: unknown }).modelsCache = null;
    return this.listModels();
  }

  async ensureStarted(): Promise<void> {
    if (!this.started) {
      const { CopilotClient, RuntimeConnection } = await loadSDK();
      const opts: Record<string, unknown> = {};

      // Derive CLI backend from active profile's connection type
      const profile = getActiveProfile();
      const conn = profile.connection;
      const serverConfig = this.getServerModeConfig();

      // Resolve CLI path for local runtimes
      let cliPath = '';
      if (conn.type !== 'copilot-remote') {
        if (conn.type === 'copilot-cli' && conn.cliMode === 'installed') {
          cliPath = resolveSystemCli();
          if (cliPath) {
            console.log('[CopilotService] Using installed CLI at', cliPath);
          } else {
            console.warn('[CopilotService] No system CLI found, falling back to bundled');
            cliPath = resolveBundledCliPath();
            console.log('[CopilotService] Resolved bundled CLI path:', cliPath || '(SDK default)');
          }
        } else {
          cliPath = resolveBundledCliPath();
          console.log('[CopilotService] Resolved bundled CLI path:', cliPath || '(SDK default)');
        }
      }

      // Build RuntimeConnection based on mode
      if (conn.type === 'copilot-remote') {
        opts.connection = RuntimeConnection.forUri(conn.url);
        console.log('[CopilotService] Using remote CLI at', conn.url);
      } else if (serverConfig.enabled) {
        opts.connection = RuntimeConnection.forTcp({
          port: serverConfig.port,
          ...(cliPath ? { path: cliPath } : {}),
        });
        console.log(`[CopilotService] Server mode: starting runtime on TCP port ${serverConfig.port}`);
      } else {
        opts.connection = RuntimeConnection.forStdio(cliPath ? { path: cliPath } : undefined);
      }

      // When using a bundled .js CLI in packaged Electron, process.execPath is
      // the Electron binary. ELECTRON_RUN_AS_NODE makes it behave as plain Node.
      // Not needed for the native platform binary (no .js extension).
      if (app.isPackaged && cliPath.endsWith('.js')) {
        opts.env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
      }

      // Auth token: prefer profile's oauthToken, then fall back to global OAuth.
      // Only set for spawned runtimes (forUri connects to an externally-authed runtime).
      if (conn.type !== 'copilot-remote') {
        if (profile.oauthToken) {
          opts.gitHubToken = profile.oauthToken;
        } else if (profile.authSource === 'oauth' || getActiveSource() === 'oauth') {
          const token = getPersistedOAuthToken();
          if (token) {
            opts.gitHubToken = token;
          }
        }
      }

      this.client = new CopilotClient(opts as ConstructorParameters<typeof CopilotClient>[0]);
      try {
        await this.client.start();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // If the port is already in use, connect as a secondary client instead of spawning
        if (serverConfig.enabled && msg.includes('EADDRINUSE')) {
          console.log(`[CopilotService] Port ${serverConfig.port} in use, connecting as secondary client`);
          const { CopilotClient: FreshClient, RuntimeConnection: RT } = await loadSDK();
          const fallbackOpts: Record<string, unknown> = {
            connection: RT.forUri(`localhost:${serverConfig.port}`),
          };
          if (opts.logLevel) fallbackOpts.logLevel = opts.logLevel;
          this.client = new FreshClient(fallbackOpts as ConstructorParameters<typeof CopilotClient>[0]);
          await this.client.start();
        } else {
          throw err;
        }
      }
      this.started = true;

      // In server mode, track external sessions via lifecycle events
      if (serverConfig.enabled) {
        this.subscribeToLifecycleEvents();
      }
    }
  }

  async ensureSession(panelId = 'main'): Promise<CopilotSessionType> {
    await this.ensureStarted();
    let session = this.sessions.get(panelId);
    if (!session) {
      const features = this.getFeatures();
      const profile = this.resolveProfileForPanel(panelId);

      // Merge excluded tools: panel-level overrides + profile defaults
      const panelExcluded = this.panelExcludedTools.get(panelId) ?? [];
      const profileExcluded = profile.excludedTools ?? [];
      const allExcluded = [...new Set([...panelExcluded, ...profileExcluded])];

      const effectiveModel = this.panelModels.get(panelId) || profile.model || this.model;

      const opts: Record<string, unknown> = {
        model: effectiveModel,
        streaming: true,
        excludedTools: allExcluded,
        mcpServers: loadMCPServers(),
        includeSubAgentStreamingEvents: true,
      };

      // Provider config from BYOK profiles (session-level — enables per-panel providers)
      const provider = buildProviderConfig(profile.connection);
      if (provider) {
        opts.provider = provider;
      }

      // Skill directories / disabled skills from profile
      if (profile.skillDirectories?.length) {
        opts.skillDirectories = profile.skillDirectories;
      }
      if (profile.disabledSkills?.length) {
        opts.disabledSkills = profile.disabledSkills;
      }

      if (this.panelCwds.get(panelId) || this.workingDirectory) {
        opts.workingDirectory = this.panelCwds.get(panelId) || this.workingDirectory;
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
            kind: decision === 'deny' ? 'denied-interactively-by-user' : 'approve-once',
          };
        };
      } else {
        opts.onPermissionRequest = async () => ({ kind: 'approve-once' });
      }
      // Ask User handler
      if (features.askUser && this.userInputCallback) {
        opts.onUserInputRequest = this.userInputCallback;
      }
      // Reasoning effort — per-panel override → global setting.
      // For BYOK providers, trust the caller (upstream provider validates).
      // For Copilot-native, verify the model supports it via capabilities.
      const panelEffort = this.panelReasoningEffort.get(panelId);
      const effort = panelEffort !== undefined ? panelEffort : this.getReasoningEffort();
      if (features.reasoning && effort) {
        const isByok = !!opts.provider;
        if (isByok) {
          opts.reasoningEffort = effort;
        } else {
          try {
            const models = await this.client!.listModels();
            const info = models.find(m => m.id === effectiveModel);
            if (info?.capabilities?.supports?.reasoningEffort) {
              opts.reasoningEffort = effort;
            }
          } catch {
            // If we can't verify, skip reasoning effort to avoid session.create failure
          }
        }
      }
      // Infinite sessions with configurable compaction thresholds
      if (features.infiniteSessions) {
        const thresholds = this.getCompactionThresholds();
        opts.infiniteSessions = {
          enabled: true,
          backgroundCompactionThreshold: thresholds.background,
          bufferExhaustionThreshold: thresholds.bufferExhaustion,
        };
      }
      // Global skill directories / disabled skills (merged with profile-level ones)
      const globalSkillDirs = settingsStore.get('skillDirectories');
      if (globalSkillDirs.length && !opts.skillDirectories) {
        opts.skillDirectories = globalSkillDirs;
      } else if (globalSkillDirs.length && Array.isArray(opts.skillDirectories)) {
        opts.skillDirectories = [...new Set([...(opts.skillDirectories as string[]), ...globalSkillDirs])];
      }
      const globalDisabledSkills = settingsStore.get('disabledSkills');
      if (globalDisabledSkills.length && !opts.disabledSkills) {
        opts.disabledSkills = globalDisabledSkills;
      } else if (globalDisabledSkills.length && Array.isArray(opts.disabledSkills)) {
        opts.disabledSkills = [...new Set([...(opts.disabledSkills as string[]), ...globalDisabledSkills])];
      }
      // Custom agents
      if (features.customAgents) {
        const agents = this.getCustomAgents();
        if (agents.length > 0) {
          opts.customAgents = agents;
        }
      }
      // Session hooks — real implementations
      if (features.hooks) {
        const sessionCwd = (this.panelCwds.get(panelId) || this.workingDirectory) ?? '';
        const hooks: SessionHooks = {
          onSessionStart: async (input: { timestamp: number; cwd: string; source: string }) => {
            // Inject git context + working directory info
            let context = `Session started at ${new Date(input.timestamp).toLocaleString()} in ${input.cwd}`;
            try {
              const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: input.cwd || sessionCwd, encoding: 'utf-8', timeout: 3000 }).trim();
              const lastCommit = execSync('git log -1 --oneline', { cwd: input.cwd || sessionCwd, encoding: 'utf-8', timeout: 3000 }).trim();
              context += `\nGit branch: ${branch}\nLast commit: ${lastCommit}`;
            } catch {
              // Not a git repo or git not available
            }
            console.log(`[Hook] onSessionStart: source=${input.source}, cwd=${input.cwd}`);
            return { additionalContext: context };
          },
          onUserPromptSubmitted: async (input: { timestamp: number; cwd: string; prompt: string }) => {
            // Enrich every prompt with current timestamp and git branch
            let context: string | undefined;
            try {
              const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: input.cwd || sessionCwd, encoding: 'utf-8', timeout: 3000 }).trim();
              const status = execSync('git diff --stat HEAD', { cwd: input.cwd || sessionCwd, encoding: 'utf-8', timeout: 3000 }).trim();
              const parts = [`Time: ${new Date(input.timestamp).toLocaleString()}`, `Branch: ${branch}`];
              if (status) parts.push(`Uncommitted changes:\n${status}`);
              context = parts.join('\n');
            } catch {
              context = `Time: ${new Date(input.timestamp).toLocaleString()}`;
            }
            return { additionalContext: context };
          },
          onPreToolUse: async (input: { timestamp: number; cwd: string; toolName: string; toolArgs: unknown }) => {
            console.log(`[Hook] onPreToolUse: ${input.toolName}`);
            return {};
          },
          onPostToolUse: async (input: { timestamp: number; cwd: string; toolName: string; toolArgs: unknown; toolResult: unknown }) => {
            // Track tool usage for gamification — emit over IPC so renderer can trigger milestones
            console.log(`[Hook] onPostToolUse: ${input.toolName}`);
            return {};
          },
          onErrorOccurred: async (input: { timestamp: number; cwd: string; error: string; errorContext: string; recoverable: boolean }) => {
            console.error(`[Hook] onErrorOccurred: context=${input.errorContext}, recoverable=${input.recoverable}, error=${input.error}`);
            if (input.recoverable) {
              // Retry once for recoverable errors (model timeouts, transient failures)
              return { errorHandling: 'retry', retryCount: 2 };
            }
            // Non-recoverable: abort to surface error to user
            return { errorHandling: 'abort' };
          },
          onSessionEnd: async (input: { timestamp: number; cwd: string; reason: string }) => {
            console.log(`[Hook] onSessionEnd: reason=${input.reason}, cwd=${input.cwd}`);
            return {};
          },
        };
        opts.hooks = hooks;
      }
      // Custom tools (native Electron capabilities + delegate)
      if (features.customTools) {
        const tools = await buildNativeTools();
        const dt = await getDefineTool();
        // Delegate tool — allows the agent to spin off work into a new tab
        if (this.delegateCallback) {
          const delegateCb = this.delegateCallback;
          const srcPanel = panelId;
          tools.push(dt('delegate_to_tab', {
            description: 'Delegate a task to a new tab. Creates a new background tab in the app and starts an independent agent session with the given prompt. The new tab mirrors settings (CWD, model, YOLO mode) from this tab. Use this to parallelize work — for example, delegating a sub-task while you continue working on the main task.',
            parameters: {
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'The prompt/task to send to the new agent session in the new tab' },
                description: { type: 'string', description: 'Short label for the new tab (e.g. "Fix tests", "Update docs")' },
              },
              required: ['prompt'],
            },
            handler: async (args: unknown) => {
              const { prompt, description } = args as { prompt: string; description?: string };
              delegateCb({ prompt, description, sourcePanelId: srcPanel });
              return `Delegated to new tab${description ? `: "${description}"` : ''}. The new agent session is running independently.`;
            },
          }));
        }
        // Celebrate tool — allows the agent to fire a celebration overlay
        if (this.celebrateCallback) {
          const celebrateCb = this.celebrateCallback;
          tools.push(dt('celebrate', {
            description: 'Fire a celebration animation in the app! Use this to celebrate accomplishments, completed tasks, milestones, or anything worth cheering about. Picks from 5 visual intensity levels and plays a sound.',
            parameters: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'Short celebratory message to display (e.g. "Tests passing!", "Ship it! 🚀", "All bugs squashed!")' },
                emoji: { type: 'string', description: 'Single emoji for the celebration (e.g. "🎉", "🚀", "✨", "🏆", "🔥")' },
                effect: {
                  type: 'string',
                  enum: ['sparkle', 'banner', 'confetti', 'jackpot', 'mega'],
                  description: 'Visual intensity: sparkle (subtle), banner (medium), confetti (big), jackpot (huge with screen effects), mega (maximum with screen shake)',
                },
                sound: {
                  type: 'string',
                  enum: ['milestone', 'jackpot', 'celebration100k', 'celebration500k'],
                  description: 'Sound to play: milestone (quick chime), jackpot (slot machine bells), celebration100k (triumphant fanfare), celebration500k (epic orchestral)',
                },
              },
              required: ['message'],
            },
            handler: async (args: unknown) => {
              const { message, emoji, effect, sound } = args as { message: string; emoji?: string; effect?: string; sound?: string };
              celebrateCb({
                message,
                emoji: emoji || '🎉',
                effect: effect || 'confetti',
                sound: sound || 'milestone',
              });
              return `Celebration fired: "${message}"`;
            },
          }));
        }
        opts.tools = tools;
      }
      session = await this.client!.createSession(opts as unknown as Parameters<CopilotClientType['createSession']>[0]);
      this.sessions.set(panelId, session);
      this.ownSessionIds.add(session.sessionId);
      this.installSubagentSubscription(panelId, session);
    }
    return session;
  }

  /** Install a long-lived session subscription that feeds the SubagentTracker.
   *  This persists beyond individual sendMessage turns so agents that outlive
   *  the parent turn are still tracked. */
  private installSubagentSubscription(panelId: string, session: CopilotSessionType): void {
    // Clean up any existing subscription
    this.sessionSubagentUnsubs.get(panelId)?.();

    const unsub = session.on((event: { type: string; agentId?: string; data?: unknown }) => {
      const agentId = event.agentId;
      const data = (event.data ?? {}) as Record<string, unknown>;

      switch (event.type) {
        case 'subagent.started':
          this.subagentTracker.trackStarted(panelId, {
            agentId: agentId,
            toolCallId: String(data.toolCallId ?? ''),
            agentName: String(data.agentName ?? ''),
            agentDisplayName: String(data.agentDisplayName ?? data.agentName ?? ''),
            agentDescription: String(data.agentDescription ?? ''),
          });
          break;
        case 'subagent.completed':
          this.subagentTracker.trackCompleted(panelId, {
            agentId: agentId,
            toolCallId: String(data.toolCallId ?? ''),
            agentDisplayName: data.agentDisplayName ? String(data.agentDisplayName) : undefined,
            durationMs: data.durationMs as number | undefined,
            model: data.model as string | undefined,
            totalTokens: data.totalTokens as number | undefined,
            totalToolCalls: data.totalToolCalls as number | undefined,
          });
          break;
        case 'subagent.failed':
          this.subagentTracker.trackFailed(panelId, {
            agentId: agentId,
            toolCallId: String(data.toolCallId ?? ''),
            error: String(data.error ?? 'Unknown error'),
            durationMs: data.durationMs as number | undefined,
            model: data.model as string | undefined,
            totalTokens: data.totalTokens as number | undefined,
            totalToolCalls: data.totalToolCalls as number | undefined,
          });
          break;
        default:
          // Sub-agent streaming events are tagged with agentId
          if (!agentId) break;
          switch (event.type) {
            case 'assistant.message_delta':
              this.subagentTracker.trackStreamingDelta(panelId, agentId, String(data.deltaContent ?? ''));
              break;
            case 'assistant.intent':
              this.subagentTracker.trackIntent(panelId, agentId, String(data.intent ?? ''));
              break;
            case 'assistant.turn_start':
              this.subagentTracker.trackTurnStart(panelId, agentId);
              break;
            case 'tool.execution_start':
              this.subagentTracker.trackToolStart(panelId, agentId, {
                toolCallId: String(data.toolCallId ?? ''),
                toolName: String(data.toolName ?? ''),
                args: (data.arguments ?? data.toolArgs ?? {}) as Record<string, unknown>,
              });
              break;
            case 'tool.execution_complete':
              this.subagentTracker.trackToolComplete(panelId, agentId, {
                toolCallId: String(data.toolCallId ?? ''),
                success: Boolean(data.success ?? true),
                result: (data.result as { content?: string })?.content,
                error: (data.error as { message?: string })?.message,
              });
              break;
            case 'assistant.usage':
              this.subagentTracker.trackUsage(
                panelId,
                agentId,
                Number(data.inputTokens ?? 0),
                Number(data.outputTokens ?? 0),
              );
              if (data.model) this.subagentTracker.trackModel(panelId, agentId, String(data.model));
              break;
            case 'session.idle':
              this.subagentTracker.trackIdle(panelId, agentId);
              break;
          }
          break;
      }
    });
    this.sessionSubagentUnsubs.set(panelId, unsub);
  }

  /** Destroy and remove a specific panel session */
  async destroySession(panelId: string): Promise<void> {
    // Clean up sub-agent subscription and tracked state
    this.sessionSubagentUnsubs.get(panelId)?.();
    this.sessionSubagentUnsubs.delete(panelId);
    this.subagentTracker.clearPanel(panelId);

    const session = this.sessions.get(panelId);
    if (session) {
      await session.disconnect().catch(() => {});
      this.sessions.delete(panelId);
    }
    this.panelCwds.delete(panelId);
    this.panelExcludedTools.delete(panelId);
    this.panelProfiles.delete(panelId);
    this.panelModels.delete(panelId);
    this.panelReasoningEffort.delete(panelId);
  }

  /** Return the names of all custom (native/delegate) tools that can be toggled. */
  async getCustomToolNames(): Promise<string[]> {
    const tools = await buildNativeTools();
    const names = tools.map(t => t.name);
    if (this.delegateCallback) names.push('delegate_to_tab');
    if (this.celebrateCallback) names.push('celebrate');
    return names;
  }

  /** Get an existing session for a panel (does not create one). Used by IPC for RPC calls. */
  getSession(panelId: string): CopilotSessionType | undefined {
    return this.sessions.get(panelId);
  }

  /** Build the common options used when resuming a session. */
  private buildResumeOpts(panelId?: string): Record<string, unknown> {
    const opts: Record<string, unknown> = {
      model: this.model,
      streaming: true,
      includeSubAgentStreamingEvents: true,
    };
    const cwd = (panelId && this.panelCwds.get(panelId)) || this.workingDirectory;
    if (cwd) opts.workingDirectory = cwd;
    if (this.permissionCallback) {
      const cb = this.permissionCallback;
      opts.onPermissionRequest = async (request: Record<string, unknown>) => {
        const decision = await cb(request);
        return { kind: decision === 'deny' ? 'denied-interactively-by-user' : 'approve-once' };
      };
    } else {
      opts.onPermissionRequest = async () => ({ kind: 'approve-once' });
    }
    if (this.userInputCallback) {
      opts.onUserInputRequest = this.userInputCallback;
    }
    return opts;
  }

  /** Destroy all sessions and resume them so new session-level options take effect. */
  async recycleAllSessions(): Promise<void> {
    if (!this.started || this.sessions.size === 0) return;
    const entries = [...this.sessions.entries()];
    for (const [panelId, session] of entries) {
      const sid = session.sessionId;
      await session.disconnect().catch(() => {});
      this.sessions.delete(panelId);
      try {
        const opts = this.buildResumeOpts(panelId);
        opts.suppressResumeEvent = true;
        const resumed = await this.client!.resumeSession(sid, opts as Parameters<CopilotClientType['resumeSession']>[1]);
        this.sessions.set(panelId, resumed);
      } catch {
        // Session couldn't be resumed; ensureSession will create a fresh one on next message
      }
    }
  }

  /** Tear down the client entirely so it re-initialises with fresh auth on next use. */
  async restartClient(): Promise<void> {
    for (const [, session] of this.sessions) {
      await session.disconnect().catch(() => {});
    }
    this.sessions.clear();
    this.ownSessionIds.clear();
    this.externalSessionCount = 0;
    if (this.lifecycleUnsub) {
      this.lifecycleUnsub();
      this.lifecycleUnsub = null;
    }
    if (this.client) {
      await (this.client as unknown as { stop?: () => Promise<void> }).stop?.().catch(() => {});
    }
    this.client = null as unknown as CopilotClientType;
    this.started = false;
  }

  /** Subscribe to session lifecycle events to track external clients connecting to our runtime. */
  private subscribeToLifecycleEvents(): void {
    if (!this.client || this.lifecycleUnsub) return;
    this.lifecycleUnsub = this.client.onLifecycle((event: { type: string; sessionId?: string }) => {
      if (!event.sessionId) return;
      if (event.type === 'session.created' && !this.ownSessionIds.has(event.sessionId)) {
        this.externalSessionCount++;
        console.log(`[CopilotService] External session connected (${this.externalSessionCount} total)`);
      } else if (event.type === 'session.deleted' && !this.ownSessionIds.has(event.sessionId)) {
        this.externalSessionCount = Math.max(0, this.externalSessionCount - 1);
        console.log(`[CopilotService] External session disconnected (${this.externalSessionCount} total)`);
      }
    });
  }

  private abortResolves = new Map<string, () => void>();

  async sendMessage(prompt: string, onEvent: EventCallback, attachments?: { path: string }[], panelId = 'main', _retry = false, mode?: 'enqueue' | 'immediate'): Promise<void> {
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
            const usage = event.data as {
              inputTokens?: number; outputTokens?: number; model?: string;
              cost?: number; duration?: number; cacheReadTokens?: number; cacheWriteTokens?: number;
              quotaSnapshots?: Record<string, QuotaSnapshot>;
              copilotUsage?: { tokenDetails: { batchSize: number; costPerBatch: number; tokenCount: number; tokenType: string }[]; totalNanoAiu: number };
            };
            onEvent({
              type: 'assistant.usage',
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              model: usage.model ?? '',
              cost: usage.cost,
              duration: usage.duration,
              cacheReadTokens: usage.cacheReadTokens,
              cacheWriteTokens: usage.cacheWriteTokens,
              quotaSnapshots: usage.quotaSnapshots,
              copilotUsage: usage.copilotUsage,
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
              agentId: event.agentId,
            });
            break;
          }
          case 'subagent.completed': {
            const data = event.data as { toolCallId?: string; agentName?: string; name?: string; agentDisplayName?: string; durationMs?: number; model?: string; totalTokens?: number; totalToolCalls?: number };
            onEvent({
              type: 'subagent.completed',
              toolCallId: data.toolCallId ?? '',
              name: data.agentName ?? data.name ?? '',
              agentId: event.agentId,
              durationMs: data.durationMs,
              model: data.model,
              totalTokens: data.totalTokens,
              totalToolCalls: data.totalToolCalls,
            });
            break;
          }
          case 'subagent.failed': {
            const data = event.data as { toolCallId?: string; agentName?: string; name?: string; error?: string; durationMs?: number; model?: string; totalTokens?: number; totalToolCalls?: number };
            onEvent({
              type: 'subagent.failed',
              toolCallId: data.toolCallId ?? '',
              name: data.agentName ?? data.name ?? '',
              error: data.error ?? 'Unknown error',
              agentId: event.agentId,
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

    const sendOpts: { prompt: string; attachments?: { type: 'file'; path: string }[]; mode?: 'enqueue' | 'immediate' } = { prompt };
    if (attachments?.length) {
      sendOpts.attachments = attachments.map(a => ({ type: 'file' as const, path: a.path }));
    }
    if (mode) {
      sendOpts.mode = mode;
    }
    try {
      await session.send(sendOpts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!_retry && (msg.includes('Session not found') || msg.includes('connection is closed') || msg.includes('Client not connected'))) {
        const staleId = session.sessionId;
        this.sessions.delete(panelId);
        this.abortResolves.delete(panelId);
        // Try to resume the old session (preserves chat history)
        try {
          console.log('[CopilotService] Stale session detected, attempting resume:', staleId);
          const opts = this.buildResumeOpts(panelId);
          const resumed = await this.client!.resumeSession(staleId, opts as Parameters<CopilotClientType['resumeSession']>[1]);
          this.sessions.set(panelId, resumed);
        } catch {
          // Resume failed — ensureSession will create a fresh one
          console.warn('[CopilotService] Resume failed, will create fresh session');
        }
        return this.sendMessage(prompt, onEvent, attachments, panelId, true, mode);
      }
      throw err;
    }
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
      await session.disconnect().catch(() => {});
      this.sessions.delete(id);
    }
    this.ownSessionIds.clear();
    this.externalSessionCount = 0;
    if (this.lifecycleUnsub) {
      this.lifecycleUnsub();
      this.lifecycleUnsub = null;
    }
    if (this.started && this.client) {
      await this.client.stop();
      this.started = false;
    }
  }
}
