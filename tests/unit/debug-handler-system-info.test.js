import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSubscriptions = vi.fn();
const getAllProfiles = vi.fn();
const get = vi.fn();
const createAdapter = vi.fn();
const getStorageType = vi.fn();
const hasDualStorage = vi.fn();
const resolveKV = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
  StorageFactory: {
    createAdapter: (...args) => createAdapter(...args),
    getStorageType: (...args) => getStorageType(...args),
    hasDualStorage: (...args) => hasDualStorage(...args),
    resolveKV: (...args) => resolveKV(...args)
  }
}));

vi.mock('../../functions/modules/utils.js', () => ({
  createJsonResponse: (data, status = 200) => new Response(JSON.stringify(data), { status }),
  createErrorResponse: (data, status = 500) => new Response(JSON.stringify({ error: String(data) }), { status })
}));

vi.mock('../../functions/modules/subscription-handler.js', () => ({
  handleSubscriptionNodesRequest: vi.fn()
}));

vi.mock('../../functions/services/notification-service.js', () => ({
  debugTgNotification: vi.fn()
}));

vi.mock('../../functions/modules/utils/node-parser.js', () => ({
  parseNodeList: vi.fn(),
  calculateProtocolStats: vi.fn(),
  calculateRegionStats: vi.fn()
}));

describe('handleSystemInfoRequest', () => {
  beforeEach(() => {
    getAllSubscriptions.mockReset();
    getAllProfiles.mockReset();
    get.mockReset();
    createAdapter.mockReset();
    getStorageType.mockReset();
    hasDualStorage.mockReset();
    resolveKV.mockReset();

    getStorageType.mockResolvedValue('d1');
    hasDualStorage.mockReturnValue(true);
    resolveKV.mockReturnValue({});
    createAdapter.mockReturnValue({
      getAllSubscriptions,
      getAllProfiles,
      get
    });
    get.mockResolvedValue([]);
  });

  it('uses row-level helper APIs for D1-backed statistics', async () => {
    const { handleSystemInfoRequest } = await import('../../functions/modules/handlers/debug-handler.js');

    getAllSubscriptions.mockResolvedValue([
      { id: 'sub-1', enabled: true },
      { id: 'sub-2', enabled: false }
    ]);
    getAllProfiles.mockResolvedValue([
      { id: 'profile-1', enabled: true },
      { id: 'profile-2', enabled: false },
      { id: 'profile-3', enabled: true }
    ]);

    const response = await handleSystemInfoRequest(
      { method: 'GET' },
      { MISUB_DB: {}, MISUB_KV: {}, ADMIN_PASSWORD: 'x', COOKIE_SECRET: 'y' }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getAllSubscriptions).toHaveBeenCalled();
    expect(getAllProfiles).toHaveBeenCalled();
    expect(payload.systemInfo.statistics.subscriptions).toEqual({
      total: 2,
      active: 1,
      inactive: 1
    });
    expect(payload.systemInfo.statistics.profiles).toEqual({
      total: 3,
      active: 2,
      inactive: 1
    });
  });
});
