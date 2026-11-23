import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import { D1NodeStore, ensureD1Schema, splitNodesIntoChunks } from '../../functions/storage-adapter.js';
import { refreshSubscriptionSnapshot } from '../../functions/services/node-persistence-service.js';

const SUB = { id: 'sub-big', name: 'Big Airport', url: 'https://big.example/sub', enabled: true };

function makeNodes(count, tag = 'x') {
    return Array.from(
        { length: count },
        (_, index) =>
            `trojan://pass${index}@node${index}.example.com:443#Node-${tag}-${index}-${'y'.repeat(20)}`
    );
}

let mf;

beforeAll(async () => {
    mf = new Miniflare({
        modules: true,
        script: "export default { async fetch() { return new Response('ok'); } }",
        d1Databases: { DB: 'misub-chunk-test' },
    });
});

afterAll(async () => {
    if (mf) await mf.dispose();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('节点快照分片（超大订阅）', () => {
    it('splitter 会按字节切分并在超出上限时抛错', () => {
        const nodes = makeNodes(20);
        const chunks = splitNodesIntoChunks(nodes, 200);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.flatMap((chunk) => JSON.parse(chunk))).toHaveLength(20);
        expect(() => splitNodesIntoChunks(nodes, 200, 2)).toThrow(/分片上限/);
    });

    it('节点太多时自动落分片，读取时合并回完整列表', async () => {
        const db = await mf.getD1Database('DB');
        await ensureD1Schema(db);
        const env = { MISUB_DB: db };
        const nodes = makeNodes(6000, 'big');

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(nodes.join('\n'), { status: 200 }))
        );

        const result = await refreshSubscriptionSnapshot(env, SUB);
        expect(result.success).toBe(true);
        expect(result.nodeCount).toBe(6000);

        const row = await db
            .prepare('SELECT * FROM subscription_node_snapshots WHERE subscription_id = ?')
            .bind(SUB.id)
            .first();
        expect(Number(row.chunk_count)).toBeGreaterThan(1);
        expect(row.nodes_json).toBe('[]');

        const chunkRows = await db
            .prepare('SELECT * FROM subscription_node_snapshot_chunks WHERE subscription_id = ?')
            .bind(SUB.id)
            .all();
        expect(chunkRows.results.length).toBe(Number(row.chunk_count));

        const store = new D1NodeStore(db);
        const snapshot = await store.getSnapshot(SUB.id);
        expect(JSON.parse(snapshot.nodes_json)).toHaveLength(6000);
        expect(Number(snapshot.node_count)).toBe(6000);
    });

    it('刷新变小后清掉分片，回到单行内联', async () => {
        const db = await mf.getD1Database('DB');
        const env = { MISUB_DB: db };
        const small = makeNodes(2, 'small');

        // 直接造一份"分片 + node_count=2"的快照，避免触发骤降保护
        await db
            .prepare(
                `INSERT OR REPLACE INTO subscription_node_snapshots
                 (subscription_id, config_fingerprint, state, nodes_json, node_count, chunk_count, last_success_at, last_attempt_at)
                 VALUES (?, 'seed', 'ready', '[]', 2, 2, '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')`
            )
            .bind(SUB.id)
            .run();
        for (let index = 0; index < 2; index += 1) {
            await db
                .prepare(
                    'INSERT OR REPLACE INTO subscription_node_snapshot_chunks (subscription_id, chunk_index, nodes_json) VALUES (?, ?, ?)'
                )
                .bind(SUB.id, index, JSON.stringify([small[index]]))
                .run();
        }

        vi.stubGlobal('fetch', vi.fn(async () => new Response(small.join('\n'), { status: 200 })));

        const result = await refreshSubscriptionSnapshot(env, SUB);
        expect(result.success).toBe(true);

        const row = await db
            .prepare('SELECT * FROM subscription_node_snapshots WHERE subscription_id = ?')
            .bind(SUB.id)
            .first();
        expect(Number(row.chunk_count)).toBe(0);
        expect(JSON.parse(row.nodes_json)).toHaveLength(2);

        const chunkRows = await db
            .prepare('SELECT * FROM subscription_node_snapshot_chunks WHERE subscription_id = ?')
            .bind(SUB.id)
            .all();
        expect(chunkRows.results.length).toBe(0);
    });

    it('分片数据在刷新失败时原样保留', async () => {
        const db = await mf.getD1Database('DB');
        const env = { MISUB_DB: db };
        const nodes = makeNodes(6000, 'keep');
        vi.stubGlobal('fetch', vi.fn(async () => new Response(nodes.join('\n'), { status: 200 })));
        await refreshSubscriptionSnapshot(env, SUB);

        vi.stubGlobal('fetch', vi.fn(async () => new Response('Forbidden', { status: 403 })));
        const failed = await refreshSubscriptionSnapshot(env, SUB);
        expect(failed.success).toBe(false);

        const store = new D1NodeStore(db);
        const snapshot = await store.getSnapshot(SUB.id);
        expect(JSON.parse(snapshot.nodes_json)).toHaveLength(6000);
        expect(snapshot.last_error).toBeTruthy();
    });
});
