// Dynamic import to load ESM SDK in Electron's CJS main process
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type CopilotClientType = import('@github/copilot-sdk').CopilotClient;
type CopilotSessionType = import('@github/copilot-sdk').CopilotSession;

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
  | { type: 'session.idle' };

export type EventCallback = (event: CopilotEvent) => void;

async function loadSDK(): Promise<typeof import('@github/copilot-sdk')> {
  return import('@github/copilot-sdk');
}

export class CopilotService {
  private static instance: CopilotService;
  private client: CopilotClientType | null = null;
  private session: CopilotSessionType | null = null;
  private started = false;

  private constructor() {}

  static getInstance(): CopilotService {
    if (!CopilotService.instance) {
      CopilotService.instance = new CopilotService();
    }
    return CopilotService.instance;
  }

  async ensureStarted(): Promise<void> {
    if (!this.started) {
      const { CopilotClient } = await loadSDK();
      this.client = new CopilotClient({ autoStart: false });
      await this.client.start();
      this.started = true;
    }
  }

  async ensureSession(): Promise<CopilotSessionType> {
    await this.ensureStarted();
    if (!this.session) {
      this.session = await this.client!.createSession({
        model: 'gpt-4.1',
        streaming: true,
      });
    }
    return this.session;
  }

  async sendMessage(prompt: string, onEvent: EventCallback, attachments?: { path: string }[]): Promise<void> {
    const session = await this.ensureSession();

    const done = new Promise<void>((resolve) => {
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
          case 'session.idle':
            onEvent({ type: 'session.idle' });
            unsub();
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

  async abort(): Promise<void> {
    if (this.session) {
      await this.session.abort();
    }
  }

  async stop(): Promise<void> {
    if (this.session) {
      await this.session.destroy();
      this.session = null;
    }
    if (this.started && this.client) {
      await this.client.stop();
      this.started = false;
    }
  }
}
