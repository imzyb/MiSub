import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSubscriptions = vi.fn();
const get = vi.fn();
const putAllSubscriptions = vi.fn();
const createAdapter = vi.fn();
const getStorageType = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
  StorageFactory: {
    createAdapter: (...args) => createAdapter(...args),
    getStorageType: (...args) => getStorageType(...args)
  }
}));

vi.mock('../../functions/services/notification-service.js', () => ({
  sendTgNotification: vi.fn().mockResolvedValue(false),
  sendEnhancedTgNotification: vi.fn().mockResolvedValue(false),
  tgEscape: (value) => value
}));

describe('notifications cron storage helper usage', () => {
  beforeEach(() => {
    getAllSubscriptions.mockReset();
    get.mockReset();
    putAllSubscriptions.mockReset();
    createAdapter.mockReset();
    getStorageType.mockReset();

    getStorageType.mockResolvedValue('d1');
    createAdapter.mockReturnValue({
      type: 'd1',
      getAllSubscriptions,
      get,
      putAllSubscriptions
    });
    get.mockImplementation(async (key) => {
      if (key === 'worker_settings_v1') {
        return {};
      }
      return null;
    });
    putAllSubscriptions.mockResolvedValue(true);

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({
      ok: true,
      headers: {
        get(name) {
          return String(name).toLowerCase() === 'subscription-userinfo'
            ? 'upload=1; download=2; total=10'
            : null;
        }
      },
      async text() {
        return 'ss://node-one\nvmess://node-two';
      }
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handleCronTrigger prefers row-level subscription helpers for D1 storage', async () => {
    const { handleCronTrigger } = await import('../../functions/modules/notifications.js');

    getAllSubscriptions.mockResolvedValue([
      {
        id: 'sub-1',
        name: 'Sub One',
        url: 'https://sub.example.com',
        enabled: true
      }
    ]);

    const response = await handleCronTrigger({});
    const payload = await response.json();

    expect(payload.summary).toMatchObject({
      total: 1,
      updated: 1,
      failed: 0,
      changes: true
    });
    expect(getAllSubscriptions).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('worker_settings_v1');
    expect(get).not.toHaveBeenCalledWith('misub_subscriptions_v1');
    expect(putAllSubscriptions).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'sub-1',
        nodeCount: 2,
        userInfo: {
          upload: 1,
          download: 2,
          total: 10
        }
      })
    ]);
  });
});
