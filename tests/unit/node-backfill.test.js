import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
    settings: {
        storageType: 'd1',
        enableNodePersistence: true,
        autoUpdateInterval: 0,
    },
    subscriptions: [],
    snapshots: new Map(),
    hops: [],
    airportFetches: [],
};

vi.mock('../../functions/storage-adapter.js', () => ({
    ensureD1Schema: vi.fn(async () => {}),
    SettingsCache: {
        get: vi.fn(async () => state.settings),
        clear: vi.fn(),
    },
    StorageFactory: {
        getStorageType: vi.fn(async () => 'd1'),
        resolveKV: vi.fn(() => null),
        createAdapter: vi.fn(() => ({
            async get(key) {
                return key === 'worker_settings_v1' ? state.settings : null;
            },
            async put(key, value) {
                if (key === 'worker_settings_v1') state.settings = value;
                return true;
            },
            async getAllSubscriptions() {
                return state.subscriptions;
            },
        })),
        createNodeStore: vi.fn(() => ({
            async getSnapshot(id) {
                return state.snapshots.get(id) || null;
            },
            async putSnapshot(snapshot) {
                state.snapshots.set(snapshot.subscriptionId, {
                    subscription_id: snapshot.subscriptionId,
                    config_fingerprint: snapshot.configFingerprint,
                    state: snapshot.state,
                    nodes_json: snapshot.nodesJson,
                    node_count: snapshot.nodeCount,
                    user_info_json: snapshot.userInfoJson,
                    last_success_at: snapshot.lastSuccessAt,
                    last_attempt_at: snapshot.lastAttemptAt,
                    last_error: snapshot.lastError,
                });
                return true;
            },
            async listSnapshotsFor(ids) {
                return ids.map((id) => state.snapshots.get(id)).filter(Boolean);
            },
            async deleteForSubscription(id) {
                state.snapshots.delete(id);
                return true;
            },
        })),
    },
}));

const subs = (count) =>
    Array.from({ length: count }, (_, index) => ({
        id: `sub-${index + 1}`,
        name: `Airport ${index + 1}`,
        url: `https://airport${index + 1}.example/sub`,
        enabled: true,
    }));

describe('节点持久化：启用即全量回填（内部接口链）', () => {
    beforeEach(() => {
        state.settings = { storageType: 'd1', enableNodePersistence: true, autoUpdateInterval: 0 };
        state.subscriptions = subs(8);
        state.snapshots = new Map();
        state.hops = [];
        state.airportFetches = [];

        globalThis.fetch = vi.fn(async (input, init) => {
            const url = typeof input === 'string' ? input : input.url;
            if (url.includes('/api/internal/node-backfill')) {
                state.hops.push({ url, token: init?.headers?.['x-misub-backfill-token'] });
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            }
            state.airportFetches.push(url);
            return new Response('trojan://pass@a.example:443#HK', { status: 200 });
        });
    });

    it('启用时创建全量任务并只处理一批，剩余通过内部接口继续', async () => {
        const { startNodeBackfill, runNextBackfillBatch, BACKFILL_BATCH_SIZE } = await import(
            '../../functions/services/node-persistence-service.js'
        );

        const started = await startNodeBackfill({ MISUB_DB: {} }, {
            requestUrl: 'https://misub.example/api/settings',
        });
        expect(started.started).toBe(true);
        expect(started.total).toBe(8);
        expect(started.state.pendingIds).toHaveLength(8);

        const result = await runNextBackfillBatch({ MISUB_DB: {} }, {
            requestUrl: 'https://misub.example/api/settings',
            state: started.state,
        });

        expect(result.ran).toBe(BACKFILL_BATCH_SIZE);
        expect(result.done).toBe(false);
        expect(state.airportFetches).toHaveLength(BACKFILL_BATCH_SIZE);
        expect(state.hops).toHaveLength(1);
        expect(state.hops[0].token).toBe(started.state.token);
        expect(state.settings.nodePersistenceBackfill.pendingIds).toHaveLength(2);
    });

    it('内部接口校验 token，错误 token 不会触发任何拉取', async () => {
        const { handleInternalBackfillRequest, startNodeBackfill } = await import(
            '../../functions/services/node-persistence-service.js'
        );
        await startNodeBackfill({ MISUB_DB: {} }, { requestUrl: 'https://misub.example/x' });

        const bad = await handleInternalBackfillRequest(
            new Request('https://misub.example/api/internal/node-backfill', {
                method: 'POST',
                headers: { 'x-misub-backfill-token': 'wrong' },
            }),
            { MISUB_DB: {} }
        );
        expect(bad.status).toBe(401);
        expect(state.airportFetches).toHaveLength(0);

        const token = state.settings.nodePersistenceBackfill.token;
        const ok = await handleInternalBackfillRequest(
            new Request('https://misub.example/api/internal/node-backfill', {
                method: 'POST',
                headers: { 'x-misub-backfill-token': token },
            }),
            { MISUB_DB: {} }
        );
        expect(ok.status).toBe(200);
        expect(state.airportFetches.length).toBeGreaterThan(0);
    });

    it('回填忽略 autoUpdate=false（这是初始化，不是自动刷新）', async () => {
        state.subscriptions = [
            { ...subs(1)[0], autoUpdate: false },
        ];
        const { startNodeBackfill, runNextBackfillBatch } = await import(
            '../../functions/services/node-persistence-service.js'
        );
        const started = await startNodeBackfill({ MISUB_DB: {} }, { requestUrl: 'https://m/x' });
        expect(started.total).toBe(1);

        const result = await runNextBackfillBatch({ MISUB_DB: {} }, {
            requestUrl: 'https://m/x',
            state: started.state,
        });
        expect(result.ran).toBe(1);
        expect(state.airportFetches).toHaveLength(1);
    });
});
