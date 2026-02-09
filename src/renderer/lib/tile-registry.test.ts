import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTile,
  unregisterTile,
  getTileRenderer,
  getRegisteredTiles,
} from './tile-registry';

// Minimal mock components
const FakeComponentA = () => null;
const FakeComponentB = () => null;

describe('tile-registry', () => {
  beforeEach(() => {
    // Clean slate: unregister any tiles we register
    for (const name of getRegisteredTiles()) {
      unregisterTile(name);
    }
  });

  describe('registerTile / getTileRenderer', () => {
    it('registers and retrieves a tile component', () => {
      registerTile('my_tool', FakeComponentA as any);
      expect(getTileRenderer('my_tool')).toBe(FakeComponentA);
    });

    it('returns undefined for unregistered tool names', () => {
      expect(getTileRenderer('unknown_tool')).toBeUndefined();
    });

    it('overwrites a previously registered tile', () => {
      registerTile('my_tool', FakeComponentA as any);
      registerTile('my_tool', FakeComponentB as any);
      expect(getTileRenderer('my_tool')).toBe(FakeComponentB);
    });
  });

  describe('unregisterTile', () => {
    it('removes a registered tile', () => {
      registerTile('my_tool', FakeComponentA as any);
      unregisterTile('my_tool');
      expect(getTileRenderer('my_tool')).toBeUndefined();
    });

    it('is a no-op for non-existent tiles', () => {
      expect(() => unregisterTile('nonexistent')).not.toThrow();
    });
  });

  describe('getRegisteredTiles', () => {
    it('returns empty array when no tiles registered', () => {
      expect(getRegisteredTiles()).toEqual([]);
    });

    it('returns all registered tile names', () => {
      registerTile('tool_a', FakeComponentA as any);
      registerTile('tool_b', FakeComponentB as any);
      const names = getRegisteredTiles();
      expect(names).toContain('tool_a');
      expect(names).toContain('tool_b');
      expect(names.length).toBe(2);
    });
  });
});
