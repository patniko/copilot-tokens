/**
 * Shared in-memory electron-store mock for tests.
 * Usage:
 *   const { storeData, mockElectronStore } = createStoreMock();
 *   vi.mock('electron-store', () => ({ default: mockElectronStore }));
 */
export function createStoreMock() {
  const storeData = new Map<string, unknown>();

  const mockElectronStore = function (opts?: { name?: string; cwd?: string; defaults?: Record<string, unknown> }) {
    if (opts?.defaults) {
      for (const [k, v] of Object.entries(opts.defaults)) {
        if (!storeData.has(k)) storeData.set(k, structuredClone(v));
      }
    }
    return {
      get: (key: string) => structuredClone(storeData.get(key)),
      set: (key: string, val: unknown) => storeData.set(key, structuredClone(val)),
      delete: (key: string) => storeData.delete(key),
      clear: () => storeData.clear(),
      has: (key: string) => storeData.has(key),
    };
  };

  return { storeData, mockElectronStore };
}

export function resetStoreData(storeData: Map<string, unknown>) {
  storeData.clear();
}
