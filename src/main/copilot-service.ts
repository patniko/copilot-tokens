// CopilotEvent union type
export type CopilotEvent =
  | { type: 'assistant.message_delta'; delta: string }
  | { type: 'tool_call.bash'; command: string; output?: string }
  | { type: 'tool_call.file_edit'; path: string; diff?: string }
  | { type: 'tool_call.file_read'; path: string; content?: string }
  | { type: 'session.idle' };

export class CopilotService {
  private static instance: CopilotService;
  private abortController: AbortController | null = null;

  private constructor() {}

  static getInstance(): CopilotService {
    if (!CopilotService.instance) {
      CopilotService.instance = new CopilotService();
    }
    return CopilotService.instance;
  }

  async *sendMessage(prompt: string): AsyncGenerator<CopilotEvent> {
    this.abortController = new AbortController();

    // TODO: Replace with real Copilot API integration
    console.log(`[CopilotService] sendMessage: ${prompt}`);
    yield {
      type: 'assistant.message_delta',
      delta: `Mock response to: ${prompt}`,
    };
    yield { type: 'session.idle' };
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
