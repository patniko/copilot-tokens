/**
 * Shared Electron module mocks for main-process tests.
 */
import { vi } from 'vitest';

export function createMockBrowserWindow() {
  return {
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
    },
    on: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
  };
}

export function createMockIpcMain() {
  const handlers = new Map<string, Function>();
  return {
    handle: vi.fn((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    }),
    on: vi.fn((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
    _handlers: handlers,
    _invoke: async (channel: string, ...args: unknown[]) => {
      const handler = handlers.get(channel);
      if (!handler) throw new Error(`No handler for channel: ${channel}`);
      return handler({ sender: { send: vi.fn() } }, ...args);
    },
  };
}

export function createMockDialog() {
  return {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/mock/path'] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/mock/save' }),
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  };
}

export function createMockShell() {
  return {
    openExternal: vi.fn().mockResolvedValue(undefined),
    openPath: vi.fn().mockResolvedValue(''),
  };
}

export function createMockClipboard() {
  let text = '';
  return {
    readText: vi.fn(() => text),
    writeText: vi.fn((t: string) => { text = t; }),
  };
}

export function createMockApp() {
  return {
    getPath: vi.fn((name: string) => `/mock/${name}`),
    getAppPath: vi.fn(() => '/mock/app'),
    isPackaged: false,
    getName: vi.fn(() => 'github-tokens'),
    getVersion: vi.fn(() => '1.0.0'),
    quit: vi.fn(),
    on: vi.fn(),
  };
}

export function createMockNotification() {
  return vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    on: vi.fn(),
  }));
}
