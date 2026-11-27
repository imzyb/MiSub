import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCombinedNodeList } from '../../functions/services/subscription-service.js';
import {
    ensureSnapshotForOutput,
    refreshSubscriptionSnapshot,
} from '../../functions/services/node-persistence-service.js';

function createD1() {
    const rows = new Map();
    const api = (q, args) => ({
        async run() {
            if (/^CREATE /i.test(q) || /^ALTER /i.test(q) || /^DROP /i.test(q)) return { success: true };
            if (/^INSERT INTO subscription_node_snapshots/i.test(q)) {
                const [id, fp, state, nodesJson, count, userJson, lastOk, lastTry, lastErr] = args;
                rows.set(id, {
                    subscription_id: id, config_fingerprint: fp, state,
                    nodes_json: nodesJson, node_count: count, user_info_json: userJson,
                    last_success_at: lastOk, last_attempt_at: lastTry, last_error: lastErr,
                });
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
            return { bind: (...a) => api(q, a), run: () => api(q, []).run(), all: () => api(q, []).all(), first: () => api(q, []).first() };
        },
    };
}

const SUB = { id: 'sub-1', name: 'Airport', url: 'https://example.com/sub', enabled: true };
const CONFIG = {
    storageType: 'd1',
    enableNodePersistence: true,
    autoUpdateInterval: 0,
    enableAccessLog: false,
    enableFlagEmoji: false,
};

function makeStorage() {
    const writes = [];
    return {
        writes,
        async get() { return null; },
        async put(key) { writes.push(key); return true; },
        async getAllSubscriptions() { return [SUB]; },
    };
}

describe('节点持久化：首次访问才拉取（懒初始化）', () => {
    let fetchCalls = 0;

    beforeEach(() => {
        fetchCalls = 0;
        globalThis.fetch = vi.fn(async () => {
            fetchCalls += 1;
            return new Response('trojan://pass@a.example:443#HK', { status: 200 });
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('数据库为空时，首次订阅组访问拉取一次并入库并直接返回节点', async () => {
        const env = { MISUB_DB: createD1() };
        const storage = makeStorage();
        const context = { env, storage, config: CONFIG, waitUntil: () => {} };

        const first = await generateCombinedNodeList(
            context, CONFIG, 'ClashMeta', [SUB], '', { enableSubscriptions: false }, false
        );
        expect(fetchCalls).toBe(1);
        expect(first.trim()).toBe('trojan://pass@a.example:443#HK');

        const second = await generateCombinedNodeList(
            context, CONFIG, 'ClashMeta', [SUB], '', { enableSubscriptions: false }, false
        );
        expect(fetchCalls).toBe(1);
        expect(second.trim()).toBe('trojan://pass@a.example:443#HK');
        // 订阅行不回写
        expect(storage.writes).toEqual([]);
    });

    it('懒初始化失败后 5 分钟内不重复打机场', async () => {
        const env = { MISUB_DB: createD1() };
        let calls = 0;
        globalThis.fetch = vi.fn(async () => {
            calls += 1;
            return new Response('Forbidden', { status: 403 });
        });

        expect(await ensureSnapshotForOutput(env, SUB)).toBeNull();
        expect(calls).toBe(1);
        expect(await ensureSnapshotForOutput(env, SUB)).toBeNull();
        expect(calls).toBe(1);
    });

    it('配置指纹变化时会重新拉取并覆盖同一行', async () => {
        const env = { MISUB_DB: createD1() };
        await refreshSubscriptionSnapshot(env, SUB);
        const before = fetchCalls;
        await ensureSnapshotForOutput(env, { ...SUB, exclude: '香港' });
        expect(fetchCalls).toBe(before + 1);
        expect(env.MISUB_DB.rows.size).toBe(1);
    });
});
