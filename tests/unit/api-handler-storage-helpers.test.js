import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getAllSubscriptions = vi.fn();
const getAllProfiles = vi.fn();
const get = vi.fn();
const put = vi.fn();
const putSubscription = vi.fn();
const putProfile = vi.fn();
const deleteSubscriptionById = vi.fn();
const deleteProfileById = vi.fn();
const createAdapter = vi.fn();
const getStorageType = vi.fn();
const settingsCacheGet = vi.fn();
const clearAllNodeCaches = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
  StorageFactory: {
    createAdapter: (...args) => createAdapter(...args),
    getStorageType: (...args) => getStorageType(...args),
    resolveKV: () => ({})
  },
  SettingsCache: {
    get: (...args) => settingsCacheGet(...args),
    clear: vi.fn()
  },
  STORAGE_TYPES: {
    KV: 'kv',
    D1: 'd1'
  }
}));

vi.mock('../../functions/modules/utils.js', () => ({
  getCookieSecret: vi.fn(),
  getAdminPassword: vi.fn(),
  setAdminPassword: vi.fn(),
  isUsingDefaultPassword: vi.fn().mockResolvedValue(false),
  createJsonResponse: (data, status = 200) => new Response(JSON.stringify(data), { status }),
  createErrorResponse: (data, status = 500) => new Response(JSON.stringify({ error: String(data) }), { status }),
  migrateProfileIds: vi.fn().mockReturnValue(false),
  JSON_BODY_LIMITS: { auth: 16 * 1024, small: 128 * 1024, normal: 1024 * 1024, large: 5 * 1024 * 1024 },
  readJsonWithLimit: async request => request.json()
}));

vi.mock('../../functions/modules/auth-middleware.js', () => ({
  authMiddleware: vi.fn(),
  handleLogin: vi.fn(),
  handleLogout: vi.fn(),
  createUnauthorizedResponse: vi.fn()
}));

vi.mock('../../functions/modules/notifications.js', () => ({
  sendTgNotification: vi.fn(),
  checkAndNotify: vi.fn().mockResolvedValue(null)
}));

vi.mock('../../functions/services/node-cache-service.js', () => ({
  clearAllNodeCaches: (...args) => clearAllNodeCaches(...args)
}));

