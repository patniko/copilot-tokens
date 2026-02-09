import { describe, it, expect, vi } from 'vitest';

// Mock electron-store before importing the module
vi.mock('electron-store', () => {
  const MockStore = function () {
    return { get: vi.fn(), set: vi.fn() };
  };
  return { default: MockStore };
});

vi.mock('./data-dir', () => ({
  DATA_DIR: '/tmp/test-data',
}));

describe('stats-service', () => {
  it('can be imported', async () => {
    const mod = await import('./stats-service');
    expect(mod).toBeDefined();
  });
});
