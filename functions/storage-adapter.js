/**
 * 数据存储抽象层
 * 支持 KV 和 D1 两种存储方式
 * 根据设置自动选择存储类型
 */

// 存储类型常量
export const STORAGE_TYPES = {
    KV: 'kv',
    D1: 'd1'
};

// 数据键映射
const DATA_KEYS = {
    SUBSCRIPTIONS: 'misub_subscriptions_v1',
    PROFILES: 'misub_profiles_v1',
    SETTINGS: 'worker_settings_v1'
};

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
    `CREATE TABLE IF NOT EXISTS vps_nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tag TEXT,
        region TEXT,
        description TEXT,
        secret TEXT NOT NULL,
        status TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        use_global_targets INTEGER DEFAULT 0,
        last_seen_at DATETIME,
        last_report_json TEXT,
        overload_state_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS vps_reports (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        reported_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS vps_alerts (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_vps_nodes_updated_at ON vps_nodes(updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_vps_reports_node_time ON vps_reports(node_id, reported_at);`,
    `CREATE INDEX IF NOT EXISTS idx_vps_alerts_node_time ON vps_alerts(node_id, created_at);`,
    `CREATE TABLE IF NOT EXISTS vps_network_targets (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        type TEXT NOT NULL,
        target TEXT NOT NULL,
        scheme TEXT,
        port INTEGER,
        path TEXT,
        enabled INTEGER DEFAULT 1,
        force_check_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_vps_network_targets_node ON vps_network_targets(node_id, created_at);`,
    `CREATE TABLE IF NOT EXISTS vps_network_samples (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        reported_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_vps_network_samples_node_time ON vps_network_samples(node_id, reported_at);`
];

async function ensureD1Schema(d1Db) {
    for (const statement of D1_SCHEMA_STATEMENTS) {
        await d1Db.prepare(statement).run();
    }
}

/**
 * KV 存储适配器
 */
class KVStorageAdapter {
    constructor(kvNamespace) {
        this.kv = kvNamespace;
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
}

/**
 * D1 存储适配器
 */
class D1StorageAdapter {
    constructor(d1Database) {
        this.db = d1Database;
    }

