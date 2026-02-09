import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory mock for electron-store
const storeData = new Map<string, unknown>();

vi.mock('electron-store', () => {
  const MockStore = function (opts?: { defaults?: Record<string, unknown> }) {
    if (opts?.defaults) {
      for (const [k, v] of Object.entries(opts.defaults)) {
        if (!storeData.has(k)) storeData.set(k, structuredClone(v));
      }
    }
    return {
      get: (key: string) => structuredClone(storeData.get(key)),
      set: (key: string, val: unknown) => storeData.set(key, structuredClone(val)),
    };
  };
  return { default: MockStore };
});

vi.mock('./data-dir', () => ({
  DATA_DIR: '/tmp/test-data',
}));

describe('PermissionService', () => {
  let service: InstanceType<typeof import('./permission-service').PermissionService>;

  beforeEach(async () => {
    storeData.clear();
    vi.resetModules();
    const mod = await import('./permission-service');
    service = new mod.PermissionService();
  });

  // --- evaluate: URL and MCP always allowed ---

  describe('evaluate - auto-allow kinds', () => {
    it('auto-allows url kind', () => {
      expect(service.evaluate({ kind: 'url' }, '/home')).toBe('allow');
    });

    it('auto-allows mcp kind', () => {
      expect(service.evaluate({ kind: 'mcp' }, '/home')).toBe('allow');
    });
  });

  // --- evaluate: read under CWD ---

  describe('evaluate - read under CWD', () => {
    it('auto-allows read of file under cwd', () => {
      expect(service.evaluate({ kind: 'read', path: '/home/user/project/src/file.ts' }, '/home/user/project')).toBe('allow');
    });

    it('asks for read outside cwd', () => {
      expect(service.evaluate({ kind: 'read', path: '/etc/passwd' }, '/home/user/project')).toBe('ask');
    });

    it('auto-allows read of cwd itself', () => {
      expect(service.evaluate({ kind: 'read', path: '/home/user/project' }, '/home/user/project')).toBe('allow');
    });

    it('asks for read when no cwd provided', () => {
      expect(service.evaluate({ kind: 'read', path: '/home/file.ts' }, '')).toBe('ask');
    });
  });

  // --- evaluate: write (not auto-allowed without rules) ---

  describe('evaluate - write requests', () => {
    it('asks for write under cwd without rule', () => {
      expect(service.evaluate({ kind: 'write', path: '/home/project/file.ts' }, '/home/project')).toBe('ask');
    });

    it('asks for write outside cwd', () => {
      expect(service.evaluate({ kind: 'write', path: '/etc/config' }, '/home/project')).toBe('ask');
    });
  });

  // --- evaluate: shell ---

  describe('evaluate - shell requests', () => {
    it('asks for shell without rules', () => {
      expect(service.evaluate({ kind: 'shell' }, '/home/project')).toBe('ask');
    });
  });

  // --- YOLO mode ---

  describe('evaluate - YOLO mode', () => {
    it('auto-allows shell in yolo mode', () => {
      service.yoloMode = true;
      expect(service.evaluate({ kind: 'shell' }, '/home/project')).toBe('allow');
    });

    it('auto-allows write under cwd in yolo mode', () => {
      service.yoloMode = true;
      expect(service.evaluate({ kind: 'write', path: '/home/project/file.ts' }, '/home/project')).toBe('allow');
    });

    it('still asks for write outside cwd in yolo mode', () => {
      service.yoloMode = true;
      expect(service.evaluate({ kind: 'write', path: '/etc/config' }, '/home/project')).toBe('ask');
    });

    it('auto-allows read under cwd in yolo mode', () => {
      service.yoloMode = true;
      expect(service.evaluate({ kind: 'read', path: '/home/project/src/a.ts' }, '/home/project')).toBe('allow');
    });
  });

  // --- Rules: addRule / getRules / removeRule / clearRules ---

  describe('rules management', () => {
    it('starts with no rules', () => {
      expect(service.getRules()).toEqual([]);
    });

    it('adds a rule', () => {
      service.addRule({ kind: 'write', pathPrefix: '/home/project' });
      expect(service.getRules()).toHaveLength(1);
    });

    it('does not duplicate identical rules', () => {
      service.addRule({ kind: 'write', pathPrefix: '/home/project' });
      service.addRule({ kind: 'write', pathPrefix: '/home/project' });
      expect(service.getRules()).toHaveLength(1);
    });

    it('allows different kinds for same path', () => {
      service.addRule({ kind: 'write', pathPrefix: '/home/project' });
      service.addRule({ kind: 'shell', pathPrefix: '/home/project' });
      expect(service.getRules()).toHaveLength(2);
    });

    it('removes rule by index', () => {
      service.addRule({ kind: 'write', pathPrefix: '/a' });
      service.addRule({ kind: 'write', pathPrefix: '/b' });
      service.removeRule(0);
      const rules = service.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].pathPrefix).toContain('b');
    });

    it('clears all rules', () => {
      service.addRule({ kind: 'write', pathPrefix: '/a' });
      service.addRule({ kind: 'shell', pathPrefix: '/b' });
      service.clearRules();
      expect(service.getRules()).toEqual([]);
    });
  });

  // --- evaluate: persisted rules ---

  describe('evaluate - persisted rules', () => {
    it('allows write when matching rule exists', () => {
      service.addRule({ kind: 'write', pathPrefix: '/home/project' });
      expect(service.evaluate({ kind: 'write', path: '/home/project/src/file.ts' }, '/other')).toBe('allow');
    });

    it('allows shell when cwd is under rule prefix', () => {
      service.addRule({ kind: 'shell', pathPrefix: '/home/project' });
      expect(service.evaluate({ kind: 'shell' }, '/home/project/sub')).toBe('allow');
    });

    it('does not allow shell when cwd is outside rule prefix', () => {
      service.addRule({ kind: 'shell', pathPrefix: '/home/project' });
      expect(service.evaluate({ kind: 'shell' }, '/other/dir')).toBe('ask');
    });

    it('does not cross-match kinds', () => {
      service.addRule({ kind: 'read', pathPrefix: '/home/project' });
      expect(service.evaluate({ kind: 'write', path: '/home/project/file.ts' }, '/other')).toBe('ask');
    });
  });

  // --- extractPath field variants ---

  describe('evaluate - path extraction', () => {
    it('uses fileName field', () => {
      expect(service.evaluate({ kind: 'read', fileName: '/home/project/a.ts' }, '/home/project')).toBe('allow');
    });

    it('uses file field', () => {
      expect(service.evaluate({ kind: 'read', file: '/home/project/b.ts' }, '/home/project')).toBe('allow');
    });

    it('uses filePath field', () => {
      expect(service.evaluate({ kind: 'read', filePath: '/home/project/c.ts' }, '/home/project')).toBe('allow');
    });

    it('asks when no path field at all for read outside auto-allow', () => {
      expect(service.evaluate({ kind: 'write' }, '/home/project')).toBe('ask');
    });
  });
});
