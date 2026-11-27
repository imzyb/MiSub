import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildNodeConfigFingerprint,
    getNodeSnapshotForOutput,
    getNodePersistenceCapabilities,
    isNodePersistenceEnabled,
    maybeRefreshDueNodes,
    refreshSubscriptionSnapshot,
} from '../../functions/services/node-persistence-service.js';

/** 只实现节点快照服务用到的 SQL 子集（单行模型） */
function createD1() {
    const rows = new Map();
    const api = (q, args) => ({
        async run() {
            if (/^CREATE /i.test(q) || /^ALTER /i.test(q) || /^DROP /i.test(q)) return { success: true };
            if (/^INSERT INTO subscription_node_snapshots/i.test(q)) {
                const [
                    subscriptionId,
                    fingerprint,
                    state,
                    nodesJson,
                    nodeCount,
                    userInfoJson,
                    lastSuccessAt,
                    lastAttemptAt,
                    lastError,
                ] = args;
                rows.set(subscriptionId, {
                    subscription_id: subscriptionId,
                    config_fingerprint: fingerprint,
                    state,
                    nodes_json: nodesJson,
                    node_count: nodeCount,
                    user_info_json: userInfoJson,
                    last_success_at: lastSuccessAt,
                    last_attempt_at: lastAttemptAt,
                    last_error: lastError,
                });
                return { success: true };
            }
            if (/^DELETE FROM subscription_node_snapshots/i.test(q)) {
                rows.delete(args[0]);
                return { success: true };
            }
            return { success: true };
        },
        async first() {
            if (/FROM sqlite_master/i.test(q)) return null;
            if (/SELECT \* FROM subscription_node_snapshots/i.test(q)) return rows.get(args[0]) || null;
            return null;
        },
        async all() {
            if (/SELECT \* FROM subscription_node_snapshots/i.test(q)) {
                return { results: args.map((id) => rows.get(id)).filter(Boolean) };
            }
            return { results: [] };
        },
    });
    return {
        rows,
        prepare(sql) {
            const q = String(sql).replace(/\s+/g, ' ').trim();
            return {
                bind: (...args) => api(q, args),
                run: () => api(q, []).run(),
                all: () => api(q, []).all(),
                first: () => api(q, []).first(),
            };
        },
    };
}

const SUB = {
    id: 'sub-1',
    name: 'Airport',
    url: 'https://example.com/sub',
    enabled: true,
    autoUpdate: true,
};

const D1_SETTINGS = {
    storageType: 'd1',
    enableNodePersistence: true,
    autoUpdateInterval: 0,
};

describe('D1 节点持久化服务（单行快照）', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('能力判断要求绑定 D1 且主存储为 d1', () => {
        expect(getNodePersistenceCapabilities({}, { storageType: 'kv' })).toMatchObject({
            hasD1: false,
            available: false,
            enabled: false,
        });

        const env = { MISUB_DB: createD1() };
        expect(isNodePersistenceEnabled(env, { storageType: 'kv', enableNodePersistence: true })).toBe(
            false
        );
        expect(
            isNodePersistenceEnabled(env, { storageType: 'd1', enableNodePersistence: true })
        ).toBe(true);
    });

    it('配置指纹会随过滤/算子变化', () => {
        const base = buildNodeConfigFingerprint(SUB);
        expect(buildNodeConfigFingerprint({ ...SUB })).toBe(base);
        expect(buildNodeConfigFingerprint({ ...SUB, exclude: 'HK' })).not.toBe(base);
    });

    it('刷新成功后写入 ready 快照，订阅组可直接读取', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response('trojan://pass@a.example:443#HK\nss://b@b.example:443#JP', {
                        status: 200,
                        headers: { 'subscription-userinfo': 'upload=1; download=2; total=10' },
                    })
            )
        );
        const env = { MISUB_DB: createD1() };

        const result = await refreshSubscriptionSnapshot(env, SUB, { reason: 'test' });
        expect(result.success).toBe(true);
        expect(result.nodeCount).toBe(2);

        const snapshot = await getNodeSnapshotForOutput(env, SUB);
        expect(snapshot).toMatchObject({ nodeCount: 2 });
        expect(snapshot.userInfo).toEqual({ upload: 1, download: 2, total: 10 });
    });

    it('入库前按机场订阅的 exclude 过滤，不保存垃圾节点', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        'trojan://p@hk.example:443#%F0%9F%87%AD%F0%9F%87%B0%20%E9%A6%99%E6%B8%AF01\ntrojan://p@us.example:443#%F0%9F%87%BA%F0%9F%87%B8%20%E7%BE%8E%E5%9B%BD01',
                        { status: 200 }
                    )
            )
        );
        const env = { MISUB_DB: createD1() };
        await refreshSubscriptionSnapshot(env, { ...SUB, exclude: '香港' });

        const snapshot = await getNodeSnapshotForOutput(env, { ...SUB, exclude: '香港' });
        expect(snapshot.nodeCount).toBe(1);
        expect(snapshot.nodes[0]).toContain('us.example');
    });

    it('刷新失败时保留旧快照，不会清空节点', async () => {
        const env = { MISUB_DB: createD1() };
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('trojan://pass@a.example:443#HK', { status: 200 }))
        );
        await refreshSubscriptionSnapshot(env, SUB);

        vi.stubGlobal('fetch', vi.fn(async () => new Response('Forbidden', { status: 403 })));
        const failed = await refreshSubscriptionSnapshot(env, SUB);
        expect(failed.success).toBe(false);

        const snapshot = await getNodeSnapshotForOutput(env, SUB);
        expect(snapshot.nodeCount).toBe(1);
    });

    it('一个订阅只保留一行（重复刷新覆盖而非新增）', async () => {
        const env = { MISUB_DB: createD1() };
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('trojan://pass@a.example:443#HK', { status: 200 }))
        );
        await refreshSubscriptionSnapshot(env, SUB);
        await refreshSubscriptionSnapshot(env, { ...SUB, name: 'renamed' });
        expect(env.MISUB_DB.rows.size).toBe(1);
    });

    it('间隔为 0 时不自动刷新；force 时仍可刷新（Cron 语义）', async () => {
        const env = { MISUB_DB: createD1() };
        const fetchMock = vi.fn(
            async () => new Response('trojan://pass@a.example:443#HK', { status: 200 })
        );
        vi.stubGlobal('fetch', fetchMock);

        const skipped = await maybeRefreshDueNodes(
            { env, config: { ...D1_SETTINGS, autoUpdateInterval: 0 } },
            [SUB]
        );
        expect(skipped.skipped).toBe(true);
        expect(skipped.reason).toBe('interval-zero');
        expect(fetchMock).not.toHaveBeenCalled();

        const forced = await maybeRefreshDueNodes({ env, config: D1_SETTINGS }, [SUB], {
            force: true,
        });
        expect(forced.scheduled).toBe(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('自动刷新尊重单订阅 autoUpdate=false', async () => {
        const env = { MISUB_DB: createD1() };
        const fetchMock = vi.fn(
            async () => new Response('trojan://pass@a.example:443#HK', { status: 200 })
        );
        vi.stubGlobal('fetch', fetchMock);

        const result = await maybeRefreshDueNodes(
            { env, config: { ...D1_SETTINGS, autoUpdateInterval: 5 } },
            [{ ...SUB, autoUpdate: false }]
        );
        expect(result.skipped).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
