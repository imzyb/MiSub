import { describe, it, expect, vi } from 'vitest';
import { resolveNodeListWithCache } from '../../functions/modules/subscription/cache-manager.js';

function createStorage(cachedData) {
    return {
        get: vi.fn().mockResolvedValue(cachedData)
    };
}

describe('resolveNodeListWithCache', () => {
    it('returns a fresh non-empty cache without refreshing', async () => {
        const refreshNodes = vi.fn().mockResolvedValue('trojan://password@1.2.3.5:443#JP-01');
        const context = {};

        const result = await resolveNodeListWithCache({
            storageAdapter: createStorage({
                nodes: 'trojan://password@1.2.3.4:443#HK-01',
                timestamp: Date.now(),
                nodeCount: 1,
                sources: ['airport']
            }),
            cacheKey: 'node_cache_token_test',
            forceRefresh: false,
            refreshNodes,
            context,
            targetMisubsCount: 1
        });

        expect(result.combinedNodeList).toBe('trojan://password@1.2.3.4:443#HK-01');
        expect(result.cacheHeaders['X-Cache-Status']).toBe('HIT');
        expect(result.cacheHeaders['X-Node-Count']).toBe('1');
        expect(refreshNodes).not.toHaveBeenCalled();
        expect(context.generationStats.totalNodes).toBe(1);
    });

    it('refreshes synchronously when a fresh cache contains zero nodes', async () => {
        const refreshNodes = vi.fn().mockResolvedValue('trojan://password@1.2.3.4:443#HK-01');

        const result = await resolveNodeListWithCache({
            storageAdapter: createStorage({
                nodes: '',
                timestamp: Date.now(),
                nodeCount: 0,
                sources: ['airport']
            }),
            cacheKey: 'node_cache_token_test',
            forceRefresh: false,
            refreshNodes,
            context: {},
            targetMisubsCount: 1
        });

        expect(result.combinedNodeList).toBe('trojan://password@1.2.3.4:443#HK-01');
        expect(result.cacheHeaders['X-Cache-Status']).toBe('MISS');
        expect(result.cacheHeaders['X-Node-Count']).toBe('1');
        expect(refreshNodes).toHaveBeenCalledTimes(1);
        expect(refreshNodes).toHaveBeenCalledWith(false);
    });
});
