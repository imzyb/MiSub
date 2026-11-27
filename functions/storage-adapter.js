/**
 * 数据存储抽象层
 * 支持 KV 和 D1 两种存储方式
 * 根据设置自动选择存储类型
 */

// 存储类型常量
export const STORAGE_TYPES = {
    KV: 'kv',
    D1: 'd1',
};

// 数据键映射
const DATA_KEYS = {
    SUBSCRIPTIONS: 'misub_subscriptions_v1',
    PROFILES: 'misub_profiles_v1',
    SETTINGS: 'worker_settings_v1',
    PROFILE_DOWNLOAD_COUNT_PREFIX: 'misub_profile_download_count_',
};

const D1_COLLECTION_CACHE_TTL_MS = 30 * 1000;
const d1CollectionCaches = new WeakMap();

function getD1CollectionCache(database) {
    let cache = d1CollectionCaches.get(database);
    if (!cache) {
        cache = new Map();
        d1CollectionCaches.set(database, cache);
    }
    return cache;
}

function invalidateD1CollectionCache(database, table) {
    getD1CollectionCache(database).delete(table);
}

async function readCachedD1Collection(database, table, loader) {
    const cache = getD1CollectionCache(database);
    const now = Date.now();
    const existing = cache.get(table);
    if (existing && now - existing.timestamp < D1_COLLECTION_CACHE_TTL_MS) {
        return structuredClone(await existing.promise);
    }

    const promise = Promise.resolve().then(loader);
    cache.set(table, { timestamp: now, promise });
    try {
        return structuredClone(await promise);
    } catch (error) {
        if (cache.get(table)?.promise === promise) cache.delete(table);
        throw error;
    }
}

// 单条订阅的节点列表可能超过 D1 单行容量：超过阈值时切成多行分片存储。
const SNAPSHOT_CHUNK_BYTES = 256 * 1024;
const MAX_SNAPSHOT_CHUNKS = 80;

const SNAPSHOT_TABLE_DDL = [
    `CREATE TABLE IF NOT EXISTS subscription_node_snapshots (
        subscription_id TEXT PRIMARY KEY,
        config_fingerprint TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending',
        nodes_json TEXT NOT NULL DEFAULT '[]',
        node_count INTEGER NOT NULL DEFAULT 0,
        user_info_json TEXT,
        last_success_at DATETIME,
        last_attempt_at DATETIME,
        last_error TEXT,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_node_snapshots_refresh ON subscription_node_snapshots(last_success_at);`,
    `CREATE TABLE IF NOT EXISTS subscription_node_snapshot_chunks (
        subscription_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        nodes_json TEXT NOT NULL,
        PRIMARY KEY (subscription_id, chunk_index)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_node_snapshot_chunks_sub ON subscription_node_snapshot_chunks(subscription_id);`,
];

