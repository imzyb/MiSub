import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createAdapter = vi.fn();
const getStorageType = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
    StorageFactory: {
        createAdapter: (...args) => createAdapter(...args),
        getStorageType: (...args) => getStorageType(...args),
        resolveKV: (env) => env?.MISUB_KV || null,
    },
    STORAGE_TYPES: { KV: 'kv', D1: 'd1' },
}));

function createStorageAdapter({ settings = {}, subscriptions = [], profiles = [] } = {}) {
    const store = new Map([
        ['worker_settings_v1', settings],
        ['misub_subscriptions_v1', subscriptions],
        ['misub_profiles_v1', profiles],
    ]);
    return {
        store,
        get: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
        put: vi.fn(async (key, value) => {
            store.set(key, value);
            return true;
        }),
        getAllSubscriptions: vi.fn(async () => subscriptions),
        getAllProfiles: vi.fn(async () => profiles),
        getSubscriptionsByIds: vi.fn(async (ids) =>
            subscriptions.filter((item) => ids.includes(item.id))
        ),
    };
}

async function statusFor(path, profiles, settings = { profileToken: 'tok' }) {
    createAdapter.mockReturnValue(createStorageAdapter({ settings, profiles }));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
        const { handleMisubRequest } = await import(
            '../../functions/modules/subscription/main-handler.js'
        );
        const response = await handleMisubRequest({
            request: new Request('https://misub.example' + path, {
                headers: { 'User-Agent': 'ClashMeta' },
            }),
            env: {},
            waitUntil: vi.fn(),
        });
        return response.status;
    } finally {
        spy.mockRestore();
    }
}

const baseProfile = (extra = {}) => ({
    id: 'uuid-legacy',
    name: 'Legacy',
    enabled: true,
    subscriptions: [],
    manualNodes: [],
    subProfiles: [],
    ...extra,
});

describe('public profile routing (issue #538)', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        getStorageType.mockResolvedValue('kv');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('serves a legacy profile by its migrated linkId (= own id)', async () => {
        expect(await statusFor('/tok/uuid-legacy', [baseProfile({ linkId: 'uuid-legacy' })])).toBe(200);
    });

    it('keeps a profile reachable by id before migration lands', async () => {
        expect(await statusFor('/tok/uuid-legacy', [baseProfile()])).toBe(200);
    });

    it('hides the internal id once a customId is set', async () => {
        const profiles = [baseProfile({ customId: 'home', linkId: 'uuid-legacy' })];
        expect(await statusFor('/tok/home', profiles)).toBe(200);
        expect(await statusFor('/tok/uuid-legacy', profiles)).toBe(404);
    });

    it('hides the previous linkId after a rotation', async () => {
        const profiles = [baseProfile({ linkId: 'rotated-link' })];
        expect(await statusFor('/tok/rotated-link', profiles)).toBe(200);
        expect(await statusFor('/tok/uuid-legacy', profiles)).toBe(404);
    });

    it('hides linkId as well once a customId exists', async () => {
        const profiles = [baseProfile({ linkId: 'rotated-link', customId: 'home' })];
        expect(await statusFor('/tok/rotated-link', profiles)).toBe(404);
    });

    it('persists the linkId backfill for legacy profiles', async () => {
        const profiles = [baseProfile()];
        await statusFor('/tok/uuid-legacy', profiles);
        expect(profiles[0].linkId).toBe('uuid-legacy');
    });
});
