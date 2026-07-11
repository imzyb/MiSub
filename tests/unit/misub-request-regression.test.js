import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createAdapter = vi.fn();
const getStorageType = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
    StorageFactory: {
        createAdapter: (...args) => createAdapter(...args),
        getStorageType: (...args) => getStorageType(...args),
        resolveKV: (env) => env?.MISUB_KV || null
    },
    STORAGE_TYPES: { KV: 'kv', D1: 'd1' }
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

function silenceExpectedRequestLogs() {
    return vi.spyOn(console, 'log').mockImplementation(() => {});
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
            name: '鏈哄満A',
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

        const logSpy = silenceExpectedRequestLogs();
        try {
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
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[MiSub Request]'));
            expect(logSpy).toHaveBeenCalledWith('[MiSub UA] ClashMeta');
            expect(logSpy).toHaveBeenCalledWith('[MiSub Nodes] Count/Length: 68');
            expect(adapter.put).toHaveBeenCalledWith(
                'node_cache_subscription_sub-a',
                expect.objectContaining({
                    nodes: ['trojan://pass@example.com:443#HK'],
                    nodeCount: 1
                })
            );
        } finally {
            logSpy.mockRestore();
        }
    });

    it('normalizes external converter hosts and forwards the Base64 subscription URL', async () => {
        const subscriptions = [{
            id: 'sub-a',
            name: '鏈哄満A',
            url: 'https://airport.example/sub',
            enabled: true
        }];
        const adapter = createStorageAdapter({
            settings: {
                mytoken: 'stable-token',
                enableFlagEmoji: false,
                enableTrafficNode: false,
                subconverter: { engineMode: 'external', defaultBackend: 'sub.example' }
            },
            subscriptions
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 })));

        const logSpy = silenceExpectedRequestLogs();
        try {
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
            expect(redirectUrl.origin + redirectUrl.pathname).toBe('https://sub.example/sub');
            expect(redirectUrl.searchParams.get('target')).toBe('clash');
            expect(dataSourceUrl).toBe('https://misub.example/stable-token?base64');
            expect(redirectUrl.toString()).toContain('url=https%3A%2F%2Fmisub.example%2Fstable-token%3Fbase64');

            const base64Response = await handleMisubRequest({
                request: new Request(dataSourceUrl, {
                    headers: { 'User-Agent': 'ClashMeta' }
                }),
                env: {},
                waitUntil: vi.fn()
            });
            expect(base64Response.status).toBe(200);
            expect(atob(await base64Response.text())).toContain('trojan://pass@example.com:443#');
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[MiSub Request]'));
            expect(logSpy).toHaveBeenCalledWith('[MiSub Nodes] Count/Length: 68');
        } finally {
            logSpy.mockRestore();
        }
    });

    it('uses the Base64 subscription URL for large node sets without a callback secret', async () => {
        const subscriptions = [{
            id: 'sub-a',
            name: 'Airport A',
            url: 'https://airport.example/sub',
            enabled: true
        }];
        const adapter = createStorageAdapter({
            settings: {
                mytoken: 'stable-token',
                enableFlagEmoji: false,
                enableTrafficNode: false,
                subconverter: { engineMode: 'external', defaultBackend: 'sub.example' }
            },
            subscriptions
        });
        createAdapter.mockReturnValue(adapter);
        const bigNodeList = Array.from({ length: 90 }, (_, index) => `trojan://pass${index}@example.com:443#HK-${index}`).join('\n');
        vi.stubGlobal('fetch', vi.fn(async () => new Response(bigNodeList, { status: 200 })));

        const logSpy = silenceExpectedRequestLogs();
        try {
            const { handleMisubRequest } = await import('../../functions/modules/subscription/main-handler.js');
            const response = await handleMisubRequest({
                request: new Request('https://misub.example/stable-token?target=clash&refresh=1', {
                    headers: { 'User-Agent': 'ClashMeta' }
                }),
                env: {},
                waitUntil: vi.fn()
            });
            const redirectUrl = new URL(response.headers.get('Location'));
            const dataSourceUrl = redirectUrl.searchParams.get('url');

            expect(response.status).toBe(302);
            expect(redirectUrl.origin + redirectUrl.pathname).toBe('https://sub.example/sub');
            expect(redirectUrl.searchParams.get('target')).toBe('clash');
            expect(dataSourceUrl).toBe('https://misub.example/stable-token?base64');
            expect(redirectUrl.toString()).not.toContain('trojan%3A%2F%2Fpass0');
            expect(redirectUrl.toString().length).toBeLessThan(2000);
            expect(response.headers.get('X-MiSub-Mode')).toBe('external-redirect-v2');
        } finally {
            logSpy.mockRestore();
        }
    });

    it.each([
        ['bare default backend', 'subapi.cmliussss.net', 'https://subapi.cmliussss.net/sub'],
        ['legacy default backend URL', 'https://subapi.cmliussss.net/sub?', 'https://subapi.cmliussss.net/sub'],
        ['FatSheep backend host', 'api.v1.mk', 'https://api.v1.mk/sub'],
        ['FatSheep legacy URL', 'https://api.v1.mk/sub?', 'https://api.v1.mk/sub']
    ])('normalizes %s for external converter redirects', async (_label, backend, expectedEndpoint) => {
        const subscriptions = [{
            id: 'sub-a',
            name: 'Airport A',
            url: 'https://airport.example/sub',
            enabled: true
        }];
        const adapter = createStorageAdapter({
            settings: {
                mytoken: 'stable-token',
                enableFlagEmoji: false,
                enableTrafficNode: false,
                subconverter: { engineMode: 'external', defaultBackend: backend }
            },
            subscriptions
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 })));

        const logSpy = silenceExpectedRequestLogs();
        try {
            const { handleMisubRequest } = await import('../../functions/modules/subscription/main-handler.js');
            const response = await handleMisubRequest({
                request: new Request('https://misub.example/stable-token?target=clash&refresh=1', {
                    headers: { 'User-Agent': 'ClashMeta' }
                }),
                env: {},
                waitUntil: vi.fn()
            });
            const redirectUrl = new URL(response.headers.get('Location'));
            const dataSourceUrl = redirectUrl.searchParams.get('url');

            expect(response.status).toBe(302);
            expect(redirectUrl.origin + redirectUrl.pathname).toBe(expectedEndpoint);
            expect(redirectUrl.searchParams.get('target')).toBe('clash');
            expect(dataSourceUrl).toBe('https://misub.example/stable-token?base64');
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[MiSub Request]'));
            expect(logSpy).toHaveBeenCalledWith('[MiSub Nodes] Count/Length: 51');
        } finally {
            logSpy.mockRestore();
        }
    });

    it('returns current fetch traffic header on the first builtin response', async () => {
        const subscriptions = [{
            id: 'sub-a',
            name: 'Airport A',
            url: 'https://airport.example/sub',
            enabled: true,
            userInfo: null
        }];
        const adapter = createStorageAdapter({
            settings: { mytoken: 'stable-token', enableFlagEmoji: false, enableTrafficNode: false },
            subscriptions
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('trojan://pass@example.com:443#HK', {
            status: 200,
            headers: {
                'subscription-userinfo': 'upload=10; download=20; total=1000; expire=2000'
            }
        })));

        const waitUntilPromises = [];
        const logSpy = silenceExpectedRequestLogs();
        try {
            const { handleMisubRequest } = await import('../../functions/modules/subscription/main-handler.js');
            const response = await handleMisubRequest({
                request: new Request('https://misub.example/stable-token?target=clash&refresh=1&builtin=true', {
                    headers: { 'User-Agent': 'ClashMeta' }
                }),
                env: {},
                waitUntil: promise => waitUntilPromises.push(promise)
            });
            const text = await response.text();

            expect(response.status).toBe(200);
            expect(text).toContain('proxies:');
            expect(response.headers.get('Subscription-Userinfo')).toBe('upload=10; download=20; total=1000; expire=2000');
            expect(waitUntilPromises.length).toBeGreaterThan(0);
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[MiSub Request]'));
            expect(logSpy).toHaveBeenCalledWith('[MiSub Nodes] Count/Length: 51');
        } finally {
            logSpy.mockRestore();
        }
    });

    it('does not return stale traffic header when current external pull has zero nodes with protective cache disabled', async () => {
        const subscriptions = [{
            id: 'sub-a',
            name: 'Airport A',
            url: 'https://airport.example/sub',
            enabled: true,
            enableNodeCache: false,
            nodeCount: 86,
            userInfo: { upload: 10, download: 20, total: 1000, expire: 2000 }
        }];
        const adapter = createStorageAdapter({
            settings: { mytoken: 'stable-token', enableFlagEmoji: false, enableTrafficNode: false },
            subscriptions
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('Forbidden', { status: 403 })));

        const waitUntilPromises = [];
        const logSpy = silenceExpectedRequestLogs();
        try {
            const { handleMisubRequest } = await import('../../functions/modules/subscription/main-handler.js');
            const response = await handleMisubRequest({
                request: new Request('https://misub.example/stable-token?target=nodes&refresh=1', {
                    headers: { 'User-Agent': 'ClashMeta' }
                }),
                env: {},
                waitUntil: promise => waitUntilPromises.push(promise)
            });
            const text = await response.text();

            expect(response.status).toBe(200);
            expect(text.trim()).toBe('');
            expect(response.headers.get('Subscription-Userinfo')).toBeNull();
            expect(waitUntilPromises.length).toBeGreaterThan(0);
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[MiSub Request]'));
            expect(logSpy).toHaveBeenCalledWith('[MiSub Nodes] Count/Length: 0');

            await Promise.all(waitUntilPromises);

            const [updatedSub] = adapter.store.get('misub_subscriptions_v1');
            expect(updatedSub.nodeCount).toBe(0);
            expect(updatedSub.userInfo).toBeNull();
        } finally {
            logSpy.mockRestore();
        }
    });


    it('serves disguise content before token validation for unauthenticated browser subscription visits', async () => {
        const adapter = createStorageAdapter({
            settings: {
                mytoken: 'stable-token',
                enableFlagEmoji: false,
                enableTrafficNode: false,
                disguise: { enabled: true, type: 'notfound' }
            },
            subscriptions: [{
                id: 'sub-a',
                name: 'Airport A',
                url: 'https://airport.example/sub',
                enabled: true
            }]
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 })));

        const logSpy = silenceExpectedRequestLogs();
        try {
            const { handleMisubRequest } = await import('../../functions/modules/subscription/main-handler.js');
            const response = await handleMisubRequest({
                request: new Request('https://misub.example/wrong-token?target=nodes', {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
                        Accept: 'text/html'
                    }
                }),
                env: {},
                waitUntil: vi.fn()
            });
            const text = await response.text();

            expect(response.status).toBe(404);
            expect(response.headers.get('Content-Type')).toContain('text/html');
            expect(text).not.toContain('Invalid Token');
            expect(text).not.toContain('trojan://pass@example.com');
            expect(globalThis.fetch).not.toHaveBeenCalled();
        } finally {
            logSpy.mockRestore();
        }
    });

    it.each(['refresh', 'nocache', 'debug'])('bypasses fresh aggregate cache when %s is present', async (paramName) => {
        const subscriptions = [{
            id: 'sub-a',
            name: 'Airport A',
            url: 'https://airport.example/sub',
            enabled: true
        }];
        const adapter = createStorageAdapter({
            settings: { mytoken: 'stable-token', enableFlagEmoji: false, enableTrafficNode: false },
            subscriptions
        });
        adapter.store.set('node_cache_token_stable-token', {
            nodes: 'trojan://cached@example.com:443#Cached\n',
            timestamp: Date.now(),
            nodeCount: 1,
            sources: ['Airport A']
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('trojan://fresh@example.com:443#Fresh', { status: 200 })));

        const logSpy = silenceExpectedRequestLogs();
        try {
            const { handleMisubRequest } = await import('../../functions/modules/subscription/main-handler.js');
            const response = await handleMisubRequest({
                request: new Request(`https://misub.example/stable-token?target=nodes&${paramName}=1`, {
                    headers: { 'User-Agent': 'ClashMeta' }
                }),
                env: {},
                waitUntil: vi.fn()
            });
            const text = await response.text();

            expect(response.status).toBe(200);
            expect(text).toContain('trojan://fresh@example.com:443#');
            expect(text).not.toContain('trojan://cached@example.com:443#');
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        } finally {
            logSpy.mockRestore();
        }
    });
});
