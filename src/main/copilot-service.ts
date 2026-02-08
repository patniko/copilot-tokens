import { CopilotClient, type CopilotSession } from '@github/copilot-sdk';

// CopilotEvent union type (renderer-facing)
export type CopilotEvent =
  | { type: 'assistant.message_delta'; delta: string }
  | { type: 'tool_call.bash'; command: string; output?: string }
  | { type: 'tool_call.file_edit'; path: string; diff?: string }
  | { type: 'tool_call.file_read'; path: string; content?: string }
  | { type: 'session.idle' };

export type EventCallback = (event: CopilotEvent) => void;

export class CopilotService {
  private static instance: CopilotService;
  private client: CopilotClient;
  private session: CopilotSession | null = null;
  private started = false;

  private constructor() {
    this.client = new CopilotClient({ autoStart: false });
  }

  static getInstance(): CopilotService {
    if (!CopilotService.instance) {
      CopilotService.instance = new CopilotService();
    }
    return CopilotService.instance;
  }

  async ensureStarted(): Promise<void> {
    if (!this.started) {
      await this.client.start();
      this.started = true;
    }
  }

  async ensureSession(): Promise<CopilotSession> {
    await this.ensureStarted();
    if (!this.session) {
      this.session = await this.client.createSession({
        model: 'gpt-4.1',
        streaming: true,
      });
    }
    return this.session;
  }

  async sendMessage(prompt: string, onEvent: EventCallback): Promise<void> {
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
          case 'tool.execution_start': {
            const data = event.data as { toolName?: string; toolArgs?: Record<string, unknown> };
            const name = data.toolName ?? '';
            const args = data.toolArgs ?? {};
            if (name === 'bash' || name === 'shell') {
              onEvent({ type: 'tool_call.bash', command: String(args.command ?? '') });
            } else if (name === 'edit' || name === 'file_edit' || name === 'write') {
              onEvent({ type: 'tool_call.file_edit', path: String(args.path ?? args.file ?? '') });
            } else if (name === 'read' || name === 'file_read' || name === 'view') {
              onEvent({ type: 'tool_call.file_read', path: String(args.path ?? args.file ?? '') });
            }
            break;
          }
          case 'tool.execution_complete': {
            const data = event.data as { toolName?: string; result?: string };
            const name = data.toolName ?? '';
            if (name === 'bash' || name === 'shell') {
              onEvent({ type: 'tool_call.bash', command: '', output: String(data.result ?? '') });
            }
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

    await session.send({ prompt });
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
    if (this.started) {
      await this.client.stop();
      this.started = false;
    }
  }
}
