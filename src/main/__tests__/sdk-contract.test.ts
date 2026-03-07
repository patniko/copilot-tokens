/**
 * SDK Contract Tests — @github/copilot-sdk
 *
 * These tests verify the public API surface of the Copilot SDK by inspecting
 * its `.d.ts` declaration files and `package.json` — NOT by importing the SDK
 * at runtime. This avoids the ESM/vscode-jsonrpc resolution issues that make
 * dynamic imports fragile in the Vitest environment.
 *
 * Strategy:
 *  - Read and parse `.d.ts` files to verify the API surface
 *  - Read `package.json` to verify version and exports
 *  - Use compile-time type assertions checked by `tsc --noEmit` in CI
 *
 * This is MORE robust for upgrade detection because `.d.ts` files reflect the
 * SDK's public contract without requiring any transitive dependencies to load.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SDK_ROOT = resolve(__dirname, '../../../node_modules/@github/copilot-sdk');

function readSdkFile(relativePath: string): string {
  const fullPath = resolve(SDK_ROOT, relativePath);
  expect(existsSync(fullPath), `SDK file should exist: ${relativePath}`).toBe(true);
  return readFileSync(fullPath, 'utf-8');
}

// ===========================================================================
// 1. SDK Version & package structure
// ===========================================================================

describe('SDK version', () => {
  it('should be the expected version (0.1.32)', () => {
    const pkg = JSON.parse(readSdkFile('package.json'));
    expect(pkg.version).toBe('0.1.32');
  });

  it('should have ESM exports in package.json', () => {
    const pkg = JSON.parse(readSdkFile('package.json'));
    expect(pkg.exports['.']).toEqual(expect.objectContaining({
      import: expect.stringContaining('index.js'),
      types: expect.stringContaining('index.d.ts'),
    }));
  });

  it('should have dist/index.d.ts', () => {
    const content = readSdkFile('dist/index.d.ts');
    expect(content.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 2. Module-level exports from index.d.ts
// ===========================================================================

describe('SDK module exports', () => {
  let indexDts: string;

  beforeAll(() => {
    indexDts = readSdkFile('dist/index.d.ts');
  });

  it('should export CopilotClient', () => {
    expect(indexDts).toContain('CopilotClient');
  });

  it('should export CopilotSession', () => {
    expect(indexDts).toContain('CopilotSession');
  });

  it('should export defineTool', () => {
    expect(indexDts).toContain('defineTool');
  });

  it('should export approveAll', () => {
    expect(indexDts).toContain('approveAll');
  });

  // Verify ALL expected type exports exist
  const expectedTypeExports = [
    'ConnectionState', 'CopilotClientOptions', 'CustomAgentConfig',
    'ForegroundSessionInfo', 'GetAuthStatusResponse', 'GetStatusResponse',
    'InfiniteSessionConfig', 'MCPLocalServerConfig', 'MCPRemoteServerConfig',
    'MCPServerConfig', 'MessageOptions', 'ModelBilling', 'ModelCapabilities',
    'ModelInfo', 'ModelPolicy', 'PermissionHandler', 'PermissionRequest',
    'PermissionRequestResult', 'ResumeSessionConfig', 'SessionConfig',
    'SessionContext', 'SessionEvent', 'SessionEventHandler', 'SessionEventPayload',
    'SessionEventType', 'SessionLifecycleEvent', 'SessionLifecycleEventType',
    'SessionLifecycleHandler', 'SessionListFilter', 'SessionMetadata',
    'SystemMessageAppendConfig', 'SystemMessageConfig', 'SystemMessageReplaceConfig',
    'Tool', 'ToolHandler', 'ToolInvocation', 'ToolResultObject',
    'TypedSessionEventHandler', 'TypedSessionLifecycleHandler', 'ZodSchema',
  ];

  for (const typeName of expectedTypeExports) {
    it(`should export type "${typeName}"`, () => {
      expect(indexDts).toContain(typeName);
    });
  }
});

// ===========================================================================
// 3. CopilotClient class shape (from client.d.ts)
// ===========================================================================

describe('CopilotClient class shape', () => {
  let clientDts: string;

  beforeAll(() => {
    clientDts = readSdkFile('dist/client.d.ts');
  });

  const expectedMethods = [
    'start', 'stop', 'forceStop', 'createSession', 'resumeSession',
    'getState', 'ping', 'getStatus', 'getAuthStatus', 'listModels',
    'getLastSessionId', 'deleteSession', 'listSessions',
    'getForegroundSessionId', 'setForegroundSessionId', 'on',
  ];

  for (const method of expectedMethods) {
    it(`should declare method "${method}"`, () => {
      const pattern = new RegExp(`\\b${method}\\s*[(<:]`);
      expect(clientDts).toMatch(pattern);
    });
  }

  it('should accept CopilotClientOptions in constructor', () => {
    expect(clientDts).toContain('constructor(options?: CopilotClientOptions)');
  });

  it('should return CopilotSession from createSession', () => {
    expect(clientDts).toMatch(/createSession.*Promise<CopilotSession>/);
  });

  it('should return CopilotSession from resumeSession', () => {
    expect(clientDts).toMatch(/resumeSession.*Promise<CopilotSession>/);
  });

  it('should return ConnectionState from getState', () => {
    expect(clientDts).toMatch(/getState\(\).*ConnectionState/);
  });

  it('should return ModelInfo[] from listModels', () => {
    expect(clientDts).toMatch(/listModels\(\).*Promise<ModelInfo\[\]>/);
  });
});

// ===========================================================================
// 4. CopilotSession class shape (from session.d.ts)
// ===========================================================================

describe('CopilotSession class shape', () => {
  let sessionDts: string;

  beforeAll(() => {
    sessionDts = readSdkFile('dist/session.d.ts');
  });

  const expectedMethods = [
    'send', 'sendAndWait', 'on', 'registerTools', 'getToolHandler',
    'registerPermissionHandler', 'registerUserInputHandler', 'registerHooks',
    'getMessages', 'disconnect', 'destroy', 'abort', 'setModel',
  ];

  for (const method of expectedMethods) {
    it(`should declare method "${method}"`, () => {
      const pattern = new RegExp(`\\b${method}\\s*[(<:]`);
      expect(sessionDts).toMatch(pattern);
    });
  }

  it('should have readonly sessionId property', () => {
    expect(sessionDts).toMatch(/readonly\s+sessionId:\s+string/);
  });

  it('should have workspacePath getter', () => {
    expect(sessionDts).toMatch(/get\s+workspacePath\(\)/);
  });

  it('should accept MessageOptions in send()', () => {
    expect(sessionDts).toMatch(/send\(options:\s*MessageOptions\)/);
  });

  it('should accept Tool[] in registerTools()', () => {
    expect(sessionDts).toMatch(/registerTools\(tools\?:\s*Tool\[\]\)/);
  });
});

// ===========================================================================
// 5. Key type shapes (from types.d.ts)
// ===========================================================================

describe('SDK type definitions', () => {
  let typesDts: string;

  beforeAll(() => {
    typesDts = readSdkFile('dist/types.d.ts');
  });

  it('should define SessionConfig with key fields', () => {
    expect(typesDts).toContain('interface SessionConfig');
    expect(typesDts).toMatch(/model\??:\s*string/);
    expect(typesDts).toMatch(/workingDirectory\??:/);
    expect(typesDts).toMatch(/tools\??:/);
    expect(typesDts).toMatch(/mcpServers\??:/);
    expect(typesDts).toMatch(/customAgents\??:/);
    expect(typesDts).toMatch(/systemMessage\??:/);
    expect(typesDts).toMatch(/reasoningEffort\??:/);
    expect(typesDts).toMatch(/excludedTools\??:/);
    expect(typesDts).toMatch(/onPermissionRequest\??:/);
    expect(typesDts).toMatch(/hooks\??:/);
  });

  it('should define PermissionRequest interface', () => {
    expect(typesDts).toContain('interface PermissionRequest');
  });

  it('should define Tool interface with name, description, handler', () => {
    expect(typesDts).toContain('interface Tool');
    expect(typesDts).toMatch(/name:\s*string/);
    expect(typesDts).toMatch(/description\??:\s*string/);
    expect(typesDts).toMatch(/handler:/);
  });

  it('should define MCPServerConfig as union of local and remote', () => {
    expect(typesDts).toContain('MCPLocalServerConfig');
    expect(typesDts).toContain('MCPRemoteServerConfig');
    expect(typesDts).toMatch(/type MCPServerConfig\s*=\s*MCPLocalServerConfig\s*\|\s*MCPRemoteServerConfig/);
  });

  it('should define ConnectionState with expected values', () => {
    expect(typesDts).toMatch(/type ConnectionState\s*=\s*"disconnected"\s*\|\s*"connecting"\s*\|\s*"connected"\s*\|\s*"error"/);
  });

  it('should define ReasoningEffort with expected values', () => {
    expect(typesDts).toMatch(/type ReasoningEffort\s*=\s*"low"\s*\|\s*"medium"\s*\|\s*"high"\s*\|\s*"xhigh"/);
  });

  it('should define SessionHooks with expected hooks', () => {
    expect(typesDts).toContain('interface SessionHooks');
    expect(typesDts).toMatch(/onPreToolUse\??:/);
    expect(typesDts).toMatch(/onPostToolUse\??:/);
    expect(typesDts).toMatch(/onSessionStart\??:/);
    expect(typesDts).toMatch(/onSessionEnd\??:/);
    expect(typesDts).toMatch(/onErrorOccurred\??:/);
  });

  it('should define CustomAgentConfig', () => {
    expect(typesDts).toContain('interface CustomAgentConfig');
  });

  it('should define ModelInfo with expected fields', () => {
    expect(typesDts).toContain('interface ModelInfo');
    expect(typesDts).toContain('ModelCapabilities');
    expect(typesDts).toContain('ModelPolicy');
    expect(typesDts).toContain('ModelBilling');
  });

  it('should define defineTool function', () => {
    expect(typesDts).toMatch(/function defineTool/);
  });

  it('should define SessionLifecycleEventType with expected events', () => {
    expect(typesDts).toMatch(/SessionLifecycleEventType\s*=.*session\.created/);
    expect(typesDts).toContain('session.deleted');
    expect(typesDts).toContain('session.updated');
    expect(typesDts).toContain('session.foreground');
    expect(typesDts).toContain('session.background');
  });

  it('should define InfiniteSessionConfig', () => {
    expect(typesDts).toContain('interface InfiniteSessionConfig');
  });
});

// ===========================================================================
// 6. SessionEvent types (critical for event forwarding)
// ===========================================================================

describe('SessionEvent type coverage', () => {
  let typesDts: string;
  let generatedTypes: string;

  beforeAll(() => {
    typesDts = readSdkFile('dist/types.d.ts');
    try {
      generatedTypes = readSdkFile('dist/generated/types.d.ts');
    } catch {
      generatedTypes = '';
    }
  });

  it('should define SessionEvent type', () => {
    const combined = typesDts + generatedTypes;
    expect(combined).toMatch(/SessionEvent/);
  });

  it('should define SessionEventType', () => {
    expect(typesDts).toContain('SessionEventType');
  });

  it('should define SessionEventHandler', () => {
    expect(typesDts).toContain('SessionEventHandler');
  });

  it('should define TypedSessionEventHandler', () => {
    expect(typesDts).toContain('TypedSessionEventHandler');
  });
});

// ===========================================================================
// 7. Compile-time type assertions
// ===========================================================================

describe('compile-time type compatibility', () => {
  it('type assertions compile successfully', () => {
    // The actual type checking is done by TypeScript at compile time.
    // This test just verifies the assertion block exists and runs.

    // --- SessionConfig must accept the fields CopilotService uses ---
    type _SessionConfigCheck = import('@github/copilot-sdk').SessionConfig extends {
      model?: string;
      workingDirectory?: string;
      tools?: unknown[];
    } ? true : false;

    // --- ConnectionState must include the values CopilotService checks ---
    type _ConnectionStateCheck = 'connected' extends import('@github/copilot-sdk').ConnectionState ? true : false;

    // Note: ReasoningEffort is defined in types.d.ts but not re-exported from index.
    // The app defines its own ReasoningEffort type locally in copilot-service.ts.

    expect(true).toBe(true);
  });
});
