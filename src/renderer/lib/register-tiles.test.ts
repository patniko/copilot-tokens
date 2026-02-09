import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRegisteredTiles, getTileRenderer, unregisterTile } from './tile-registry';

// Mock all tile components to avoid importing React components with complex deps
vi.mock('../components/tiles/WebFetchTile', () => ({ default: () => null }));
vi.mock('../components/tiles/SqlTile', () => ({ default: () => null }));
vi.mock('../components/tiles/MemoryTile', () => ({ default: () => null }));
vi.mock('../components/tiles/SubagentTile', () => ({ default: () => null }));
vi.mock('../components/tiles/SkillTile', () => ({ default: () => null }));
vi.mock('../components/tiles/NativeToolTiles', () => ({
  NotificationTile: () => null,
  ClipboardTile: () => null,
  SystemInfoTile: () => null,
  OpenUrlTile: () => null,
  SoundTile: () => null,
}));

import { registerBuiltinTiles } from './register-tiles';

describe('registerBuiltinTiles', () => {
  beforeEach(() => {
    for (const name of getRegisteredTiles()) {
      unregisterTile(name);
    }
  });

  it('registers all expected built-in tile names', () => {
    registerBuiltinTiles();
    const tiles = getRegisteredTiles();

    const expectedTools = [
      'web_fetch',
      'sql',
      'store_memory',
      'task',
      'skill',
      'desktop_notification',
      'clipboard_read',
      'clipboard_write',
      'system_info',
      'open_url',
      'play_sound',
    ];

    for (const tool of expectedTools) {
      expect(tiles).toContain(tool);
    }
    expect(tiles.length).toBe(expectedTools.length);
  });

  it('every registered tile has a component', () => {
    registerBuiltinTiles();
    for (const name of getRegisteredTiles()) {
      expect(getTileRenderer(name)).toBeDefined();
    }
  });
});
