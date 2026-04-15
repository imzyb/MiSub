import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createAdapter = vi.fn();
const getStorageType = vi.fn();
const resolveKV = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
  StorageFactory: {
    createAdapter: (...args) => createAdapter(...args),
    getStorageType: (...args) => getStorageType(...args),
    resolveKV: (...args) => resolveKV(...args)
  },
  STORAGE_TYPES: {
    KV: 'kv',
    D1: 'd1'
  }
}));

function createMemoryStorage(type) {
  const store = new Map();

  return {
    type,
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
      return true;
    },
    async delete(key) {
      store.delete(key);
      return true;
    }
  };
}

describe('LogService storage selection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T00:00:00Z'));
    vi.resetModules();

    createAdapter.mockReset();
    getStorageType.mockReset();
    resolveKV.mockReset();

    getStorageType.mockResolvedValue('d1');
    resolveKV.mockReturnValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes access logs into D1-backed storage when storageType is d1', async () => {
    const d1Storage = createMemoryStorage('d1');
    const kvStorage = createMemoryStorage('kv');

    createAdapter.mockImplementation((env, type) => (type === 'd1' ? d1Storage : kvStorage));

    const { LogService } = await import('../../functions/services/log-service.js');

    const addLogPromise = LogService.addLog(
      { MISUB_DB: {}, MISUB_KV: {} },
      {
        status: 'success',
        type: 'profile',
        token: 'profile-token',
        format: 'builtin-clash',
        domain: 'sub.example.com',
        summary: '生成 10 个节点 (成功: 10, 失败: 0)'
      }
    );

    await vi.advanceTimersByTimeAsync(500);
    await addLogPromise;

    expect(Array.from(d1Storage.store.keys())).toContain('misub_system_logs:index');
    expect(Array.from(kvStorage.store.keys())).not.toContain('misub_system_logs:index');

    const logs = await LogService.getLogs({ MISUB_DB: {}, MISUB_KV: {} });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      token: 'profile-token',
      format: 'builtin-clash',
      domain: 'sub.example.com'
    });
  });

  it('clears both D1 logs and legacy KV log buckets in d1 mode', async () => {
    const d1Storage = createMemoryStorage('d1');
    const kvStorage = createMemoryStorage('kv');

    d1Storage.store.set('misub_system_logs:index', ['misub_system_logs:2026-04-15']);
    d1Storage.store.set('misub_system_logs:2026-04-15', [{ id: 'd1-log', timestamp: Date.now() }]);

    kvStorage.store.set('misub_system_logs:index', ['misub_system_logs:2026-04-14']);
    kvStorage.store.set('misub_system_logs:2026-04-14', [{ id: 'kv-log', timestamp: Date.now() }]);

    createAdapter.mockImplementation((env, type) => (type === 'd1' ? d1Storage : kvStorage));

    const { LogService } = await import('../../functions/services/log-service.js');

    const result = await LogService.clearLogs({ MISUB_DB: {}, MISUB_KV: {} });

    expect(result).toBe(true);
    expect(d1Storage.store.size).toBe(0);
    expect(kvStorage.store.size).toBe(0);
  });
});
