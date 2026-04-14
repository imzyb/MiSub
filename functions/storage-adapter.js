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
    SETTINGS: 'worker_settings_v1',
    PROFILE_DOWNLOAD_COUNT_PREFIX: 'misub_profile_download_count_'
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
    `CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);`
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
        return Array.isArray(all) ? all.find(item => item.id === id) || null : null;
    }

    async getAllSubscriptions() {
        const all = await this.get(DATA_KEYS.SUBSCRIPTIONS);
        return Array.isArray(all) ? all : [];
    }

    async getProfileById(id) {
        const all = await this.get(DATA_KEYS.PROFILES);
        return Array.isArray(all) ? all.find(item => item.id === id || item.customId === id) || null : null;
    }

    async getAllProfiles() {
        const all = await this.get(DATA_KEYS.PROFILES);
        return Array.isArray(all) ? all : [];
    }

    async updateSubscriptionById(id, updater) {
        const all = await this.get(DATA_KEYS.SUBSCRIPTIONS) || [];
        const index = all.findIndex(item => item.id === id);
        if (index === -1) return null;
        const updated = updater({ ...all[index] });
        all[index] = updated;
        await this.put(DATA_KEYS.SUBSCRIPTIONS, all);
        return updated;
    }

    async putSubscription(item) {
        const all = await this.getAllSubscriptions();
        const index = all.findIndex(entry => entry.id === item.id);
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
        const filtered = all.filter(item => item.id !== id);
        await this.put(DATA_KEYS.SUBSCRIPTIONS, filtered);
        return filtered.length !== all.length;
    }

    async putProfile(item) {
        const all = await this.getAllProfiles();
        const index = all.findIndex(entry => entry.id === item.id);
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
        const filtered = all.filter(item => item.id !== id);
        await this.put(DATA_KEYS.PROFILES, filtered);
        return filtered.length !== all.length;
    }

    async getSubscriptionsByIds(ids = []) {
        const all = await this.get(DATA_KEYS.SUBSCRIPTIONS) || [];
        const idSet = new Set(ids);
        return all.filter(item => idSet.has(item.id));
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

    async getSubscriptionById(id) {
        try {
            const result = await this.db.prepare('SELECT data FROM subscriptions WHERE id = ?').bind(id).first();
            if (result) return JSON.parse(result.data);

            const legacyMain = await this.db.prepare('SELECT data FROM subscriptions WHERE id = ?').bind('main').first();
            if (!legacyMain) return null;
            const parsed = JSON.parse(legacyMain.data);
            return Array.isArray(parsed) ? parsed.find(item => item.id === id) || null : null;
        } catch (error) {
            console.error(`[D1] Failed to get subscription ${id}:`, error);
            return null;
        }
    }

    async getAllSubscriptions() {
        try {
            const results = await this.db.prepare('SELECT data FROM subscriptions').all();
            if (!Array.isArray(results?.results)) return [];

            const all = [];
            results.results.forEach(row => {
                const parsed = JSON.parse(row.data);
                if (Array.isArray(parsed)) {
                    all.push(...parsed);
                } else if (parsed) {
                    all.push(parsed);
                }
            });

            const deduped = new Map();
            all.forEach(item => {
                if (item?.id) deduped.set(item.id, item);
            });
            return Array.from(deduped.values()).sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0));
        } catch (error) {
            console.error('[D1] Failed to get all subscriptions:', error);
            return [];
        }
    }

    async getProfileById(id) {
        try {
            const result = await this.db.prepare('SELECT data FROM profiles WHERE id = ?').bind(id).first();
            if (result) return JSON.parse(result.data);

            const legacyMain = await this.db.prepare('SELECT data FROM profiles WHERE id = ?').bind('main').first();
            const allProfiles = legacyMain ? JSON.parse(legacyMain.data) : await this.get(DATA_KEYS.PROFILES);
            return Array.isArray(allProfiles) ? allProfiles.find(item => item.id === id || item.customId === id) || null : null;
        } catch (error) {
            console.error(`[D1] Failed to get profile ${id}:`, error);
            return null;
        }
    }

    async getAllProfiles() {
        try {
            const results = await this.db.prepare('SELECT data FROM profiles').all();
            if (!Array.isArray(results?.results)) return [];

            const all = [];
            results.results.forEach(row => {
                const parsed = JSON.parse(row.data);
                if (Array.isArray(parsed)) {
                    all.push(...parsed);
                } else if (parsed) {
                    all.push(parsed);
                }
            });

            const deduped = new Map();
            all.forEach(item => {
                if (item?.id) deduped.set(item.id, item);
            });
            return Array.from(deduped.values()).sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0));
        } catch (error) {
            console.error('[D1] Failed to get all profiles:', error);
            return [];
        }
    }

    async updateSubscriptionById(id, updater) {
        const existing = await this.getSubscriptionById(id);
        if (!existing) return null;
        const updated = updater({ ...existing });
        await this.db.prepare(`
            INSERT OR REPLACE INTO subscriptions (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(id, JSON.stringify(updated)).run();
        return updated;
    }

    async putSubscription(item) {
        await this.db.prepare(`
            INSERT OR REPLACE INTO subscriptions (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(item.id, JSON.stringify(item)).run();
        return item;
    }

    async deleteSubscriptionById(id) {
        const result = await this.db.prepare('DELETE FROM subscriptions WHERE id = ?').bind(id).run();
        return Boolean(result?.success);
    }

    async putProfile(item) {
        await this.db.prepare(`
            INSERT OR REPLACE INTO profiles (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(item.id, JSON.stringify(item)).run();
        return item;
    }

    async deleteProfileById(id) {
        const result = await this.db.prepare('DELETE FROM profiles WHERE id = ?').bind(id).run();
        return Boolean(result?.success);
    }

    async getSubscriptionsByIds(ids = []) {
        if (!Array.isArray(ids) || ids.length === 0) return [];
        const placeholders = ids.map(() => '?').join(',');
        try {
            const results = await this.db.prepare(`SELECT data FROM subscriptions WHERE id IN (${placeholders})`).bind(...ids).all();
            const directHits = Array.isArray(results?.results) ? results.results.map(row => JSON.parse(row.data)) : [];
            const foundIds = new Set(directHits.map(item => item?.id).filter(Boolean));
            const missingIds = ids.filter(id => !foundIds.has(id));

            if (missingIds.length === 0) return directHits;

            const legacyMain = await this.db.prepare('SELECT data FROM subscriptions WHERE id = ?').bind('main').first();
            if (!legacyMain) return directHits;

            const parsed = JSON.parse(legacyMain.data);
            if (!Array.isArray(parsed)) return directHits;

            const legacyHits = parsed.filter(item => missingIds.includes(item.id));
            return [...directHits, ...legacyHits];
        } catch (error) {
            console.error('[D1] Failed to get subscriptions by ids:', error);
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
            if (String(key).startsWith(DATA_KEYS.PROFILE_DOWNLOAD_COUNT_PREFIX)) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            if (String(key).startsWith('misub_guestbook_v1')) {
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
 * 无存储降级适配器（无可用持久化存储时，不读写持久数据）
 */
class NoopStorageAdapter {
    async get() { return null; }
    async put() { return true; }
    async delete() { return true; }
    async list() { return []; }
    async getAllSubscriptions() { return []; }
    async getAllProfiles() { return []; }
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
    timestamp: 0
};
const SETTINGS_CACHE_TTL_MS = 10 * 1000; // 10秒缓存过时

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

    static async migrateLegacyD1MainRows(env) {
        if (!env?.MISUB_DB) throw new Error('D1 database not available');

        const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
        await ensureD1Schema(d1Adapter.db);

        const results = {
            subscriptions: 0,
            profiles: 0,
            errors: []
        };

        try {
            const legacySubs = await d1Adapter.get(DATA_KEYS.SUBSCRIPTIONS);
            if (Array.isArray(legacySubs)) {
                for (const item of legacySubs) {
                    if (!item?.id) continue;
                    await d1Adapter.putSubscription(item);
                    results.subscriptions += 1;
                }
                await d1Adapter.db.prepare('DELETE FROM subscriptions WHERE id = ?').bind('main').run();
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
                hasLegacyData: false
            };
        }

        const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
        const [legacySubs, legacyProfiles] = await Promise.all([
            d1Adapter.db.prepare('SELECT data FROM subscriptions WHERE id = ?').bind('main').first(),
            d1Adapter.db.prepare('SELECT data FROM profiles WHERE id = ?').bind('main').first()
        ]);

        const hasLegacySubscriptions = Array.isArray(legacySubs ? JSON.parse(legacySubs.data) : null);
        const hasLegacyProfiles = Array.isArray(legacyProfiles ? JSON.parse(legacyProfiles.data) : null);

        return {
            hasLegacySubscriptions,
            hasLegacyProfiles,
            hasLegacyData: hasLegacySubscriptions || hasLegacyProfiles
        };
    }
}
