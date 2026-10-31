import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildSubscriptionFilterFingerprint,
    buildSubscriptionNodeCacheKey,
} from '../../functions/services/subscription-service.js';

const createAdapter = vi.fn();
const getStorageType = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
    StorageFactory: {
        createAdapter: (...args) => createAdapter(...args),
        getStorageType: (...args) => getStorageType(...args),
    },
}));

function createMemoryStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
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
        },
    };
}

const SUB = {
    id: 'sub-a',
    name: '机场A',
    url: 'https://example.com/sub',
    enabled: true,
    enableNodeCache: true,
};

const CACHED_NODES = [
    'trojan://cached@example.com:443#HK%20Cached',
    'trojan://cached2@example.com:443#US%20Cached',
];

function createStorageWithCache(sub, extra = {}) {
    return createMemoryStorage({
        [buildSubscriptionNodeCacheKey(sub)]: {
            nodes: CACHED_NODES,
            nodeCount: CACHED_NODES.length,
            updatedAt: '2026-01-01T00:00:00.000Z',
            filterFingerprint: buildSubscriptionFilterFingerprint(sub),
            ...extra,
        },
    });
}

describe('preview node fetch protective cache fallback', () => {
    let fetchSubscriptionNodes;

    beforeEach(async () => {
        const module = await import('../../functions/modules/subscription/node-fetcher.js');
        fetchSubscriptionNodes = module.fetchSubscriptionNodes;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('enableNodeCache 开启且上游返回 HTTP 错误时，预览回退到保护性缓存节点', async () => {
        const storage = createStorageWithCache(SUB);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('Forbidden', { status: 403 }))
        );

        const result = await fetchSubscriptionNodes(
            SUB.url,
            SUB.name,
            'MiSub-Node-Preview/1.0',
            null,
            false,
            '',
            null,
            false,
            false,
            true,
            storage,
            SUB
        );

        expect(result.success).toBe(true);
        expect(result.fromCache).toBe(true);
        expect(result.nodes).toHaveLength(CACHED_NODES.length);
        expect(result.nodes[0].url).toBe(CACHED_NODES[0]);
        expect(result.nodes[0].protocol).toBe('trojan');
        expect(result.nodes[0].name).toBe('HK Cached');
    });

    it('enableNodeCache 开启且上游返回 200 但无有效节点时，过滤指纹未变化则回退缓存', async () => {
        const storage = createStorageWithCache(SUB);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('订阅已过期，请联系管理员', { status: 200 }))
        );

        const result = await fetchSubscriptionNodes(
            SUB.url,
            SUB.name,
            'MiSub-Node-Preview/1.0',
            null,
            false,
            '',
            null,
            false,
            false,
            true,
            storage,
            SUB
        );

        expect(result.success).toBe(true);
        expect(result.fromCache).toBe(true);
        expect(result.nodes).toHaveLength(CACHED_NODES.length);
    });

    it('过滤指纹变化后上游 0 节点是预期结果，不回退旧配置的缓存', async () => {
        const changedSub = { ...SUB, exclude: 'keep:Never-Match' };
        const storage = createStorageWithCache(SUB);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('trojan://live@example.com:443#Live', { status: 200 }))
        );

        const result = await fetchSubscriptionNodes(
            changedSub.url,
            changedSub.name,
            'MiSub-Node-Preview/1.0',
            null,
            false,
            changedSub.exclude,
            null,
            false,
            false,
            true,
            storage,
            changedSub
        );

        // 上游 1 个节点被 keep 过滤为 0，且用户过滤配置已变化：不得用旧缓存顶替
        expect(result.nodes).toHaveLength(0);
        expect(result.fromCache).toBeUndefined();
    });

    it('enableNodeCache 关闭时上游失败不回退缓存，保持原行为', async () => {
        const storage = createStorageWithCache({ ...SUB, enableNodeCache: false });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('Forbidden', { status: 403 }))
        );

        const result = await fetchSubscriptionNodes(
            SUB.url,
            SUB.name,
            'MiSub-Node-Preview/1.0',
            null,
            false,
            '',
            null,
            false,
            false,
            false,
            storage,
            { ...SUB, enableNodeCache: false }
        );

        expect(result.success).toBe(false);
        expect(result.nodes).toHaveLength(0);
    });

    it('上游成功时不读缓存，正常返回实时节点', async () => {
        const storage = createStorageWithCache(SUB);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('trojan://live@example.com:443#Live', { status: 200 }))
        );

        const result = await fetchSubscriptionNodes(
            SUB.url,
            SUB.name,
            'MiSub-Node-Preview/1.0',
            null,
            false,
            '',
            null,
            false,
            false,
            true,
            storage,
            SUB
        );

        expect(result.success).toBe(true);
        expect(result.fromCache).toBeUndefined();
        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].name).toBe('Live');
    });
});

describe('handleSingleSubscriptionMode preview fallback', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('订阅 URL 过期返回 403 时，预览节点回退保护性缓存', async () => {
        const storage = createStorageWithCache(SUB);
        createAdapter.mockReturnValue({
            getSubscriptionById: vi.fn().mockResolvedValue({ ...SUB }),
            get: vi.fn((key) => storage.get(key)),
        });
        getStorageType.mockResolvedValue('kv');

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('Forbidden', { status: 403 }))
        );

        const { handleSingleSubscriptionMode } =
            await import('../../functions/modules/subscription/single-subscription.js');
        const result = await handleSingleSubscriptionMode(
            new Request('https://example.com/api/subscription_nodes'),
            {},
            'sub-a',
            'MiSub-Node-Preview/1.0'
        );

        expect(result.success).toBe(true);
        expect(result.totalCount).toBe(CACHED_NODES.length);
        expect(result.nodes).toHaveLength(CACHED_NODES.length);
        expect(result.nodes[0].name).toBe('HK Cached');
        expect(result.subscriptions[0].fromCache).toBe(true);
    });
});
