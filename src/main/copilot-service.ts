import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { app } from 'electron';
import { execSync } from 'child_process';

// Dynamic import to load ESM SDK in Electron's CJS main process
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type CopilotClientType = import('@github/copilot-sdk').CopilotClient;
type CopilotSessionType = import('@github/copilot-sdk').CopilotSession;
type MCPServerConfig = import('@github/copilot-sdk').MCPServerConfig;

// CopilotEvent union type (renderer-facing)
export type CopilotEvent =
  | { type: 'assistant.message_delta'; delta: string }
  | { type: 'assistant.message'; content: string }
  | { type: 'assistant.intent'; intent: string }
  | { type: 'assistant.usage'; inputTokens: number; outputTokens: number; model: string }
  | { type: 'tool.start'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool.progress'; toolCallId: string; message: string }
  | { type: 'tool.partial'; toolCallId: string; output: string }
  | { type: 'tool.complete'; toolCallId: string; success: boolean; result?: string; error?: string }
  | { type: 'subagent.started'; toolCallId: string; name: string; displayName: string; description: string }
  | { type: 'subagent.completed'; toolCallId: string; name: string }
  | { type: 'subagent.failed'; toolCallId: string; name: string; error: string }
  | { type: 'session.usage_info'; currentTokens: number; tokenLimit: number }
  | { type: 'session.idle' };

export type EventCallback = (event: CopilotEvent) => void;

async function loadSDK(): Promise<typeof import('@github/copilot-sdk')> {
  return import('@github/copilot-sdk');
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
      const opts: Record<string, unknown> = {
        model: this.model,
        streaming: true,
        excludedTools: [],
        mcpServers: loadMCPServers(),
      };
      if (this.workingDirectory) {
        opts.workingDirectory = this.workingDirectory;
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
            const data = event.data as { toolCallId?: string; name?: string; displayName?: string; description?: string };
            onEvent({
              type: 'subagent.started',
              toolCallId: data.toolCallId ?? '',
              name: data.name ?? '',
              displayName: data.displayName ?? data.name ?? '',
              description: data.description ?? '',
            });
            break;
          }
          case 'subagent.completed': {
            const data = event.data as { toolCallId?: string; name?: string };
            onEvent({
              type: 'subagent.completed',
              toolCallId: data.toolCallId ?? '',
              name: data.name ?? '',
            });
            break;
          }
          case 'subagent.failed': {
            const data = event.data as { toolCallId?: string; name?: string; error?: string };
            onEvent({
              type: 'subagent.failed',
              toolCallId: data.toolCallId ?? '',
              name: data.name ?? '',
              error: data.error ?? 'Unknown error',
            });
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
