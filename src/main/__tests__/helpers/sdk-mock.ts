import { vi } from 'vitest';

export function createMockSession(overrides?: Record<string, unknown>) {
  return {
    sessionId: 'mock-session-id',
    workspacePath: '/mock/workspace',
    rpc: {},
    send: vi.fn().mockResolvedValue('mock-msg-id'),
    sendAndWait: vi.fn().mockResolvedValue({ type: 'assistant.message', content: 'hello' }),
    on: vi.fn().mockReturnValue(() => {}),
    registerTools: vi.fn(),
    getToolHandler: vi.fn().mockReturnValue(undefined),
    registerPermissionHandler: vi.fn(),
    registerUserInputHandler: vi.fn(),
    registerHooks: vi.fn(),
    getMessages: vi.fn().mockResolvedValue([]),
    disconnect: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
    setModel: vi.fn().mockResolvedValue(undefined),
    _dispatchEvent: vi.fn(),
    _handlePermissionRequestV2: vi.fn(),
    _handleUserInputRequest: vi.fn(),
    _handleHooksInvoke: vi.fn(),
    ...overrides,
  };
}

export function createMockClient(overrides?: Record<string, unknown>) {
  const mockSession = createMockSession();
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue([]),
    forceStop: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(mockSession),
    resumeSession: vi.fn().mockResolvedValue(mockSession),
    getState: vi.fn().mockReturnValue('connected'),
    ping: vi.fn().mockResolvedValue({ message: 'pong' }),
    getStatus: vi.fn().mockResolvedValue({ version: '1.0.0' }),
    getAuthStatus: vi.fn().mockResolvedValue({ authenticated: true, user: 'test' }),
    listModels: vi.fn().mockResolvedValue([
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
      { id: 'gpt-4o', name: 'GPT-4o' },
    ]),
    getLastSessionId: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([]),
    getForegroundSessionId: vi.fn().mockResolvedValue(undefined),
    setForegroundSessionId: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => {}),
    rpc: {},
    _mockSession: mockSession,
    ...overrides,
  };
}

/** Mock for the defineTool function */
export const mockDefineTool = vi.fn((name: string, config: Record<string, unknown>) => ({
  name,
  ...config,
}));

/** Mock for the approveAll function */
export const mockApproveAll = vi.fn().mockReturnValue('allow');

/** Full SDK module mock - use with vi.mock('@github/copilot-sdk', () => sdkModuleMock) */
export function createSdkModuleMock(clientOverrides?: Record<string, unknown>) {
  const client = createMockClient(clientOverrides);
  const MockCopilotClient = vi.fn().mockImplementation(() => client);
  const MockCopilotSession = vi.fn().mockImplementation((id: string) => createMockSession({ sessionId: id }));

  return {
    CopilotClient: MockCopilotClient,
    CopilotSession: MockCopilotSession,
    defineTool: mockDefineTool,
    approveAll: mockApproveAll,
    _mockClient: client,
    _mockClientConstructor: MockCopilotClient,
  };
}
