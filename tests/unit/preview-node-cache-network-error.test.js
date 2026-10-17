import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildSubscriptionFilterFingerprint,
    buildSubscriptionNodeCacheKey,
} from '../../functions/services/subscription-service.js';

vi.mock('../../functions/services/fetch-utils.js', () => ({
    fetchWithRetry: vi.fn(async () => {
        throw new Error('Network connection refused');
    }),
}));

const SUB = {
    id: 'sub-net',
    name: '机场B',
    url: 'https://example.com/sub-b',
    enabled: true,
    enableNodeCache: true,
};

function createMemoryStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        async get(key) {
            return store.has(key) ? store.get(key) : null;
        },
        async put(key, value) {
            store.set(key, value);
            return true;
        },
    };
}

describe('preview node fetch network error fallback', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('enableNodeCache 开启且网络异常时，预览回退到保护性缓存节点', async () => {
        const storage = createMemoryStorage({
            [buildSubscriptionNodeCacheKey(SUB)]: {
                nodes: ['trojan://cached@example.com:443#HK'],
                nodeCount: 1,
                updatedAt: '2026-01-01T00:00:00.000Z',
                filterFingerprint: buildSubscriptionFilterFingerprint(SUB),
            },
        });

        const { fetchSubscriptionNodes } =
            await import('../../functions/modules/subscription/node-fetcher.js');
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
        expect(result.error).toBe('Network connection refused');
        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].name).toBe('HK');
    });
});
