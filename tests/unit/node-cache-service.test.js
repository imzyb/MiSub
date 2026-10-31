/**
 * Node cache service tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
    getCache,
    setCache,
    clearAllNodeCaches,
    createCacheHeaders,
    triggerBackgroundRefresh,
    getCacheConfig,
    isSuspiciousNodeCountDrop,
    isLikelyPartialAggregateNodeList,
} from '../../functions/services/node-cache-service.js';

function createStorage(initialData = {}) {
    const data = new Map(Object.entries(initialData));
    return {
        get: async (key) => data.get(key) || null,
        put: async (key, value) => {
            data.set(key, value);
        },
    };
}

describe('node-cache-service', () => {
    it('returns miss when cache is empty', async () => {
        const storage = createStorage();
        const result = await getCache(storage, 'missing');
        expect(result.status).toBe('miss');
        expect(result.data).toBeNull();
    });

    it('returns stale/expired based on age', async () => {
        const { FRESH_TTL, STALE_TTL, MAX_AGE } = getCacheConfig();
        const now = Date.now();

        const storage = createStorage({
            stale: { nodes: 'a', timestamp: now - (FRESH_TTL + 1000), nodeCount: 1, sources: [] },
            expired: { nodes: 'b', timestamp: now - (STALE_TTL + 1000), nodeCount: 2, sources: [] },
            miss: { nodes: 'c', timestamp: now - (MAX_AGE + 1000), nodeCount: 3, sources: [] },
        });

        const stale = await getCache(storage, 'stale');
        expect(stale.status).toBe('stale');

        const expired = await getCache(storage, 'expired');
        expect(expired.status).toBe('expired');

        const miss = await getCache(storage, 'miss');
        expect(miss.status).toBe('miss');
    });

    it('creates cache headers with status and count', () => {
        const headers = createCacheHeaders('HIT', 42);
        expect(headers['X-Cache-Status']).toBe('HIT');
        expect(headers['X-Node-Count']).toBe('42');
        expect(headers['X-Cache-Time']).toBeTruthy();
    });

    it('triggers background refresh via waitUntil', async () => {
        const waitUntil = vi.fn();
        const context = { waitUntil };
        const refreshFn = vi.fn().mockResolvedValue('ok');

        triggerBackgroundRefresh(context, refreshFn);

        expect(waitUntil).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledTimes(1);
    });

    it('refuses to overwrite an existing non-empty cache with an empty node list', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const storage = createStorage({
            cache: {
                nodes: 'trojan://password@1.2.3.4:443#HK-01\n',
                timestamp: Date.now(),
                nodeCount: 1,
                sources: ['机场'],
            },
        });

        try {
            const updated = await setCache(storage, 'cache', '', ['机场']);
            const cached = await getCache(storage, 'cache');

            expect(updated).toBe(false);
            expect(cached.data.nodes).toBe('trojan://password@1.2.3.4:443#HK-01\n');
            expect(cached.data.nodeCount).toBe(1);
            expect(warnSpy).toHaveBeenCalledWith(
                '[Cache] Refusing to overwrite non-empty cache cache with empty node list'
            );
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('refuses to overwrite a healthy large cache after a severe node-count drop', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const healthyNodes =
            Array.from(
                { length: 156 },
                (_, index) => `trojan://password${index}@node${index}.example.com:443#Node-${index}`
            ).join('\n') + '\n';
        const storage = createStorage({
            cache: {
                nodes: healthyNodes,
                timestamp: Date.now(),
                nodeCount: 156,
                sources: ['Airport'],
            },
        });

        try {
            const updated = await setCache(
                storage,
                'cache',
                'vless://11111111-1111-1111-1111-111111111111@example.com:443#11111111-1111-1111-1111-111111111111\n',
                ['Airport']
            );
            const cached = await getCache(storage, 'cache');

            expect(updated).toBe(false);
            expect(cached.data.nodeCount).toBe(156);
            expect(cached.data.nodes).toBe(healthyNodes);
            expect(warnSpy).toHaveBeenCalledWith(
                '[Cache] Refusing to overwrite cache cache after suspicious node-count drop (156 -> 1)'
            );
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('allows normal node-count changes and only flags severe drops from established caches', () => {
        expect(isSuspiciousNodeCountDrop(156, 1)).toBe(true);
        expect(isSuspiciousNodeCountDrop(156, 80)).toBe(false);
        expect(isSuspiciousNodeCountDrop(9, 1)).toBe(false);
        expect(isSuspiciousNodeCountDrop(0, 1)).toBe(false);
    });

    it('recognizes the traffic-node plus UUID-node signature of a partial aggregate result', async () => {
        const partial =
            [
                'trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#%E6%B5%81%E9%87%8F%E5%89%A9%E4%BD%99',
                'vless://11111111-1111-1111-1111-111111111111@example.com:443#11111111-1111-1111-1111-111111111111',
            ].join('\n') + '\n';
        const storage = createStorage();

        expect(isLikelyPartialAggregateNodeList(partial)).toBe(true);
        expect(await setCache(storage, 'cache', partial, ['Airport'])).toBe(false);
        expect(await getCache(storage, 'cache')).toEqual({ data: null, status: 'miss' });
        expect(
            isLikelyPartialAggregateNodeList(
                'vless://11111111-1111-1111-1111-111111111111@example.com:443#HK\n'
            )
        ).toBe(false);
    });

    it('preserves only requested subscription protective caches when clearing node caches', async () => {
        const deleted = [];
        const storage = {
            async list() {
                return [
                    'node_cache_token_main',
                    'node_cache_profile_profile-1',
                    'node_cache_subscription_sub-keep',
                    'node_cache_subscription_sub-drop',
                ];
            },
            async delete(key) {
                deleted.push(key);
            },
        };

        const result = await clearAllNodeCaches(storage, {
            preserveKeys: ['node_cache_subscription_sub-keep'],
        });

        expect(result).toEqual({ cleared: 3, failed: 0, skipped: 1 });
        expect(deleted).toEqual([
            'node_cache_token_main',
            'node_cache_profile_profile-1',
            'node_cache_subscription_sub-drop',
        ]);
    });
});
