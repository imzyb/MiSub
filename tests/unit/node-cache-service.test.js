/**
 * Node cache service tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
    getCache,
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
        const { STALE_TTL, MAX_AGE } = getCacheConfig();
        const now = Date.now();

        const storage = createStorage({
            stale: { nodes: 'a', timestamp: now - 1000, nodeCount: 1, sources: [] },
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
});
