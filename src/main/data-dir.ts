import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

/** All persistent app data goes here so it survives reinstalls. */
export const DATA_DIR = path.join(os.homedir(), '.copilot', 'tokens-app');

// Ensure directory exists on import
fs.mkdirSync(DATA_DIR, { recursive: true });
