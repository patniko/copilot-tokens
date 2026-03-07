import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

let storeData: Map<string, unknown>;

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private defaults: Record<string, unknown>;
      constructor(opts?: { defaults?: Record<string, unknown> }) {
        this.defaults = opts?.defaults ?? {};
        for (const [k, v] of Object.entries(this.defaults)) {
          if (!storeData.has(k)) storeData.set(k, v);
        }
      }
      get(key: string) { return storeData.has(key) ? storeData.get(key) : undefined; }
      set(key: string, value: unknown) { storeData.set(key, value); }
    },
  };
});

vi.mock('./data-dir', () => ({ DATA_DIR: '/tmp/test-auth' }));

const execFileMock = vi.fn();
vi.mock('node:child_process', () => ({ execFile: execFileMock }));

const netRequestMock = vi.fn();
vi.mock('electron', () => ({ net: { request: netRequestMock } }));

// --- Helpers ---

function createNetRequestMock(responseStatus: number, responseBody: string) {
  const mockResponse = {
    statusCode: responseStatus,
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'data') cb(Buffer.from(responseBody));
      if (event === 'end') cb();
      return mockResponse;
    }),
  };
  const mockReq = {
    setHeader: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'response') setTimeout(() => cb(mockResponse), 0);
      return mockReq;
    }),
    write: vi.fn(),
    end: vi.fn(),
  };
  return { mockReq, mockResponse };
}

function setupNetMock(status: number, body: string) {
  const { mockReq } = createNetRequestMock(status, body);
  netRequestMock.mockReturnValue(mockReq);
  return mockReq;
}

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks();
  storeData = new Map<string, unknown>();
  storeData.set('oauthToken', null);
  storeData.set('oauthUser', null);
  storeData.set('activeSource', 'cli');
});

describe('getCliUser', () => {
  let getCliUser: typeof import('./auth-service').getCliUser;

  beforeEach(async () => {
    ({ getCliUser } = await import('./auth-service'));
  });

  it('returns GitHubUser when gh CLI succeeds', async () => {
    const payload = { login: 'octocat', name: 'Octocat', avatar_url: 'https://example.com/avatar.png', id: 1 };
    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (...args: unknown[]) => void) => {
      cb(null, JSON.stringify(payload));
    });

    const user = await getCliUser();
    expect(user).toEqual({ login: 'octocat', name: 'Octocat', avatarUrl: 'https://example.com/avatar.png', id: 1 });
  });

  it('returns null when gh CLI errors', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (...args: unknown[]) => void) => {
      cb(new Error('gh not found'));
    });

    const user = await getCliUser();
    expect(user).toBeNull();
  });

  it('returns null when gh CLI returns invalid JSON', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (...args: unknown[]) => void) => {
      cb(null, 'not-json');
    });

    const user = await getCliUser();
    expect(user).toBeNull();
  });

  it('maps avatar_url to avatarUrl correctly', async () => {
    const payload = { login: 'testuser', name: null, avatar_url: 'https://avatars.test/u/42', id: 42 };
    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (...args: unknown[]) => void) => {
      cb(null, JSON.stringify(payload));
    });

    const user = await getCliUser();
    expect(user).not.toBeNull();
    expect(user!.avatarUrl).toBe('https://avatars.test/u/42');
    expect(user!.name).toBeNull();
  });
});

describe('Persistence (store operations)', () => {
  let getPersistedOAuthUser: typeof import('./auth-service').getPersistedOAuthUser;
  let getPersistedOAuthToken: typeof import('./auth-service').getPersistedOAuthToken;
  let persistOAuth: typeof import('./auth-service').persistOAuth;
  let clearOAuth: typeof import('./auth-service').clearOAuth;
  let getActiveSource: typeof import('./auth-service').getActiveSource;
  let setActiveSource: typeof import('./auth-service').setActiveSource;

  beforeEach(async () => {
    ({ getPersistedOAuthUser, getPersistedOAuthToken, persistOAuth, clearOAuth, getActiveSource, setActiveSource } =
      await import('./auth-service'));
  });

  it('getPersistedOAuthUser returns null initially', () => {
    expect(getPersistedOAuthUser()).toBeNull();
  });

  it('persistOAuth stores token and user', () => {
    const user = { login: 'octocat', name: 'Octocat', avatarUrl: 'https://example.com/a.png', id: 1 };
    persistOAuth('tok_123', user);

    expect(getPersistedOAuthToken()).toBe('tok_123');
    expect(getPersistedOAuthUser()).toEqual(user);
  });

  it('getPersistedOAuthToken returns stored token', () => {
    persistOAuth('my-token', { login: 'u', name: null, avatarUrl: '', id: 2 });
    expect(getPersistedOAuthToken()).toBe('my-token');
  });

  it('clearOAuth resets token, user, and activeSource to cli', () => {
    const user = { login: 'octocat', name: 'Octocat', avatarUrl: 'https://example.com/a.png', id: 1 };
    persistOAuth('tok_123', user);
    setActiveSource('oauth');

    clearOAuth();

    expect(getPersistedOAuthToken()).toBeNull();
    expect(getPersistedOAuthUser()).toBeNull();
    expect(getActiveSource()).toBe('cli');
  });

  it('getActiveSource returns cli by default', () => {
    expect(getActiveSource()).toBe('cli');
  });

  it('setActiveSource changes the active source', () => {
    setActiveSource('oauth');
    expect(getActiveSource()).toBe('oauth');
  });
});

describe('startDeviceFlow', () => {
  let startDeviceFlow: typeof import('./auth-service').startDeviceFlow;

  beforeEach(async () => {
    ({ startDeviceFlow } = await import('./auth-service'));
  });

  it('returns device code response on success', async () => {
    const deviceResponse = {
      device_code: 'dc_abc',
      user_code: 'ABCD-1234',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    };
    setupNetMock(200, JSON.stringify(deviceResponse));

    const result = await startDeviceFlow();
    expect(result).toEqual(deviceResponse);
  });

  it('throws on non-200 status', async () => {
    setupNetMock(403, '{"error":"forbidden"}');

    await expect(startDeviceFlow()).rejects.toThrow('Device flow request failed: 403');
  });
});

describe('fetchUser', () => {
  let fetchUser: typeof import('./auth-service').fetchUser;

  beforeEach(async () => {
    ({ fetchUser } = await import('./auth-service'));
  });

  it('returns GitHubUser on success', async () => {
    const apiResponse = { login: 'octocat', name: 'Octocat', avatar_url: 'https://example.com/avatar.png', id: 1 };
    setupNetMock(200, JSON.stringify(apiResponse));

    const user = await fetchUser('tok_valid');
    expect(user).toEqual({ login: 'octocat', name: 'Octocat', avatarUrl: 'https://example.com/avatar.png', id: 1 });
  });

  it('throws on non-200 status', async () => {
    setupNetMock(401, '{"message":"Bad credentials"}');

    await expect(fetchUser('tok_invalid')).rejects.toThrow('GitHub API error: 401');
  });

  it('maps response fields correctly', async () => {
    const apiResponse = { login: 'testuser', name: null, avatar_url: 'https://avatars.test/42', id: 42 };
    setupNetMock(200, JSON.stringify(apiResponse));

    const user = await fetchUser('tok_test');
    expect(user.avatarUrl).toBe('https://avatars.test/42');
    expect(user.name).toBeNull();
    expect(user.login).toBe('testuser');
    expect(user.id).toBe(42);
  });
});
