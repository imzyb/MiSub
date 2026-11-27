import { describe, expect, it, vi } from 'vitest';
import {
    clearProfileDownloadCounts,
    PROFILE_DOWNLOAD_COUNT_PREFIX,
} from '../../functions/services/profile-stats-service.js';

function makeAdapter(profiles, { withBulk = true } = {}) {
    const store = new Map();
    for (const profile of profiles) {
        store.set(`${PROFILE_DOWNLOAD_COUNT_PREFIX}${profile.id}`, '42');
        if (profile.customId) {
            store.set(`${PROFILE_DOWNLOAD_COUNT_PREFIX}${profile.customId}`, '7');
        }
    }
    const adapter = {
        store,
        getAllProfiles: vi.fn(async () => profiles),
        delete: vi.fn(async (key) => {
            store.delete(key);
        }),
        put: vi.fn(async () => true),
    };
    if (withBulk) adapter.putAllProfiles = vi.fn(async () => true);
    return adapter;
}

describe('clearProfileDownloadCounts', () => {
    it('deletes counter keys for both id and legacy customId', async () => {
        const profiles = [
            { id: 'uuid-1', customId: 'home', downloadCount: 42 },
            { id: 'uuid-2', downloadCount: 0 },
        ];
        const adapter = makeAdapter(profiles);

        const count = await clearProfileDownloadCounts(adapter);

        expect(count).toBe(2);
        expect(adapter.delete).toHaveBeenCalledWith(`${PROFILE_DOWNLOAD_COUNT_PREFIX}uuid-1`);
        expect(adapter.delete).toHaveBeenCalledWith(`${PROFILE_DOWNLOAD_COUNT_PREFIX}home`);
        expect(adapter.delete).toHaveBeenCalledWith(`${PROFILE_DOWNLOAD_COUNT_PREFIX}uuid-2`);
        expect(adapter.store.size).toBe(0);
    });

    it('zeroes the downloadCount snapshot so the fallback cannot resurrect old numbers', async () => {
        const profiles = [{ id: 'uuid-1', downloadCount: 128 }];
        const adapter = makeAdapter(profiles);

        await clearProfileDownloadCounts(adapter);

        expect(profiles[0].downloadCount).toBe(0);
        expect(adapter.putAllProfiles).toHaveBeenCalledWith(profiles);
    });

    it('falls back to a single collection write when putAllProfiles is unavailable', async () => {
        const profiles = [{ id: 'uuid-1', downloadCount: 5 }];
        const adapter = makeAdapter(profiles, { withBulk: false });

        await clearProfileDownloadCounts(adapter);

        expect(adapter.put).toHaveBeenCalledTimes(1);
        expect(adapter.put.mock.calls[0][0]).toContain('profiles');
    });

    it('returns 0 for an empty profile list', async () => {
        const adapter = makeAdapter([]);
        expect(await clearProfileDownloadCounts(adapter)).toBe(0);
    });

    it('tolerates a missing adapter', async () => {
        expect(await clearProfileDownloadCounts(null)).toBe(0);
    });
});
