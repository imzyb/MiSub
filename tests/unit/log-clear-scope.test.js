import { describe, expect, it, vi } from 'vitest';
import { LogService } from '../../functions/services/log-service.js';
import {
    clearProfileDownloadCounts,
    PROFILE_DOWNLOAD_COUNT_PREFIX,
} from '../../functions/services/profile-stats-service.js';

// 构造一个最小可用的 KV 适配器（LogService 会按 storage 接口探测）
function createKvAdapter(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        store,
        type: 'kv',
        async get(key) {
            return store.has(key) ? store.get(key) : null;
        },
        async put(key, value) {
            store.set(key, value);
        },
        async delete(key) {
            store.delete(key);
        },
    };
}

const bucketKey = 'misub_system_logs:2026-11-21';

function createEnv() {
    const adapter = createKvAdapter({
        'misub_system_logs:index': [bucketKey],
        [bucketKey]: [
            { id: 'l1', profileId: 'p1', profileName: 'A', timestamp: Date.now() },
            { id: 'l2', profileId: 'p2', profileName: 'B', timestamp: Date.now() },
            { id: 'l3', profileId: 'p1', profileName: 'A', timestamp: Date.now() },
        ],
    });
    return { MISUB_KV: adapter, __adapter: adapter };
}

vi.mock('../../functions/storage-adapter.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        StorageFactory: {
            ...actual.StorageFactory,
            getStorageType: async () => 'kv',
            createAdapter: (env) => env.__adapter,
            resolveKV: (env) => env?.MISUB_KV || null,
        },
    };
});

describe('LogService.clearLogs scope', () => {
    it('removes only the requested profile entries and keeps the rest', async () => {
        const env = createEnv();
        await LogService.clearLogs(env, { profileId: 'p1', profileName: 'A' });

        const remaining = env.__adapter.store.get(bucketKey);
        expect(remaining.map((log) => log.id)).toEqual(['l2']);
        // 索引不应被清空（还有别的订阅组日志）
        expect(env.__adapter.store.get('misub_system_logs:index')).toEqual([bucketKey]);
    });

    it('clears everything when no scope is given', async () => {
        const env = createEnv();
        await LogService.clearLogs(env);

        expect(env.__adapter.store.get(bucketKey)).toBeUndefined();
        expect(env.__adapter.store.get('misub_system_logs:index')).toBeUndefined();
    });

    it('deletes the bucket when the scoped profile was its only content', async () => {
        const env = createEnv();
        env.__adapter.store.set(bucketKey, [
            { id: 'only', profileId: 'p1', profileName: 'A', timestamp: Date.now() },
        ]);

        await LogService.clearLogs(env, { profileId: 'p1', profileName: 'A' });

        expect(env.__adapter.store.get(bucketKey)).toBeUndefined();
    });
});

describe('clearProfileDownloadCounts scope', () => {
    function makeAdapter(profiles) {
        const store = new Map(
            profiles.map((p) => [`${PROFILE_DOWNLOAD_COUNT_PREFIX}${p.id}`, '9'])
        );
        return {
            store,
            getAllProfiles: vi.fn(async () => profiles),
            putAllProfiles: vi.fn(async () => true),
            delete: vi.fn(async (key) => store.delete(key)),
            put: vi.fn(async () => true),
        };
    }

    it('only resets the targeted profile when profileId is provided', async () => {
        const profiles = [
            { id: 'p1', downloadCount: 5 },
            { id: 'p2', downloadCount: 7 },
        ];
        const adapter = makeAdapter(profiles);

        const count = await clearProfileDownloadCounts(adapter, { profileId: 'p1' });

        expect(count).toBe(1);
        expect(adapter.delete).toHaveBeenCalledWith(`${PROFILE_DOWNLOAD_COUNT_PREFIX}p1`);
        expect(adapter.delete).not.toHaveBeenCalledWith(`${PROFILE_DOWNLOAD_COUNT_PREFIX}p2`);
        expect(profiles[0].downloadCount).toBe(0);
        expect(profiles[1].downloadCount).toBe(7);
    });

    it('resets every profile when no scope is provided', async () => {
        const profiles = [
            { id: 'p1', downloadCount: 5 },
            { id: 'p2', downloadCount: 7 },
        ];
        const adapter = makeAdapter(profiles);

        const count = await clearProfileDownloadCounts(adapter);

        expect(count).toBe(2);
        expect(profiles.every((p) => p.downloadCount === 0)).toBe(true);
    });
});