const D1_SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_at ON subscriptions(updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);`,
    ...SNAPSHOT_TABLE_DDL,
];

/** 老库补 chunk_count 列（SQLite 不支持 IF NOT EXISTS 的 ADD COLUMN） */
async function migrateSnapshotChunkColumn(d1Db) {
    try {
        const info = await d1Db.prepare('PRAGMA table_info("subscription_node_snapshots")').all();
        const columns = (info?.results || []).map((row) => row.name);
        if (columns.length > 0 && !columns.includes('chunk_count')) {
            await d1Db
                .prepare(
                    'ALTER TABLE subscription_node_snapshots ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0'
                )
                .run();
        }
    } catch (error) {
        console.warn('[D1] Snapshot chunk column migration skipped:', error?.message || error);
    }
}

/** 按字节把节点数组切成若干 JSON 数组字符串 */
export function splitNodesIntoChunks(nodes, maxBytes = SNAPSHOT_CHUNK_BYTES, maxChunks = MAX_SNAPSHOT_CHUNKS) {
    const encoder = new TextEncoder();
    const byteLength = (text) => encoder.encode(text).length;
    const chunks = [];
    let current = [];
    let currentBytes = 2; // []

    const flush = () => {
        if (current.length === 0) return;
        chunks.push(JSON.stringify(current));
        if (chunks.length > maxChunks) {
            throw new Error(`节点数量超出分片上限（${maxChunks} 片），无法写入快照`);
        }
        current = [];
        currentBytes = 2;
    };

    for (const node of nodes) {
        const nodeText = JSON.stringify(node);
        const nodeBytes = byteLength(nodeText);
        const extra = current.length > 0 ? nodeBytes + 1 : nodeBytes;
        if (current.length > 0 && currentBytes + extra > maxBytes) flush();
        current.push(node);
        currentBytes += current.length > 1 ? nodeBytes + 1 : nodeBytes;
    }
    flush();
    return chunks.length > 0 ? chunks : ['[]'];
}

/**
 * 以 settings 表为家的已知业务键。
 * D1StorageAdapter._parseKey 靠它区分「预期的业务键」与「真正的未知 key」，
 * 后者才告警。与 D1_MIGRATION_KEYS 保持一致。
 */
const D1_KNOWN_SETTINGS_KEYS = new Set([
    'misub_dns_templates_v1',
    'misub_rule_templates_v1',
    'misub_clients_v1',
    'misub_guestbook_v1',
    'misub_settings_v1',
    'misub_restore_snapshot_latest',
]);

const d1SchemaPromises = new WeakMap();

/**
 * 早期版本用 (subscription_id, config_fingerprint) 复合主键，会按配置分多行。
 * 现在的模型是「一个订阅只留最后一次数据」，这里把旧表压成单行。
 */
async function migrateLegacySnapshotTable(d1Db) {
    try {
        const table = await d1Db
            .prepare(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'subscription_node_snapshots'"
            )
            .first();
        const sql = String(table?.sql || '');
        if (!/PRIMARY KEY\s*\(\s*subscription_id\s*,\s*config_fingerprint\s*\)/i.test(sql)) {
            return;
        }

        await d1Db
            .prepare('ALTER TABLE subscription_node_snapshots RENAME TO subscription_node_snapshots_legacy')
            .run();
        for (const statement of SNAPSHOT_TABLE_DDL) {
            await d1Db.prepare(statement).run();
        }
        await d1Db
            .prepare(
                `INSERT OR REPLACE INTO subscription_node_snapshots
                 (subscription_id, config_fingerprint, state, nodes_json, node_count, user_info_json,
                  last_success_at, last_attempt_at, last_error, updated_at)
                 SELECT subscription_id, config_fingerprint, state, nodes_json, node_count, user_info_json,
                        last_success_at, last_attempt_at, last_error, updated_at
                 FROM subscription_node_snapshots_legacy AS legacy
                 WHERE COALESCE(legacy.last_attempt_at, '') = (
                     SELECT MAX(COALESCE(x.last_attempt_at, ''))
                     FROM subscription_node_snapshots_legacy AS x
                     WHERE x.subscription_id = legacy.subscription_id
                 )`
            )
            .run();
        await d1Db.prepare('DROP TABLE subscription_node_snapshots_legacy').run();
    } catch (error) {
        console.warn('[D1] Snapshot table migration skipped:', error?.message || error);
    }
}

export function ensureD1Schema(d1Db) {
    if (!d1Db) return Promise.reject(new Error('D1 database not available'));
    let promise = d1SchemaPromises.get(d1Db);
    if (!promise) {
        promise = (async () => {
            for (const statement of D1_SCHEMA_STATEMENTS) {
                await d1Db.prepare(statement).run();
            }
            await migrateLegacySnapshotTable(d1Db);
            await migrateSnapshotChunkColumn(d1Db);
        })();
        d1SchemaPromises.set(d1Db, promise);
        promise.catch(() => d1SchemaPromises.delete(d1Db));
    }
    return promise;
}

/**
 * KV 存储适配器
 */
class KVStorageAdapter {
    constructor(kvNamespace) {
        this.kv = kvNamespace;
        this.type = STORAGE_TYPES.KV;
    }

    async get(key) {
        try {
            const raw = await this.kv.get(key);
            if (raw === null || raw === undefined) return null;
            try {
                return JSON.parse(raw);
            } catch {
                return raw;
            }
        } catch (error) {
            console.error(`[KV] Failed to get key ${key}:`, error);
            return null;
        }
    }

    async put(key, value) {
        try {
            const data = typeof value === 'string' ? value : JSON.stringify(value);
            await this.kv.put(key, data);
            return true;
        } catch (error) {
            console.error(`[KV] Failed to put key ${key}:`, error);
            throw error;
        }
    }

    async delete(key) {
        try {
            await this.kv.delete(key);
            return true;
        } catch (error) {
            console.error(`[KV] Failed to delete key ${key}:`, error);
            throw error;
        }
    }

    async list(prefix) {
        try {
            const result = await this.kv.list({ prefix });
            return result.keys || [];
        } catch (error) {
            console.error(`[KV] Failed to list keys with prefix ${prefix}:`, error);
            return [];
        }
    }

    async getSubscriptionById(id) {
        const all = await this.get(DATA_KEYS.SUBSCRIPTIONS);
        return Array.isArray(all) ? all.find((item) => item.id === id) || null : null;
    }

    async getAllSubscriptions() {
        const all = await this.get(DATA_KEYS.SUBSCRIPTIONS);
        return Array.isArray(all) ? all : [];
    }

    async getProfileById(id) {
        const all = await this.get(DATA_KEYS.PROFILES);
        return Array.isArray(all)
            ? all.find((item) => item.id === id || item.customId === id || item.linkId === id) ||
                  null
            : null;
    }

    async getAllProfiles() {
        const all = await this.get(DATA_KEYS.PROFILES);
        return Array.isArray(all) ? all : [];
    }

    async updateSubscriptionById(id, updater) {
        const all = (await this.get(DATA_KEYS.SUBSCRIPTIONS)) || [];
        const index = all.findIndex((item) => item.id === id);
        if (index === -1) return null;
        const updated = updater({ ...all[index] });
        all[index] = updated;
        await this.put(DATA_KEYS.SUBSCRIPTIONS, all);
        return updated;
    }

    async putSubscription(item) {
        const all = await this.getAllSubscriptions();
        const index = all.findIndex((entry) => entry.id === item.id);
        if (index === -1) {
            all.push(item);
        } else {
            all[index] = item;
        }
        await this.put(DATA_KEYS.SUBSCRIPTIONS, all);
        return item;
    }

    async deleteSubscriptionById(id) {
        const all = await this.getAllSubscriptions();
        const filtered = all.filter((item) => item.id !== id);
        await this.put(DATA_KEYS.SUBSCRIPTIONS, filtered);
        return filtered.length !== all.length;
    }

    async putProfile(item) {
        const all = await this.getAllProfiles();
        const index = all.findIndex((entry) => entry.id === item.id);
        if (index === -1) {
            all.push(item);
        } else {
            all[index] = item;
        }
        await this.put(DATA_KEYS.PROFILES, all);
        return item;
    }

    async deleteProfileById(id) {
        const all = await this.getAllProfiles();
        const filtered = all.filter((item) => item.id !== id);
        await this.put(DATA_KEYS.PROFILES, filtered);
        return filtered.length !== all.length;
    }

    async getSubscriptionsByIds(ids = []) {
        const all = (await this.get(DATA_KEYS.SUBSCRIPTIONS)) || [];
        const idSet = new Set(ids);
        return all.filter((item) => idSet.has(item.id));
    }

    async putAllSubscriptions(items) {
        return this.put(DATA_KEYS.SUBSCRIPTIONS, items);
    }

    async putAllProfiles(items) {
        return this.put(DATA_KEYS.PROFILES, items);
    }
}

/**
 * D1 存储适配器
 */
class D1StorageAdapter {
    constructor(d1Database) {
        this.db = d1Database;
        this.type = STORAGE_TYPES.D1;
    }

    async get(key, type = 'json') {
        try {
            // 根据 key 确定查询的表和字段
            const { table, queryField, queryValue } = this._parseKey(key);

            const result = await this.db
                .prepare(
                    `SELECT ${table === 'settings' ? 'value as data' : 'data'} FROM ${table} WHERE ${queryField} = ?`
                )
                .bind(queryValue)
                .first();

            if (!result) return null;

            return type === 'json' ? JSON.parse(result.data) : result.data;
        } catch (error) {
            // 如果是表不存在的错误，说明 D1 还未初始化或未被使用，直接返回 null
            if (error.message && error.message.includes('no such table')) {
                return null;
            }
            console.error(`[D1] Failed to get key ${key}:`, error);
            return null;
        }
    }

    async put(key, value) {
        try {
            const { table, queryField, queryValue } = this._parseKey(key);
            const data = typeof value === 'string' ? value : JSON.stringify(value);

            if (table === 'settings') {
                // settings 表使用 key-value 结构
                await this.db
                    .prepare(
                        `
                    INSERT OR REPLACE INTO ${table} (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `
                    )
                    .bind(queryValue, data)
                    .run();
            } else {
                // subscriptions 和 profiles 表使用 id-data 结构
                await this.db
                    .prepare(
                        `
                    INSERT OR REPLACE INTO ${table} (id, data, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `
                    )
                    .bind(queryValue, data)
                    .run();
            }

            if (table === 'subscriptions' || table === 'profiles') {
                invalidateD1CollectionCache(this.db, table);
            }
            return true;
        } catch (error) {
            console.error(`[D1] Failed to put key ${key}:`, error);
            throw error;
        }
    }

    async delete(key) {
        try {
            const { table, queryField, queryValue } = this._parseKey(key);

            await this.db
                .prepare(`DELETE FROM ${table} WHERE ${queryField} = ?`)
                .bind(queryValue)
                .run();

            if (table === 'subscriptions' || table === 'profiles') {
                invalidateD1CollectionCache(this.db, table);
            }
            return true;
        } catch (error) {
            console.error(`[D1] Failed to delete key ${key}:`, error);
            throw error;
        }
    }

    async list(prefix) {
        try {
            // D1 中的 list 操作需要根据前缀查询相应的表
            const tables = [
                { name: 'subscriptions', keyField: 'id' },
                { name: 'profiles', keyField: 'id' },
                { name: 'settings', keyField: 'key' },
            ];
            const keys = [];
            const effectivePrefix = prefix || '';
            const matchesKnownKey =
                DATA_KEYS.SUBSCRIPTIONS.startsWith(effectivePrefix) ||
                DATA_KEYS.PROFILES.startsWith(effectivePrefix) ||
                DATA_KEYS.SETTINGS.startsWith(effectivePrefix) ||
                effectivePrefix.startsWith(DATA_KEYS.SUBSCRIPTIONS) ||
                effectivePrefix.startsWith(DATA_KEYS.PROFILES) ||
                effectivePrefix.startsWith(DATA_KEYS.SETTINGS);

            const shouldQuerySubscriptions =
                !effectivePrefix || effectivePrefix.startsWith(DATA_KEYS.SUBSCRIPTIONS);
            const shouldQueryProfiles =
                !effectivePrefix || effectivePrefix.startsWith(DATA_KEYS.PROFILES);
            const shouldQuerySettings =
                !effectivePrefix ||
                !matchesKnownKey ||
                effectivePrefix.startsWith(DATA_KEYS.SETTINGS);

            for (const table of tables) {
                if (table.name === 'subscriptions' && !shouldQuerySubscriptions) continue;
                if (table.name === 'profiles' && !shouldQueryProfiles) continue;
                if (table.name === 'settings' && !shouldQuerySettings) continue;

                let results;
                if (table.name === 'settings' && effectivePrefix) {
                    results = await this.db
                        .prepare(
                            `SELECT ${table.keyField} FROM ${table.name} WHERE ${table.keyField} LIKE ?`
                        )
                        .bind(`${effectivePrefix}%`)
                        .all();
                } else {
                    results = await this.db
                        .prepare(`SELECT ${table.keyField} FROM ${table.name}`)
                        .all();
                }

                results.results.forEach((row) => {
                    const key = this._buildKey(table.name, row[table.keyField]);
                    if (key.startsWith(effectivePrefix)) {
                        keys.push({ name: key });
                    }
                });
            }

            return keys;
        } catch (error) {
            console.error(`[D1] Failed to list keys with prefix ${prefix}:`, error);
            return [];
        }
    }

    async getSubscriptionById(id) {
        try {
            const result = await this.db
                .prepare('SELECT data FROM subscriptions WHERE id = ?')
                .bind(id)
                .first();
            if (result) return JSON.parse(result.data);

            const legacyMain = await this.db
                .prepare('SELECT data FROM subscriptions WHERE id = ?')
                .bind('main')
                .first();
            if (!legacyMain) return null;
            const parsed = JSON.parse(legacyMain.data);
            return Array.isArray(parsed) ? parsed.find((item) => item.id === id) || null : null;
        } catch (error) {
            console.error(`[D1] Failed to get subscription ${id}:`, error);
            return null;
        }
    }

    async getAllSubscriptions() {
        return readCachedD1Collection(this.db, 'subscriptions', async () => {
            try {
                const results = await this.db.prepare('SELECT data FROM subscriptions').all();
                if (!Array.isArray(results?.results)) return [];

                const all = [];
                results.results.forEach((row) => {
                    const parsed = JSON.parse(row.data);
                    if (Array.isArray(parsed)) {
                        all.push(...parsed);
                    } else if (parsed) {
                        all.push(parsed);
                    }
                });

                const deduped = new Map();
                all.forEach((item) => {
                    if (item?.id) deduped.set(item.id, item);
                });
                return Array.from(deduped.values()).sort(
                    (a, b) => (a.sortIndex || 0) - (b.sortIndex || 0)
                );
            } catch (error) {
                invalidateD1CollectionCache(this.db, 'subscriptions');
                console.error('[D1] Failed to get all subscriptions:', error);
                return [];
            }
        });
    }

    async getProfileById(id) {
        try {
            const result = await this.db
                .prepare('SELECT data FROM profiles WHERE id = ?')
                .bind(id)
                .first();
            if (result) return JSON.parse(result.data);

            const legacyMain = await this.db
                .prepare('SELECT data FROM profiles WHERE id = ?')
                .bind('main')
                .first();
            const allProfiles = legacyMain
                ? JSON.parse(legacyMain.data)
                : await this.get(DATA_KEYS.PROFILES);
            return Array.isArray(allProfiles)
                ? allProfiles.find(
                      (item) => item.id === id || item.customId === id || item.linkId === id
                  ) || null
                : null;
        } catch (error) {
            console.error(`[D1] Failed to get profile ${id}:`, error);
            return null;
        }
    }

    async getAllProfiles() {
        return readCachedD1Collection(this.db, 'profiles', async () => {
            try {
                const results = await this.db.prepare('SELECT data FROM profiles').all();
                if (!Array.isArray(results?.results)) return [];

                const all = [];
                results.results.forEach((row) => {
                    const parsed = JSON.parse(row.data);
                    if (Array.isArray(parsed)) {
                        all.push(...parsed);
                    } else if (parsed) {
                        all.push(parsed);
                    }
                });

                const deduped = new Map();
                all.forEach((item) => {
                    if (item?.id) deduped.set(item.id, item);
                });
                return Array.from(deduped.values()).sort(
                    (a, b) => (a.sortIndex || 0) - (b.sortIndex || 0)
                );
            } catch (error) {
                invalidateD1CollectionCache(this.db, 'profiles');
                console.error('[D1] Failed to get all profiles:', error);
                return [];
            }
        });
    }

    async updateSubscriptionById(id, updater) {
        const existing = await this.getSubscriptionById(id);
        if (!existing) return null;
        const updated = updater({ ...existing });
        await this.db
            .prepare(
                `
            INSERT OR REPLACE INTO subscriptions (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `
            )
            .bind(id, JSON.stringify(updated))
            .run();
        invalidateD1CollectionCache(this.db, 'subscriptions');
        return updated;
    }

    async putSubscription(item) {
        await this.db
            .prepare(
                `
            INSERT OR REPLACE INTO subscriptions (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `
            )
            .bind(item.id, JSON.stringify(item))
            .run();
        invalidateD1CollectionCache(this.db, 'subscriptions');
        return item;
    }

    async deleteSubscriptionById(id) {
        const result = await this.db
            .prepare('DELETE FROM subscriptions WHERE id = ?')
            .bind(id)
            .run();
        invalidateD1CollectionCache(this.db, 'subscriptions');
        return Boolean(result?.success);
    }

    async putProfile(item) {
        await this.db
            .prepare(
                `
            INSERT OR REPLACE INTO profiles (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `
            )
            .bind(item.id, JSON.stringify(item))
            .run();
        invalidateD1CollectionCache(this.db, 'profiles');
        return item;
    }

    async deleteProfileById(id) {
        const result = await this.db.prepare('DELETE FROM profiles WHERE id = ?').bind(id).run();
        invalidateD1CollectionCache(this.db, 'profiles');
        return Boolean(result?.success);
    }

    async getSubscriptionsByIds(ids = []) {
        if (!Array.isArray(ids) || ids.length === 0) return [];
        // D1 单条 SQL 绑定变量上限为 100，超过会报
        // "too many SQL variables" 而整条查询失败。
        // 因此按 90 一批分片查询，再合并结果（同时保留原有 legacy 'main' 回退）。
        const CHUNK_SIZE = 90;
        const uniqueIds = Array.from(new Set(ids));
        try {
            const directHits = [];
            for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
                const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
                const placeholders = chunk.map(() => '?').join(',');
                const results = await this.db
                    .prepare(`SELECT data FROM subscriptions WHERE id IN (${placeholders})`)
                    .bind(...chunk)
                    .all();
                if (Array.isArray(results?.results)) {
                    directHits.push(...results.results.map((row) => JSON.parse(row.data)));
                }
            }
            const foundIds = new Set(directHits.map((item) => item?.id).filter(Boolean));
            const missingIds = uniqueIds.filter((id) => !foundIds.has(id));

            if (missingIds.length === 0) return directHits;

            const legacyMain = await this.db
                .prepare('SELECT data FROM subscriptions WHERE id = ?')
                .bind('main')
                .first();
            if (!legacyMain) return directHits;

            const parsed = JSON.parse(legacyMain.data);
            if (!Array.isArray(parsed)) return directHits;

            const legacyHits = parsed.filter((item) => missingIds.includes(item.id));
            return [...directHits, ...legacyHits];
        } catch (error) {
            console.error('[D1] Failed to get subscriptions by ids:', error);
            return [];
        }
    }

    async putAllSubscriptions(items) {
        if (!Array.isArray(items)) return false;
        // 使用并行 Promise 提高效率
        await Promise.all(items.map((item) => this.putSubscription(item)));
        return true;
    }

    async putAllProfiles(items) {
        if (!Array.isArray(items)) return false;
        await Promise.all(items.map((item) => this.putProfile(item)));
        return true;
    }

    /**
     * 解析 key，确定对应的表、查询字段和查询值
     */
    _parseKey(key) {
        if (key === DATA_KEYS.SUBSCRIPTIONS) {
            return { table: 'subscriptions', queryField: 'id', queryValue: 'main' };
        } else if (key === DATA_KEYS.PROFILES) {
            return { table: 'profiles', queryField: 'id', queryValue: 'main' };
        } else if (key === DATA_KEYS.SETTINGS) {
            return { table: 'settings', queryField: 'key', queryValue: 'main' };
        } else {
            if (String(key).startsWith(DATA_KEYS.PROFILE_DOWNLOAD_COUNT_PREFIX)) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            if (String(key).startsWith('tmp_external_nodes:')) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            if (String(key).startsWith('misub_guestbook_v1')) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            if (String(key).startsWith('node_cache_')) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            // 这些业务键本来就以 settings 表为家（KV→D1 迁移会主动写它们），
            // 不该走下面那条「未知格式」告警，否则真正的异常 key 会被噪声淹掉。
            if (D1_KNOWN_SETTINGS_KEYS.has(String(key))) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            // 处理其他格式的 key，默认作为 settings 表的 key，但记录警告
            console.warn(`[D1 Storage] Unknown key format: ${key}, treating as settings key`);
            return { table: 'settings', queryField: 'key', queryValue: key };
        }
    }

    /**
     * 构建 key
     */
    _buildKey(table, keyValue) {
        if (table === 'subscriptions' && keyValue === 'main') {
            return DATA_KEYS.SUBSCRIPTIONS;
        } else if (table === 'profiles' && keyValue === 'main') {
            return DATA_KEYS.PROFILES;
        } else if (table === 'settings' && keyValue === 'main') {
            return DATA_KEYS.SETTINGS;
        } else {
            return keyValue;
        }
    }
}

/**
 * D1 节点快照仓库。
 * 节点快照与 subscriptions 表分离，避免把大 JSON 放进主行，
 * 也避免订阅组访问时回写 subscriptions 的运行时字段。
 */
export class D1NodeStore {
    constructor(d1Database) {
        this.db = d1Database;
        this.type = 'd1-node';
    }

    async _ensureSchema() {
        await ensureD1Schema(this.db);
    }

    async getSnapshot(subscriptionId) {
        await this._ensureSchema();
        const row = await this.db
            .prepare('SELECT * FROM subscription_node_snapshots WHERE subscription_id = ?')
            .bind(subscriptionId)
            .first();
        if (!row) return null;

        const chunkCount = Number(row.chunk_count) || 0;
        if (chunkCount <= 0) return row;

        const result = await this.db
            .prepare(
                'SELECT nodes_json FROM subscription_node_snapshot_chunks WHERE subscription_id = ? ORDER BY chunk_index ASC'
            )
            .bind(subscriptionId)
            .all();
        const parts = (result?.results || []).map((item) => item.nodes_json);
        if (parts.length !== chunkCount) {
            return { ...row, nodes_json: '[]', state: 'failed', last_error: '快照分片不完整' };
        }

        try {
            const merged = [];
            for (const part of parts) merged.push(...JSON.parse(part));
            return { ...row, nodes_json: JSON.stringify(merged) };
        } catch {
            return { ...row, nodes_json: '[]', state: 'failed', last_error: '快照分片解析失败' };
        }
    }

    async listSnapshotsFor(subscriptionIds = []) {
        await this._ensureSchema();
        const ids = Array.from(
            new Set((Array.isArray(subscriptionIds) ? subscriptionIds : []).filter(Boolean))
        );
        if (ids.length === 0) return [];
        const rows = [];
        const CHUNK_SIZE = 90;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const placeholders = chunk.map(() => '?').join(',');
            const result = await this.db
                .prepare(
                    `SELECT * FROM subscription_node_snapshots WHERE subscription_id IN (${placeholders})`
                )
                .bind(...chunk)
                .all();
            if (Array.isArray(result?.results)) rows.push(...result.results);
        }
        return rows;
    }

    /**
     * 写入订阅快照。
     * - 单行模型：一个订阅只保留最后一次数据；
     * - 节点太多时自动切成 subscription_node_snapshot_chunks 多行；
     * - last_attempt_at 作为版本号，晚到的旧结果不会覆盖新结果（LWW）。
     */
    async putSnapshot(snapshot = {}) {
        await this._ensureSchema();
        const subscriptionId = snapshot.subscriptionId;
        const attemptAt = snapshot.lastAttemptAt || null;

        // 先做版本预检：旧结果直接放弃，避免"分片已换、主行未换"的错位
        const current = await this.db
            .prepare('SELECT last_attempt_at FROM subscription_node_snapshots WHERE subscription_id = ?')
            .bind(subscriptionId)
            .first();
        if (current && attemptAt && String(current.last_attempt_at || '') > String(attemptAt)) {
            return false;
        }

        const hasNodesArray = Array.isArray(snapshot.nodes);
        const chunks = hasNodesArray ? splitNodesIntoChunks(snapshot.nodes) : [snapshot.nodesJson || '[]'];
        const useChunks = hasNodesArray && chunks.length > 1;
        const inlineJson = useChunks ? '[]' : chunks[0] || '[]';

        const statements = [
            this.db
                .prepare('DELETE FROM subscription_node_snapshot_chunks WHERE subscription_id = ?')
                .bind(subscriptionId),
        ];
        if (useChunks) {
            chunks.forEach((json, index) => {
                statements.push(
                    this.db
                        .prepare(
                            'INSERT INTO subscription_node_snapshot_chunks (subscription_id, chunk_index, nodes_json) VALUES (?, ?, ?)'
                        )
                        .bind(subscriptionId, index, json)
                );
            });
        }
        statements.push(
            this.db
                .prepare(
                    `INSERT INTO subscription_node_snapshots
                     (subscription_id, config_fingerprint, state, nodes_json, node_count, user_info_json,
                      last_success_at, last_attempt_at, last_error, chunk_count, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(subscription_id) DO UPDATE SET
                       config_fingerprint = excluded.config_fingerprint,
                       state = excluded.state,
                       nodes_json = excluded.nodes_json,
                       node_count = excluded.node_count,
                       user_info_json = excluded.user_info_json,
                       last_success_at = excluded.last_success_at,
                       last_attempt_at = excluded.last_attempt_at,
                       last_error = excluded.last_error,
                       chunk_count = excluded.chunk_count,
                       updated_at = CURRENT_TIMESTAMP
                     WHERE COALESCE(excluded.last_attempt_at, '') >= COALESCE(subscription_node_snapshots.last_attempt_at, '')`
                )
                .bind(
                    subscriptionId,
                    snapshot.configFingerprint,
                    snapshot.state || 'pending',
                    inlineJson,
                    Number(snapshot.nodeCount) || 0,
                    snapshot.userInfoJson || null,
                    snapshot.lastSuccessAt || null,
                    attemptAt,
                    snapshot.lastError || null,
                    useChunks ? chunks.length : 0
                )
        );

        if (typeof this.db.batch === 'function') {
            await this.db.batch(statements);
        } else {
            for (const statement of statements) await statement.run();
        }
        return true;
    }

    /**
     * 刷新失败时只更新元数据，保留已有节点（主行或分片都不动）。
     */
    async markSnapshotFailure({
        subscriptionId,
        configFingerprint,
        state = 'failed',
        lastAttemptAt = null,
        lastError = null,
    } = {}) {
        await this._ensureSchema();
        await this.db
            .prepare(
                `UPDATE subscription_node_snapshots
                 SET state = ?, config_fingerprint = ?, last_attempt_at = ?, last_error = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE subscription_id = ?
                   AND COALESCE(last_attempt_at, '') <= COALESCE(?, '')`
            )
            .bind(state, configFingerprint, lastAttemptAt, lastError, subscriptionId, lastAttemptAt)
            .run();
        return true;
    }

    async deleteForSubscription(subscriptionId) {
        await this._ensureSchema();
        const statements = [
            this.db
                .prepare('DELETE FROM subscription_node_snapshot_chunks WHERE subscription_id = ?')
                .bind(subscriptionId),
            this.db
                .prepare('DELETE FROM subscription_node_snapshots WHERE subscription_id = ?')
                .bind(subscriptionId),
        ];
        if (typeof this.db.batch === 'function') {
            await this.db.batch(statements);
        } else {
            for (const statement of statements) await statement.run();
        }
        return true;
    }
}

/**
 * 无存储降级适配器（无可用持久化存储时，不读写持久数据）
 */
class NoopStorageAdapter {
    async get() {
        return null;
    }
    async put() {
        return true;
    }
    async delete() {
        return true;
    }
    async list() {
        return [];
    }
    async getAllSubscriptions() {
        return [];
    }
    async getAllProfiles() {
        return [];
    }
}

/**
 * 判断一个值是否像 KV namespace（有 get/put/delete 方法）
 */
function isKVNamespace(val) {
    return (
        val &&
        typeof val === 'object' &&
        typeof val.get === 'function' &&
        typeof val.put === 'function' &&
        typeof val.delete === 'function'
    );
}

/**
 * 解析 KV 命名空间。
 * 优先读取 Cloudflare Pages 的 env 绑定，并兼容其他 env 中的 KV 绑定。
 * @param {Object} env
 * @returns {Object|null}
 */
function resolveKV(env) {
    // 1. Cloudflare Pages 方式：env.MISUB_KV
    if (env && isKVNamespace(env.MISUB_KV)) return env.MISUB_KV;

    // 2. 自动探测 env 中其他 KV 绑定（仅允许变量名包含 KV，避免误识别）
    if (env) {
        for (const key of Object.keys(env)) {
            if (!String(key).toUpperCase().includes('KV')) continue;
            if (isKVNamespace(env[key])) {
                console.log(`[Storage] Auto-detected KV in env: ${key}`);
                return env[key];
            }
        }
    }

    return null;
}

let _globalSettingsCache = {
    data: null,
    timestamp: 0,
};
const SETTINGS_CACHE_TTL_MS = 10 * 1000; // 10秒缓存过时

export class SettingsCache {
    /**
     * 带内存缓存的设置读取
     */
    static async get(env) {
        const now = Date.now();
        if (
            _globalSettingsCache.data &&
            now - _globalSettingsCache.timestamp < SETTINGS_CACHE_TTL_MS
        ) {
            return _globalSettingsCache.data;
        }

        try {
            let settings = null;
            if (env.MISUB_DB) {
                try {
                    const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
                    settings = await d1Adapter.get(DATA_KEYS.SETTINGS);
                } catch (d1Error) {
                    console.warn('[Storage Cache] Failed to read from D1:', d1Error.message);
                }
            }

            const kvNs = resolveKV(env);
            if (!settings && kvNs) {
                try {
                    const raw = await kvNs.get(DATA_KEYS.SETTINGS);
                    settings = raw ? JSON.parse(raw) : null;
                } catch (kvError) {
                    console.warn('[Storage Cache] Failed to read from KV:', kvError.message);
                }
            }

            if (settings) {
                _globalSettingsCache.data = settings;
                _globalSettingsCache.timestamp = now;
                return settings;
            }
        } catch (error) {
            console.error('[Storage Cache] Failed to read settings:', error);
        }

        return null;
    }

    /**
     * 在更新设置后主动清除缓存
     */
    static clear() {
        _globalSettingsCache = { data: null, timestamp: 0 };
    }
}

/**
 * 存储工厂类
 * 根据配置创建相应的存储适配器
 */
export class StorageFactory {
    /**
     * 解析 KV 命名空间（委托顶层函数）
     */
    static resolveKV(env) {
        return resolveKV(env);
    }

    /**
     * 创建存储适配器
     * @param {Object} env - Cloudflare 环境对象
     * @param {string} storageType - 存储类型 ('kv' | 'd1')
     * @returns {KVStorageAdapter|D1StorageAdapter}
     */
    static createAdapter(env, storageType = STORAGE_TYPES.KV) {
        switch (storageType) {
            case STORAGE_TYPES.D1:
                if (!env.MISUB_DB) {
                    console.warn('[Storage] D1 database not available, falling back to KV');
                    const kvFallback = StorageFactory.resolveKV(env);
                    if (!kvFallback) {
                        console.warn('[Storage] KV not available either, using noop adapter');
                        return new NoopStorageAdapter();
                    }
                    return new KVStorageAdapter(kvFallback);
                }
                return new D1StorageAdapter(env.MISUB_DB);

            case STORAGE_TYPES.KV:
            default: {
                const kv = StorageFactory.resolveKV(env);
                if (!kv) {
                    console.warn('[Storage] No KV binding found, using noop adapter');
                    return new NoopStorageAdapter();
                }
                return new KVStorageAdapter(kv);
            }
        }
    }

    /**
     * 获取当前存储类型设置
     * @param {Object} env - Cloudflare 环境对象
     * @returns {Promise<string>} 存储类型
     */
    /**
     * 创建 D1 节点快照仓库。没有 D1 绑定则返回 null。
     */
    static createNodeStore(env) {
        return env?.MISUB_DB ? new D1NodeStore(env.MISUB_DB) : null;
    }

    static async getStorageType(env) {
        try {
            const settings = await SettingsCache.get(env);
            if (settings?.storageType) {
                return settings.storageType;
            }
            return STORAGE_TYPES.KV;
        } catch (error) {
            console.error('[Storage] Failed to get storage type:', error);
            return STORAGE_TYPES.KV;
        }
    }

    /**
     * 将 KV Settings 同步到 D1（当 D1 为空时）
     */
    static async ensureD1Settings(env) {
        if (!env?.MISUB_DB) return false;
        try {
            const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
            const existing = await d1Adapter.get(DATA_KEYS.SETTINGS);
            if (existing) return true;
            const kvNs = resolveKV(env);
            if (!kvNs) return false;
            const raw = await kvNs.get(DATA_KEYS.SETTINGS);
            if (!raw) return false;
            const settings = JSON.parse(raw);
            if (settings?.storageType !== STORAGE_TYPES.D1) {
                settings.storageType = STORAGE_TYPES.D1;
            }
            await d1Adapter.put(DATA_KEYS.SETTINGS, settings);
            return true;
        } catch (error) {
            console.warn('[Storage] ensureD1Settings failed:', error?.message || error);
            return false;
        }
    }

    /**
     * 检查是否配置了双重存储
     * @param {Object} env - Cloudflare环境对象
     * @returns {boolean} 是否配置了双重存储
     */
    static hasDualStorage(env) {
        return !!(StorageFactory.resolveKV(env) && env.MISUB_DB);
    }
}

/**
 * KV → D1 需要搬运的业务键。
 *
 * 原实现只搬 subscriptions / profiles / settings 三个键，其余业务数据（DNS 模板、
 * 规则模板、客户端、留言板……）留在 KV 里，迁移后按 storageType='d1' 读就全成空，
 * 而接口仍返回「数据已成功迁移」。用户照官方引导解绑 KV 后就再也取不回。
 *
 * 刻意不搬的键，各有原因：
 *   misub_webdav_backup_lock  —— 定时任务互斥锁，搬一个过期锁过去会挡住下次备份
 *   misub_system_logs         —— 诊断日志，体积可能很大，非业务数据
 *   misub_error_reports       —— 同上
 *   misub_data_v1             —— 更早的遗留格式，由 api-router 的独立升级路径处理
 */
const D1_MIGRATION_KEYS = [
    DATA_KEYS.SUBSCRIPTIONS,
    DATA_KEYS.PROFILES,
    'misub_dns_templates_v1',
    'misub_rule_templates_v1',
    'misub_clients_v1',
    'misub_guestbook_v1',
    'misub_settings_v1',
    'misub_restore_snapshot_latest',
];

/** 需要按前缀枚举后逐条搬运的键 */
const D1_MIGRATION_KEY_PREFIXES = [DATA_KEYS.PROFILE_DOWNLOAD_COUNT_PREFIX];

export { D1_MIGRATION_KEYS, D1_MIGRATION_KEY_PREFIXES };

/**
 * 数据迁移工具
 */
export class DataMigrator {
    /**
     * 从 KV 迁移到 D1
     * @param {Object} env - Cloudflare 环境对象
     * @returns {Promise<Object>} 迁移结果
     */
    static async migrateKVToD1(env) {
        try {
            const kvNs = resolveKV(env);
            if (!kvNs) throw new Error('No KV binding found');
            const kvAdapter = new KVStorageAdapter(kvNs);
            const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
            await ensureD1Schema(d1Adapter.db);

            // keys: 逐键结果，'migrated' | 'empty' | 'failed'
            const results = {
                subscriptions: false,
                profiles: false,
                settings: false,
                keys: {},
                errors: [],
            };

            const copyKey = async (key) => {
                try {
                    const value = await kvAdapter.get(key);
                    if (value === null || value === undefined) {
                        results.keys[key] = 'empty';
                        return false;
                    }
                    await d1Adapter.put(key, value);
                    results.keys[key] = 'migrated';
                    return true;
                } catch (error) {
                    results.keys[key] = 'failed';
                    results.errors.push(`${key} 迁移失败: ${error.message}`);
                    return false;
                }
            };

            for (const key of D1_MIGRATION_KEYS) {
                const ok = await copyKey(key);
                if (key === DATA_KEYS.SUBSCRIPTIONS) results.subscriptions = ok;
                if (key === DATA_KEYS.PROFILES) results.profiles = ok;
            }

            // 前缀键：先枚举再逐条搬
            for (const prefix of D1_MIGRATION_KEY_PREFIXES) {
                try {
                    const listed = await kvAdapter.list(prefix);
                    for (const entry of listed) {
                        const key = typeof entry === 'string' ? entry : entry?.name;
                        if (key) await copyKey(key);
                    }
                } catch (error) {
                    results.errors.push(`前缀 ${prefix} 枚举失败: ${error.message}`);
                }
            }

            // settings 放在最后：storageType 要在其余数据都就位之后才翻成 d1，
            // 否则中途失败会留下「已切 d1、数据还在 kv」的半迁移状态。
            try {
                const settings = await kvAdapter.get(DATA_KEYS.SETTINGS);
                if (settings) {
                    settings.storageType = STORAGE_TYPES.D1;
                    await d1Adapter.put(DATA_KEYS.SETTINGS, settings);
                    results.settings = true;
                    results.keys[DATA_KEYS.SETTINGS] = 'migrated';
                } else {
                    results.keys[DATA_KEYS.SETTINGS] = 'empty';
                }
            } catch (error) {
                results.keys[DATA_KEYS.SETTINGS] = 'failed';
                results.errors.push(`设置迁移失败: ${error.message}`);
            }

            return results;
        } catch (error) {
            console.error('[Migration] Failed to migrate KV to D1:', error);
            throw error;
        }
    }

    static async migrateLegacyD1MainRows(env) {
        if (!env?.MISUB_DB) throw new Error('D1 database not available');

        const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
        await ensureD1Schema(d1Adapter.db);

        const results = {
            subscriptions: 0,
            profiles: 0,
            errors: [],
        };

        try {
            const legacySubs = await d1Adapter.get(DATA_KEYS.SUBSCRIPTIONS);
            if (Array.isArray(legacySubs)) {
                for (const item of legacySubs) {
                    if (!item?.id) continue;
                    await d1Adapter.putSubscription(item);
                    results.subscriptions += 1;
                }
                await d1Adapter.db
                    .prepare('DELETE FROM subscriptions WHERE id = ?')
                    .bind('main')
                    .run();
                invalidateD1CollectionCache(d1Adapter.db, 'subscriptions');
            }
        } catch (error) {
            results.errors.push(`订阅主行迁移失败: ${error.message}`);
        }

        try {
            const legacyProfiles = await d1Adapter.get(DATA_KEYS.PROFILES);
            if (Array.isArray(legacyProfiles)) {
                for (const item of legacyProfiles) {
                    if (!item?.id) continue;
                    await d1Adapter.putProfile(item);
                    results.profiles += 1;
                }
                await d1Adapter.db.prepare('DELETE FROM profiles WHERE id = ?').bind('main').run();
                invalidateD1CollectionCache(d1Adapter.db, 'profiles');
            }
        } catch (error) {
            results.errors.push(`订阅组主行迁移失败: ${error.message}`);
        }

        return results;
    }

    static async detectLegacyD1MainRows(env) {
        if (!env?.MISUB_DB) {
            return {
                hasLegacySubscriptions: false,
                hasLegacyProfiles: false,
                hasLegacyData: false,
            };
        }

        const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
        const [legacySubs, legacyProfiles] = await Promise.all([
            d1Adapter.db
                .prepare('SELECT data FROM subscriptions WHERE id = ?')
                .bind('main')
                .first(),
            d1Adapter.db.prepare('SELECT data FROM profiles WHERE id = ?').bind('main').first(),
        ]);

        const hasLegacySubscriptions = Array.isArray(
            legacySubs ? JSON.parse(legacySubs.data) : null
        );
        const hasLegacyProfiles = Array.isArray(
            legacyProfiles ? JSON.parse(legacyProfiles.data) : null
        );

        return {
            hasLegacySubscriptions,
            hasLegacyProfiles,
            hasLegacyData: hasLegacySubscriptions || hasLegacyProfiles,
        };
    }
}
