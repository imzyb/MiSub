import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 线上事故回归：开启 D1 节点持久化后，订阅输出在 main-handler 里调用了
// maybeContinueBackfill 却没有 import，直接抛
// ReferenceError: maybeContinueBackfill is not defined，整站订阅短链 500。
// 这条测试真实执行 handleMisubRequest 的持久化分支，确保不再抛 ReferenceError。

const createAdapter = vi.fn();
const getStorageType = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
    StorageFactory: {
        createAdapter: (...args) => createAdapter(...args),
        getStorageType: (...args) => getStorageType(...args),
        resolveKV: (env) => env?.MISUB_KV || null,
    },
    STORAGE_TYPES: { KV: 'kv', D1: 'd1' },
}));

vi.mock('../../functions/modules/subscription/cache-manager.js', () => ({
    resolveNodeListWithCache: vi.fn(async () => ({
        combinedNodeList: 'trojan://pass@example.com:443#HK',
        cacheHeaders: {},
    })),
}));

function createStorageAdapter({ settings = {}, subscriptions = [], profiles = [] } = {}) {
    const store = new Map([
        ['worker_settings_v1', settings],
        ['misub_subscriptions_v1', subscriptions],
        ['misub_profiles_v1', profiles],
    ]);
    return {
        get: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
        put: vi.fn(async (key, value) => {
            store.set(key, value);
            return true;
        }),
        getAllSubscriptions: vi.fn(async () => subscriptions),
        getAllProfiles: vi.fn(async () => profiles),
    };
}

describe('订阅输出 + D1 节点持久化', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        getStorageType.mockResolvedValue('kv');
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('持久化开启时不应因未定义标识符抛 ReferenceError（订阅短链 500 回归）', async () => {
        const subscriptions = [
            {
                id: 'sub-a',
                name: 'Airport A',
                url: 'https://airport.example/sub',
                enabled: true,
            },
        ];
        const adapter = createStorageAdapter({
            settings: {
                mytoken: 'stable-token',
                storageType: 'd1',
                enableNodePersistence: true,
                enableAccessLog: false,
                enableFlagEmoji: false,
                enableTrafficNode: false,
            },
            subscriptions,
        });
        createAdapter.mockReturnValue(adapter);

        const { handleMisubRequest } =
            await import('../../functions/modules/subscription/main-handler.js');

        let thrown = null;
        let response = null;
        try {
            response = await handleMisubRequest({
                request: new Request('https://misub.example/stable-token?target=nodes&refresh=1', {
                    headers: { 'User-Agent': 'ClashMeta' },
                }),
                env: { MISUB_DB: {} },
                waitUntil: vi.fn(),
            });
        } catch (error) {
            thrown = error;
        }

        // 缺 import 的版本会在这里抛 ReferenceError；修复后应正常返回 200。
        expect(thrown).toBeNull();
        expect(response?.status).toBe(200);
        expect(await response.text()).toContain('trojan://pass@example.com:443#HK');
    });
});
