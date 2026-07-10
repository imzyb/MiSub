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
    getCacheConfig
} from '../../functions/services/node-cache-service.js';

function createStorage(initialData = {}) {
    const data = new Map(Object.entries(initialData));
    return {
        get: async (key) => data.get(key) || null,
        put: async (key, value) => {
            data.set(key, value);
        }
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
            miss: { nodes: 'c', timestamp: now - (MAX_AGE + 1000), nodeCount: 3, sources: [] }
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
                sources: ['机场']
            }
        });

        try {
            const updated = await setCache(storage, 'cache', '', ['机场']);
            const cached = await getCache(storage, 'cache');

            expect(updated).toBe(false);
            expect(cached.data.nodes).toBe('trojan://password@1.2.3.4:443#HK-01\n');
            expect(cached.data.nodeCount).toBe(1);
            expect(warnSpy).toHaveBeenCalledWith('[Cache] Refusing to overwrite non-empty cache cache with empty node list');
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('preserves only requested subscription protective caches when clearing node caches', async () => {
        const deleted = [];
        const storage = {
            async list() {
                return [
                    'node_cache_token_main',
                    'node_cache_profile_profile-1',
                    'node_cache_subscription_sub-keep',
                    'node_cache_subscription_sub-drop'
                ];
            },
            async delete(key) {
                deleted.push(key);
            }
        };

        const result = await clearAllNodeCaches(storage, {
            preserveKeys: ['node_cache_subscription_sub-keep']
        });

        expect(result).toEqual({ cleared: 3, failed: 0, skipped: 1 });
        expect(deleted).toEqual([
            'node_cache_token_main',
            'node_cache_profile_profile-1',
            'node_cache_subscription_sub-drop'
        ]);
    });
});
