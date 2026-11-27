import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
    oldSettings: { storageType: 'kv', mytoken: 'auto', profileToken: 'profiles' },
    puts: [],
};

vi.mock('../../functions/storage-adapter.js', () => ({
    STORAGE_TYPES: { KV: 'kv', D1: 'd1' },
    SettingsCache: {
        get: vi.fn(async () => state.oldSettings),
        clear: vi.fn(),
    },
    StorageFactory: {
        getStorageType: vi.fn(async () => state.oldSettings.storageType),
        resolveKV: vi.fn(() => ({})),
        createNodeStore: vi.fn(() => null),
        createAdapter: vi.fn(() => ({
            type: 'd1',
            async get() {
                return state.oldSettings;
            },
            async put(key, value) {
                state.puts.push({ key, value });
                return true;
            },
            async delete() {
                return true;
            },
        })),
    },
}));

vi.mock('../../functions/modules/notifications.js', () => ({
    sendTgNotification: vi.fn(async () => true),
    checkAndNotify: vi.fn(async () => {}),
}));

vi.mock('../../functions/services/node-cache-service.js', () => ({
    clearAllNodeCaches: vi.fn(async () => ({ cleared: 0 })),
}));

vi.mock('../../functions/services/subscription-service.js', () => ({
    buildSubscriptionNodeCacheKey: vi.fn(() => 'cache'),
}));

vi.mock('../../functions/modules/scheduled-task-runner.js', () => ({
    maybeRunScheduledTasks: vi.fn(async () => ({ skipped: true })),
}));

function saveRequest(body) {
    return new Request('https://misub.internal/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('设置保存：节点持久化的可用性校验', () => {
    beforeEach(() => {
        state.puts = [];
        state.oldSettings = { storageType: 'kv', mytoken: 'auto', profileToken: 'profiles' };
        vi.clearAllMocks();
    });

    it('KV → D1 的切换不会被旧值覆盖，并保留持久化设置', async () => {
        const fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy;
        const { handleSettingsSave } = await import('../../functions/modules/api-handler.js');
        const response = await handleSettingsSave(
            saveRequest({ storageType: 'd1', enableNodePersistence: true, autoUpdateInterval: 30 }),
            { MISUB_DB: {} }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.storageType).toBe('d1');
        expect(body.data.enableNodePersistence).toBe(true);
        expect(body.data.autoUpdateInterval).toBe(30);
        // 首次启用持久化不做任何自动拉取
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('未绑定 D1 时强制关闭持久化并把间隔归零', async () => {
        const { handleSettingsSave } = await import('../../functions/modules/api-handler.js');
        const response = await handleSettingsSave(
            saveRequest({ storageType: 'd1', enableNodePersistence: true, autoUpdateInterval: 30 }),
            {}
        );
        const body = await response.json();

        expect(body.data.enableNodePersistence).toBe(false);
        expect(body.data.autoUpdateInterval).toBe(0);
    });

    it('关闭持久化时自动把间隔归零', async () => {
        state.oldSettings = {
            storageType: 'd1',
            mytoken: 'auto',
            enableNodePersistence: true,
            autoUpdateInterval: 30,
        };
        const { handleSettingsSave } = await import('../../functions/modules/api-handler.js');
        const response = await handleSettingsSave(
            saveRequest({ enableNodePersistence: false }),
            { MISUB_DB: {} }
        );
        const body = await response.json();

        expect(body.data.enableNodePersistence).toBe(false);
        expect(body.data.autoUpdateInterval).toBe(0);
    });

    it('客户端伪造的 capabilities 不会被写进设置', async () => {
        const { handleSettingsSave } = await import('../../functions/modules/api-handler.js');
        await handleSettingsSave(
            saveRequest({ capabilities: { enabled: true }, mytoken: 'auto' }),
            { MISUB_DB: {} }
        );

        const written = state.puts[0]?.value || {};
        expect(written.capabilities).toBeUndefined();
    });
});