describe('api-handler storage helper usage', () => {
  let infoSpy;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    getAllSubscriptions.mockReset();
    getAllProfiles.mockReset();
    get.mockReset();
    put.mockReset();
    putSubscription.mockReset();
    putProfile.mockReset();
    deleteSubscriptionById.mockReset();
    deleteProfileById.mockReset();
    createAdapter.mockReset();
    getStorageType.mockReset();
    settingsCacheGet.mockReset();
    clearAllNodeCaches.mockReset();

    getStorageType.mockResolvedValue('d1');
    settingsCacheGet.mockResolvedValue({});
    clearAllNodeCaches.mockResolvedValue({ cleared: 0, failed: 0, skipped: 0 });
    createAdapter.mockReturnValue({
      getAllSubscriptions,
      getAllProfiles,
      get,
      put,
      putSubscription,
      putProfile,
      deleteSubscriptionById,
      deleteProfileById
    });
    get.mockResolvedValue(null);
    putSubscription.mockResolvedValue(true);
    putProfile.mockResolvedValue(true);
    deleteSubscriptionById.mockResolvedValue(true);
    deleteProfileById.mockResolvedValue(true);
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('handleDataRequest prefers getAll helper APIs', async () => {
    const { handleDataRequest } = await import('../../functions/modules/api-handler.js');

    getAllSubscriptions.mockResolvedValue([{ id: 'sub-1', name: 'Sub One' }]);
    getAllProfiles.mockResolvedValue([{ id: 'profile-1', name: 'Profile One' }]);

    const response = await handleDataRequest({ MISUB_DB: {} });
    const payload = await response.json();

    expect(getAllSubscriptions).toHaveBeenCalled();
    expect(getAllProfiles).toHaveBeenCalled();
    expect(payload.misubs).toHaveLength(1);
    expect(payload.profiles).toHaveLength(1);
  });

  it('handleMisubsSave diff mode reads current data through getAll helper APIs', async () => {
    const { handleMisubsSave } = await import('../../functions/modules/api-handler.js');

    getAllSubscriptions.mockResolvedValue([{ id: 'sub-1', name: 'Sub One', url: 'https://a.example.com' }]);
    getAllProfiles.mockResolvedValue([{ id: 'profile-1', name: 'Profile One', subscriptions: [], manualNodes: [] }]);
    get.mockResolvedValue({});
    put.mockResolvedValue(true);

    const request = {
      async json() {
        return {
          diff: {
            subscriptions: [],
            profiles: []
          }
        };
      }
    };

    const response = await handleMisubsSave(request, { MISUB_DB: {} });

    expect(response.status).toBe(200);
    expect(getAllSubscriptions).toHaveBeenCalled();
    expect(getAllProfiles).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith('[API] Processing Diff Patch...');
    expect(infoSpy).toHaveBeenCalledWith('[API] Cleared 0 node caches after subscription update, preserved 0');
  });

  it('handleMisubsSave preserves protective caches only for subscriptions with node cache enabled', async () => {
    const { handleMisubsSave } = await import('../../functions/modules/api-handler.js');

    getAllSubscriptions.mockResolvedValue([]);
    getAllProfiles.mockResolvedValue([]);
    get.mockResolvedValue({});
    put.mockResolvedValue(true);

    const request = {
      async json() {
        return {
          misubs: [
            { id: 'sub-enabled', name: 'Enabled', url: 'https://a.example.com', enableNodeCache: true },
            { id: 'sub-disabled', name: 'Disabled', url: 'https://b.example.com', enableNodeCache: false }
          ],
          profiles: []
        };
      }
    };

    const response = await handleMisubsSave(request, { MISUB_DB: {} });

    expect(response.status).toBe(200);
    expect(clearAllNodeCaches).toHaveBeenCalledWith(
      expect.any(Object),
      { preserveKeys: ['node_cache_subscription_sub-enabled'] }
    );
    expect(infoSpy).toHaveBeenCalledWith('[API] Cleared 0 node caches after subscription update, preserved 0');
  });

  it('handleMisubsSave uses row-level helpers for simple diffs', async () => {
    const { handleMisubsSave } = await import('../../functions/modules/api-handler.js');

    get.mockResolvedValue({});
    const request = {
      async json() {
        return {
          diff: {
            subscriptions: {
              added: [{ id: 'sub-1', name: 'Sub One', url: 'https://a.example.com' }],
              updated: [{ id: 'sub-2', name: 'Sub Two', url: 'https://b.example.com' }],
              removed: ['sub-3']
            },
            profiles: {
              added: [{ id: 'profile-1', name: 'Profile One', subscriptions: [], manualNodes: [] }],
              updated: [],
              removed: ['profile-2']
            }
          }
        };
      }
    };

    const response = await handleMisubsSave(request, { MISUB_DB: {} });

    expect(response.status).toBe(200);
    expect(putSubscription).toHaveBeenCalledTimes(2);
    expect(deleteSubscriptionById).toHaveBeenCalledWith('sub-3');
    expect(putProfile).toHaveBeenCalledTimes(1);
    expect(deleteProfileById).toHaveBeenCalledWith('profile-2');
    expect(put).not.toHaveBeenCalledWith('misub_subscriptions_v1', expect.anything());
    expect(put).not.toHaveBeenCalledWith('misub_profiles_v1', expect.anything());
    expect(infoSpy).toHaveBeenCalledWith('[API] Processing Diff Patch...');
    expect(infoSpy).toHaveBeenCalledWith('[API] Cleared 0 node caches after subscription update, preserved 0');
  });

  it('handleMisubsSave full save uses row-level sync when helper APIs are available', async () => {
    const { handleMisubsSave } = await import('../../functions/modules/api-handler.js');

    getAllSubscriptions.mockResolvedValue([{ id: 'sub-legacy', name: 'Legacy', url: 'https://old.example.com' }]);
    getAllProfiles.mockResolvedValue([{ id: 'profile-legacy', name: 'Legacy Profile', subscriptions: [], manualNodes: [] }]);
    get.mockResolvedValue({});

    const request = {
      async json() {
        return {
          misubs: [{ id: 'sub-new', name: 'Sub New', url: 'https://new.example.com' }],
          profiles: [{ id: 'profile-new', name: 'Profile New', subscriptions: [], manualNodes: [] }]
        };
      }
    };

    const response = await handleMisubsSave(request, { MISUB_DB: {} });

    expect(response.status).toBe(200);
    expect(putSubscription).toHaveBeenCalledWith({
      id: 'sub-new',
      name: 'Sub New',
      url: 'https://new.example.com',
      sortIndex: 0,
    });
    expect(deleteSubscriptionById).toHaveBeenCalledWith('sub-legacy');
    expect(putProfile).toHaveBeenCalledWith({
      id: 'profile-new',
      name: 'Profile New',
      subscriptions: [],
      manualNodes: [],
      enabled: true,
      isPublic: false,
      downloadCount: 0,
      sortIndex: 0,
    });
    expect(deleteProfileById).toHaveBeenCalledWith('profile-legacy');
    expect(put).not.toHaveBeenCalledWith('misub_subscriptions_v1', expect.anything());
    expect(put).not.toHaveBeenCalledWith('misub_profiles_v1', expect.anything());
    expect(infoSpy).toHaveBeenCalledWith('[API] Cleared 0 node caches after subscription update, preserved 0');
  });
});