    async get(key, type = 'json') {
        try {
            // 根据 key 确定查询的表和字段
            const { table, queryField, queryValue } = this._parseKey(key);

            const result = await this.db.prepare(
                `SELECT ${table === 'settings' ? 'value as data' : 'data'} FROM ${table} WHERE ${queryField} = ?`
            ).bind(queryValue).first();

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
                await this.db.prepare(`
                    INSERT OR REPLACE INTO ${table} (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `).bind(queryValue, data).run();
            } else {
                // subscriptions 和 profiles 表使用 id-data 结构
                await this.db.prepare(`
                    INSERT OR REPLACE INTO ${table} (id, data, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `).bind(queryValue, data).run();
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

            await this.db.prepare(
                `DELETE FROM ${table} WHERE ${queryField} = ?`
            ).bind(queryValue).run();

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
                { name: 'settings', keyField: 'key' }
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

            const shouldQuerySubscriptions = !effectivePrefix || effectivePrefix.startsWith(DATA_KEYS.SUBSCRIPTIONS);
            const shouldQueryProfiles = !effectivePrefix || effectivePrefix.startsWith(DATA_KEYS.PROFILES);
            const shouldQuerySettings = !effectivePrefix || !matchesKnownKey || effectivePrefix.startsWith(DATA_KEYS.SETTINGS);

            for (const table of tables) {
                if (table.name === 'subscriptions' && !shouldQuerySubscriptions) continue;
                if (table.name === 'profiles' && !shouldQueryProfiles) continue;
                if (table.name === 'settings' && !shouldQuerySettings) continue;

                let results;
                if (table.name === 'settings' && effectivePrefix) {
                    results = await this.db.prepare(
                        `SELECT ${table.keyField} FROM ${table.name} WHERE ${table.keyField} LIKE ?`
                    ).bind(`${effectivePrefix}%`).all();
                } else {
                    results = await this.db.prepare(
                        `SELECT ${table.keyField} FROM ${table.name}`
                    ).all();
                }

                results.results.forEach(row => {
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
 * 无存储降级适配器（EdgeOne 纯环境变量模式，不读写持久数据）
 */
class NoopStorageAdapter {
    async get() { return null; }
    async put() { return true; }
    async delete() { return true; }
    async list() { return []; }
}


/**
 * 判断一个值是否像 KV namespace（有 get/put/delete 方法）
 */
function isKVNamespace(val) {
    return val && typeof val === 'object' &&
        typeof val.get === 'function' &&
        typeof val.put === 'function' &&
        typeof val.delete === 'function';
}

/**
 * 解析 KV 命名空间
 * EdgeOne Pages: KV 作为全局变量注入（globalThis.MISUB_KV），而非通过 env
 * Cloudflare Pages: KV 通过 env.MISUB_KV 注入
 * 同时支持自动探测，兼容任意绑定名
 * @param {Object} env
 * @returns {Object|null}
 */
function resolveKV(env) {
    // 1. Cloudflare Pages 方式：env.MISUB_KV
    if (env && isKVNamespace(env.MISUB_KV)) return env.MISUB_KV;

    // 2. EdgeOne Pages 方式：KV 作为全局变量注入
    if (typeof MISUB_KV !== 'undefined' && isKVNamespace(MISUB_KV)) return MISUB_KV;  // eslint-disable-line no-undef

    // 3. 自动探测 env 中其他 KV 绑定（仅允许变量名包含 KV，避免误识别）
    if (env) {
        for (const key of Object.keys(env)) {
            if (!String(key).toUpperCase().includes('KV')) continue;
            if (isKVNamespace(env[key])) {
                console.log(`[Storage] Auto-detected KV in env: ${key}`);
                return env[key];
            }
        }
    }

    // 4. 自动探测 globalThis 中其他 KV 绑定（仅允许变量名包含 KV，避免误识别）
    for (const key of Object.keys(globalThis)) {
        if (key.startsWith('_') || key === 'globalThis') continue;
        if (!String(key).toUpperCase().includes('KV')) continue;
        try {
            const val = globalThis[key];
            if (isKVNamespace(val)) {
                console.log(`[Storage] Auto-detected KV in globalThis: ${key}`);
                return val;
            }
        } catch (_) { /* 忽略访问器异常 */ }
    }

    return null;
}

let _globalSettingsCache = {
    data: null,
    timestamp: 0
};
const SETTINGS_CACHE_TTL_MS = 60 * 1000; // 60秒缓存过时

export class SettingsCache {
    /**
     * 带内存缓存的设置读取
     */
    static async get(env) {
        const now = Date.now();
        if (_globalSettingsCache.data && (now - _globalSettingsCache.timestamp < SETTINGS_CACHE_TTL_MS)) {
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

            const results = {
                subscriptions: false,
                profiles: false,
                settings: false,
                errors: []
            };

            // 迁移订阅数据
            try {
                const subscriptions = await kvAdapter.get(DATA_KEYS.SUBSCRIPTIONS);
                if (subscriptions) {
                    await d1Adapter.put(DATA_KEYS.SUBSCRIPTIONS, subscriptions);
                    results.subscriptions = true;
                }
            } catch (error) {
                results.errors.push(`订阅数据迁移失败: ${error.message}`);
            }

            // 迁移配置文件
            try {
                const profiles = await kvAdapter.get(DATA_KEYS.PROFILES);
                if (profiles) {
                    await d1Adapter.put(DATA_KEYS.PROFILES, profiles);
                    results.profiles = true;
                }
            } catch (error) {
                results.errors.push(`配置文件迁移失败: ${error.message}`);
            }

            // 迁移设置
            try {
                const settings = await kvAdapter.get(DATA_KEYS.SETTINGS);
                if (settings) {
                    // 更新存储类型为 D1
                    settings.storageType = STORAGE_TYPES.D1;
                    await d1Adapter.put(DATA_KEYS.SETTINGS, settings);
                    results.settings = true;
                }
            } catch (error) {
                results.errors.push(`设置迁移失败: ${error.message}`);
            }

            return results;
        } catch (error) {
            console.error('[Migration] Failed to migrate KV to D1:', error);
            throw error;
        }
    }
}
