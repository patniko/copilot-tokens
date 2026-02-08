import { execFile } from 'node:child_process';
import { net } from 'electron';
import Store from 'electron-store';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  id: number;
}

export type AuthSource = 'cli' | 'oauth';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AuthStoreSchema {
  oauthToken: string | null;
  oauthUser: GitHubUser | null;
  activeSource: AuthSource;
}

// Placeholder — replace with your registered OAuth App client ID
const OAUTH_CLIENT_ID = 'Iv23ctpsQOCyDp2e7kOD';

const store = new Store<AuthStoreSchema>({
  name: 'auth',
  defaults: {
    oauthToken: null,
    oauthUser: null,
    activeSource: 'cli',
  },
});

/** Fetch the user authenticated via `gh` CLI */
export function getCliUser(): Promise<GitHubUser | null> {
  return new Promise((resolve) => {
    execFile('gh', ['api', 'user'], (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      try {
        const u = JSON.parse(stdout);
        resolve({
          login: u.login,
          name: u.name ?? null,
          avatarUrl: u.avatar_url,
          id: u.id,
        });
      } catch {
        resolve(null);
      }
    });
  });
}

/** Helper to make HTTPS requests using Electron's net module */
function netRequest(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = net.request({
      url,
      method: opts.method ?? 'GET',
    });
    for (const [k, v] of Object.entries(opts.headers ?? {})) {
      req.setHeader(k, v);
    }
    let body = '';
    req.on('response', (response) => {
      response.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/** Start OAuth Device Flow — returns code for user to enter at github.com/login/device */
export async function startDeviceFlow(): Promise<DeviceCodeResponse> {
  const res = await netRequest('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: OAUTH_CLIENT_ID,
      scope: 'read:user',
    }),
  });
  if (res.status !== 200) throw new Error(`Device flow request failed: ${res.status}`);
  return JSON.parse(res.body);
}

/** Poll for the OAuth token after user enters the code */
export async function pollForToken(deviceCode: string, interval: number): Promise<string> {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await delay(interval * 1000);
    const res = await netRequest('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: OAUTH_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = JSON.parse(res.body);
    if (data.access_token) return data.access_token as string;
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') {
      interval = (data.interval as number) ?? interval + 5;
      continue;
    }
    throw new Error(data.error_description ?? data.error ?? 'OAuth polling failed');
  }
}

/** Fetch GitHub user profile with an access token */
export async function fetchUser(token: string): Promise<GitHubUser> {
  const res = await netRequest('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'github-tokens-app',
    },
  });
  if (res.status !== 200) throw new Error(`GitHub API error: ${res.status}`);
  const u = JSON.parse(res.body);
  return { login: u.login, name: u.name ?? null, avatarUrl: u.avatar_url, id: u.id };
}

// ── Persistence helpers ──

export function getPersistedOAuthUser(): GitHubUser | null {
  return store.get('oauthUser');
}

export function getPersistedOAuthToken(): string | null {
  return store.get('oauthToken');
}

export function persistOAuth(token: string, user: GitHubUser): void {
  store.set('oauthToken', token);
  store.set('oauthUser', user);
}

export function clearOAuth(): void {
  store.set('oauthToken', null);
  store.set('oauthUser', null);
  store.set('activeSource', 'cli');
}

export function getActiveSource(): AuthSource {
  return store.get('activeSource');
}

export function setActiveSource(source: AuthSource): void {
  store.set('activeSource', source);
}
