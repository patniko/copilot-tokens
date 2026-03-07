import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import Store from 'electron-store';
import { DATA_DIR } from './data-dir';

// ── Types ──

export type ProfileConnection =
  | { type: 'copilot-cli'; cliMode: 'bundled' | 'installed' }
  | { type: 'copilot-remote'; url: string }
  | { type: 'anthropic'; apiKey: string }
  | { type: 'openai'; apiKey: string; baseUrl?: string }
  | { type: 'azure'; apiKey: string; baseUrl: string; apiVersion?: string }
  | { type: 'custom'; baseUrl: string; apiKey?: string; bearerToken?: string };

export interface ConnectionProfile {
  id: string;
  name: string;
  icon: string;
  connection: ProfileConnection;
  authSource?: 'cli' | 'oauth';
  oauthToken?: string;
  model?: string;
  excludedTools?: string[];
  skillDirectories?: string[];
  disabledSkills?: string[];
  isDefault?: boolean;
}

/** Serialised form — API keys stored as base64-encrypted blobs. */
interface StoredProfile extends Omit<ConnectionProfile, 'connection' | 'oauthToken'> {
  connection: Record<string, unknown>;
  oauthToken?: string; // encrypted
}

interface ProfileStoreSchema {
  profiles: StoredProfile[];
  activeProfileId: string | null;
}

// ── Encryption helpers ──

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return value;
  return safeStorage.encryptString(value).toString('base64');
}

function decrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return value;
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return value; // fallback if decryption fails (e.g. migrated data)
  }
}

const SECRET_KEYS = ['apiKey', 'bearerToken', 'oauthToken'] as const;

function encryptConnection(conn: ProfileConnection): Record<string, unknown> {
  const raw = { ...conn } as Record<string, unknown>;
  for (const key of SECRET_KEYS) {
    if (typeof raw[key] === 'string' && raw[key]) {
      raw[key] = encrypt(raw[key] as string);
    }
  }
  return raw;
}

function decryptConnection(raw: Record<string, unknown>): ProfileConnection {
  const conn = { ...raw } as Record<string, unknown>;
  for (const key of SECRET_KEYS) {
    if (typeof conn[key] === 'string' && conn[key]) {
      conn[key] = decrypt(conn[key] as string);
    }
  }
  return conn as unknown as ProfileConnection;
}

// ── Store ──

const DEFAULT_PROFILE: ConnectionProfile = {
  id: 'default',
  name: 'GitHub Copilot',
  icon: '🐙',
  connection: { type: 'copilot-cli', cliMode: 'bundled' },
  authSource: 'cli',
  isDefault: true,
};

const store = new Store<ProfileStoreSchema>({
  name: 'profiles',
  cwd: DATA_DIR,
  defaults: {
    profiles: [],
    activeProfileId: null,
  },
});

// ── Serialisation ──

function toStored(profile: ConnectionProfile): StoredProfile {
  const { connection, oauthToken, ...rest } = profile;
  const stored: StoredProfile = {
    ...rest,
    connection: encryptConnection(connection),
  };
  if (oauthToken) stored.oauthToken = encrypt(oauthToken);
  return stored;
}

function fromStored(stored: StoredProfile): ConnectionProfile {
  const { connection, oauthToken, ...rest } = stored;
  const profile: ConnectionProfile = {
    ...rest,
    connection: decryptConnection(connection),
  };
  if (oauthToken) profile.oauthToken = decrypt(oauthToken);
  return profile;
}

// ── CRUD ──

export function listProfiles(): ConnectionProfile[] {
  const stored = store.get('profiles');
  const profiles = stored.map(fromStored);
  // Always ensure the default profile exists
  if (!profiles.some(p => p.id === 'default')) {
    profiles.unshift(DEFAULT_PROFILE);
  }
  return profiles;
}

export function getProfile(id: string): ConnectionProfile | undefined {
  return listProfiles().find(p => p.id === id);
}

export function saveProfile(profile: ConnectionProfile): void {
  const stored = store.get('profiles');
  const idx = stored.findIndex(p => p.id === profile.id);
  const entry = toStored(profile);
  if (idx >= 0) {
    stored[idx] = entry;
  } else {
    stored.push(entry);
  }
  store.set('profiles', stored);
}

export function deleteProfile(id: string): void {
  if (id === 'default') return; // can't delete the default profile
  const stored = store.get('profiles').filter(p => p.id !== id);
  store.set('profiles', stored);
  // If deleting the active profile, reset to default
  if (getActiveProfileId() === id) {
    setActiveProfileId('default');
  }
}

export function getActiveProfileId(): string {
  return store.get('activeProfileId') ?? 'default';
}

export function setActiveProfileId(id: string): void {
  store.set('activeProfileId', id);
}

export function getActiveProfile(): ConnectionProfile {
  const id = getActiveProfileId();
  return getProfile(id) ?? DEFAULT_PROFILE;
}

/** Create a new profile with a generated ID. */
export function createProfile(data: Omit<ConnectionProfile, 'id'>): ConnectionProfile {
  const profile: ConnectionProfile = { ...data, id: randomUUID() };
  saveProfile(profile);
  return profile;
}
