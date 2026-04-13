import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  migrateProfileIds: vi.fn().mockReturnValue(false)
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
  clearAllNodeCaches: vi.fn().mockResolvedValue({ cleared: 0 })
}));

describe('api-handler storage helper usage', () => {
  beforeEach(() => {
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

    getStorageType.mockResolvedValue('d1');
    settingsCacheGet.mockResolvedValue({});
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
    expect(putSubscription).toHaveBeenCalledWith({ id: 'sub-new', name: 'Sub New', url: 'https://new.example.com' });
    expect(deleteSubscriptionById).toHaveBeenCalledWith('sub-legacy');
    expect(putProfile).toHaveBeenCalledWith({
      id: 'profile-new',
      name: 'Profile New',
      subscriptions: [],
      manualNodes: [],
      enabled: true,
      isPublic: false,
      downloadCount: 0
    });
    expect(deleteProfileById).toHaveBeenCalledWith('profile-legacy');
    expect(put).not.toHaveBeenCalledWith('misub_subscriptions_v1', expect.anything());
    expect(put).not.toHaveBeenCalledWith('misub_profiles_v1', expect.anything());
  });
});
