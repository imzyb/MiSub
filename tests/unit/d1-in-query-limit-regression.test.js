import { describe, it, expect } from 'vitest';
import { StorageFactory, STORAGE_TYPES } from '../../functions/storage-adapter.js';

/**
 * D1 对单条 SQL 语句有 100 个绑定变量的硬上限。
 * 当一个订阅组引用的节点/订阅数量超过该上限时，
 * `SELECT ... WHERE id IN (?, ?, ...)` 会抛出
 * "too many SQL variables" 并使整条查询失败，
 * 最终导致订阅链接返回 "# No valid proxies found"。
 *
 * 该回归测试校验适配器会分片查询，从而支持任意数量的 ID。
 */

const D1_MAX_VARIABLES = 100;

/**
 * 构造一个模拟 D1 database：严格模拟真实 D1 的绑定变量上限，
 * 超过 100 个变量时抛错（与生产环境行为一致）。
 */
function createMockD1(rows) {
    const calls = [];
    const db = {
        prepare(sql) {
            const placeholders = (sql.match(/\?/g) || []).length;
            const record = { sql, placeholders, bindings: null };
            calls.push(record);
            return {
                bind(...args) {
                    record.bindings = args;
                    if (args.length > D1_MAX_VARIABLES) {
                        throw new Error(
                            `too many SQL variables at offset ${args.length}: SQLITE_ERROR`
                        );
                    }
                    return this;
                },
                async all() {
                    const ids = new Set(record.bindings || []);
                    return {
                        results: rows
                            .filter((row) => ids.has(row.id))
                            .map((row) => ({
                                data: JSON.stringify(row.data),
                            })),
                    };
                },
                async first() {
                    const ids = new Set(record.bindings || []);
                    const hit = rows.find((row) => ids.has(row.id));
                    return hit ? { data: JSON.stringify(hit.data) } : null;
                },
            };
        },
    };
    return { db, calls };
}

function buildRows(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `node_${i}`,
        data: { id: `node_${i}`, name: `节点 ${i}`, url: `vless://uuid@host${i}:443` },
    }));
}

describe('D1 getSubscriptionsByIds handles more than 100 bound variables', () => {
    it('returns all rows for a profile referencing 200 nodes (regression)', async () => {
        const rows = buildRows(200);
        const { db, calls } = createMockD1(rows);
        const adapter = StorageFactory.createAdapter({ MISUB_DB: db }, STORAGE_TYPES.D1);

        const ids = rows.map((row) => row.id);
        const result = await adapter.getSubscriptionsByIds(ids);

        expect(result).toHaveLength(200);
        expect(result.map((item) => item.id).sort()).toEqual([...ids].sort());
        // 每条查询都必须在 D1 的变量上限之内
        for (const call of calls) {
            expect(call.placeholders).toBeLessThanOrEqual(D1_MAX_VARIABLES);
        }
        // 应当发生多次查询（分片），而不是一条超限语句
        const dataQueries = calls.filter((call) => call.sql.includes('id IN'));
        expect(dataQueries.length).toBeGreaterThan(1);
    });

    it('still works for a small id list (single chunk)', async () => {
        const rows = buildRows(5);
        const { db } = createMockD1(rows);
        const adapter = StorageFactory.createAdapter({ MISUB_DB: db }, STORAGE_TYPES.D1);

        const result = await adapter.getSubscriptionsByIds(rows.map((row) => row.id));
        expect(result).toHaveLength(5);
    });

    it('deduplicates repeated ids before querying', async () => {
        const rows = buildRows(3);
        const { db, calls } = createMockD1(rows);
        const adapter = StorageFactory.createAdapter({ MISUB_DB: db }, STORAGE_TYPES.D1);

        const result = await adapter.getSubscriptionsByIds([
            'node_0',
            'node_0',
            'node_1',
            'node_2',
            'node_2',
        ]);
        expect(result).toHaveLength(3);
        const dataQueries = calls.filter((call) => call.sql.includes('id IN'));
        expect(dataQueries[0].placeholders).toBe(3);
    });

    it('returns empty array for empty input', async () => {
        const { db } = createMockD1([]);
        const adapter = StorageFactory.createAdapter({ MISUB_DB: db }, STORAGE_TYPES.D1);
        await expect(adapter.getSubscriptionsByIds([])).resolves.toEqual([]);
    });
});
