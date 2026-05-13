import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createAdapter = vi.fn();
const getStorageType = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
    StorageFactory: {
        createAdapter: (...args) => createAdapter(...args),
        getStorageType: (...args) => getStorageType(...args),
        resolveKV: () => null
    }
}));

function createStorageAdapter({ settings = {}, subscriptions = [], profiles = [] } = {}) {
    const store = new Map([
        ['worker_settings_v1', settings],
        ['misub_subscriptions_v1', subscriptions],
        ['misub_profiles_v1', profiles]
    ]);

    return {
        store,
        get: vi.fn(async (key) => store.has(key) ? store.get(key) : null),
        put: vi.fn(async (key, value) => {
            store.set(key, value);
            return true;
        }),
        getAllSubscriptions: vi.fn(async () => subscriptions),
        getAllProfiles: vi.fn(async () => profiles),
        getSubscriptionsByIds: vi.fn(async (ids) => subscriptions.filter(item => ids.includes(item.id)))
    };
}

describe('handleMisubRequest regression coverage', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        getStorageType.mockResolvedValue('kv');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('uses the real storage adapter for per-subscription protective node cache', async () => {
        const subscriptions = [{
            id: 'sub-a',
            name: '机场A',
            url: 'https://airport.example/sub',
            enabled: true,
            enableNodeCache: true
        }];
        const adapter = createStorageAdapter({
            settings: { mytoken: 'stable-token', enableFlagEmoji: false, enableTrafficNode: false },
            subscriptions
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 })));

        const { handleMisubRequest } = await import('../../functions/modules/subscription/main-handler.js');
        const response = await handleMisubRequest({
            request: new Request('https://misub.example/stable-token?target=nodes&refresh=1', {
                headers: { 'User-Agent': 'ClashMeta' }
            }),
            env: {},
            waitUntil: vi.fn()
        });
        const text = await response.text();

        expect(response.status).toBe(200);
        expect(text).toContain('trojan://pass@example.com:443#');
        expect(adapter.put).toHaveBeenCalledWith(
            'node_cache_subscription_sub-a',
            expect.objectContaining({
                nodes: ['trojan://pass@example.com:443#HK'],
                nodeCount: 1
            })
        );
    });

    it('keeps external converter data-source requests in nodes format instead of UA fallback format', async () => {
        const subscriptions = [{
            id: 'sub-a',
            name: '机场A',
            url: 'https://airport.example/sub',
            enabled: true
        }];
        const adapter = createStorageAdapter({
            settings: {
                mytoken: 'stable-token',
                enableFlagEmoji: false,
                enableTrafficNode: false,
                subconverter: { engineMode: 'external', defaultBackend: 'https://sub.example/sub?' }
            },
            subscriptions
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 })));

        const { handleMisubRequest } = await import('../../functions/modules/subscription/main-handler.js');
        const initialResponse = await handleMisubRequest({
            request: new Request('https://misub.example/stable-token?target=clash&refresh=1', {
                headers: { 'User-Agent': 'ClashMeta' }
            }),
            env: {},
            waitUntil: vi.fn()
        });
        const redirectUrl = new URL(initialResponse.headers.get('Location'));
        const dataSourceUrl = redirectUrl.searchParams.get('url');

        expect(initialResponse.status).toBe(302);
        expect(dataSourceUrl).toContain('target=nodes');

        const dataSourceResponse = await handleMisubRequest({
            request: new Request(dataSourceUrl, { headers: { 'User-Agent': 'subconverter/v0.9' } }),
            env: {},
            waitUntil: vi.fn()
        });
        const dataSourceText = await dataSourceResponse.text();

        expect(dataSourceResponse.status).toBe(200);
        expect(dataSourceResponse.headers.get('X-MiSub-Mode')).toBe('node-export-plain');
        expect(dataSourceText).toContain('trojan://pass@example.com:443#');
        expect(dataSourceText).not.toMatch(/^[A-Za-z0-9+/=]+$/);
    });
});
