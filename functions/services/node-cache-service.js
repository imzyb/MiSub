/**
 * 节点缓存服务
 * 解决订阅拉取超时问题：缓存节点数据，快速响应客户端请求
 * @author MiSub Team
 */

/**
 * 缓存配置
 * 策略：仅首次缓存 - 首次同步获取，后续返回缓存+后台刷新
 */
const CACHE_CONFIG = {
    KEY_PREFIX: 'node_cache_',           // 缓存键前缀
    FRESH_TTL: 0,                        // 新鲜期：0（每次都触发后台刷新）
    STALE_TTL: 60 * 60 * 1000,           // 可用期：1 小时（超过后同步获取）
    MAX_AGE: 24 * 60 * 60 * 1000,        // 最大缓存时间：24 小时
    BACKGROUND_REFRESH_TIMEOUT: 25000    // 后台刷新超时：25 秒
};

/**
 * 生成缓存键
 * @param {string} type - 缓存类型 ('profile' | 'token')
 * @param {string} identifier - 标识符
 * @returns {string} 缓存键
 */
export function generateCacheKey(type, identifier) {
    return `${CACHE_CONFIG.KEY_PREFIX}${type}_${identifier}`;
}

/**
 * 缓存数据结构
 * @typedef {Object} CacheEntry
 * @property {string} nodes - Base64 编码的节点列表
 * @property {number} timestamp - 缓存时间戳
 * @property {number} nodeCount - 节点数量
 * @property {string[]} sources - 来源订阅名称列表
 */

/**
 * 获取缓存
 * @param {Object} storageAdapter - 存储适配器
 * @param {string} cacheKey - 缓存键
 * @returns {Promise<{data: CacheEntry|null, status: 'fresh'|'stale'|'expired'|'miss'}>}
 */
export async function getCache(storageAdapter, cacheKey) {
    try {
        const cached = await storageAdapter.get(cacheKey);
        if (!cached) {
            return { data: null, status: 'miss' };
        }

        const now = Date.now();
        const age = now - cached.timestamp;

        if (age < CACHE_CONFIG.FRESH_TTL) {
            return { data: cached, status: 'fresh' };
        } else if (age < CACHE_CONFIG.STALE_TTL) {
            return { data: cached, status: 'stale' };
        } else if (age < CACHE_CONFIG.MAX_AGE) {
            return { data: cached, status: 'expired' };
        } else {
            return { data: null, status: 'miss' };
        }
    } catch (error) {
        console.error('[Cache] Failed to get cache:', error);
        return { data: null, status: 'miss' };
    }
}

/**
 * 设置缓存
 * @param {Object} storageAdapter - 存储适配器
 * @param {string} cacheKey - 缓存键
 * @param {string} nodes - 节点列表字符串
 * @param {string[]} sources - 来源订阅名称列表
 * @returns {Promise<boolean>}
 */
export async function setCache(storageAdapter, cacheKey, nodes, sources = []) {
    try {
        const nodeCount = nodes.split('\n').filter(line => line.trim()).length;
        const cacheEntry = {
            nodes,
            timestamp: Date.now(),
            nodeCount,
            sources
        };

        // 计算 TTL（秒），使用 MAX_AGE 作为过期时间
        const ttlSeconds = Math.ceil(CACHE_CONFIG.MAX_AGE / 1000);

        // 尝试使用 KV 原生 TTL
        if (storageAdapter.kv && typeof storageAdapter.kv.put === 'function') {
            await storageAdapter.kv.put(cacheKey, JSON.stringify(cacheEntry), {
                expirationTtl: ttlSeconds
            });
        } else {
            // 降级：使用普通 put（无 TTL）
            await storageAdapter.put(cacheKey, cacheEntry);
        }


        return true;
    } catch (error) {
        console.error('[Cache] Failed to set cache:', error);
        return false;
    }
}

/**
 * 触发后台刷新（使用 waitUntil）
 * @param {Object} context - Cloudflare 上下文
 * @param {Function} refreshFn - 刷新函数
 */
export function triggerBackgroundRefresh(context, refreshFn) {
    if (context && typeof context.waitUntil === 'function') {
        // 使用 waitUntil 在响应后继续执行
        const refreshPromise = Promise.race([
            refreshFn(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Background refresh timeout')), CACHE_CONFIG.BACKGROUND_REFRESH_TIMEOUT)
            )
        ]).catch(error => {
            console.warn('[Cache] Background refresh failed:', error.message);
        });

        context.waitUntil(refreshPromise);

    } else {
        // 降级：不等待刷新完成
        console.warn('[Cache] waitUntil not available, skipping background refresh');
    }
}

/**
 * 创建缓存响应头
 * @param {string} status - 缓存状态
 * @param {number} nodeCount - 节点数量
 * @returns {Object} 响应头对象
 */
export function createCacheHeaders(status, nodeCount) {
    return {
        'X-Cache-Status': status,
        'X-Node-Count': String(nodeCount),
        'X-Cache-Time': new Date().toISOString()
    };
}

/**
 * 获取缓存配置（供外部使用）
 */
export function getCacheConfig() {
    return { ...CACHE_CONFIG };
}

/**
 * 清除指定缓存
 * @param {Object} storageAdapter - 存储适配器
 * @param {string} cacheKey - 缓存键
 * @returns {Promise<boolean>}
 */
export async function clearCache(storageAdapter, cacheKey) {
    try {
        await storageAdapter.delete(cacheKey);

        return true;
    } catch (error) {
        console.error('[Cache] Failed to clear cache:', error);
        return false;
    }
}

/**
 * 清除所有节点缓存
 * @param {Object} storageAdapter - 存储适配器
 * @returns {Promise<{cleared: number, failed: number}>}
 */
export async function clearAllNodeCaches(storageAdapter) {
    try {
        let cleared = 0;
        let failed = 0;
        let cursor = null;

        // 循环处理分页，KV list 默认最多返回 1000 个 key
        do {
            let keys = [];
            let listComplete = true;

            // 判断存储适配器类型并正确调用
            if (storageAdapter.kv && typeof storageAdapter.kv.list === 'function') {
                // 直接使用 KV namespace
                const listOptions = { prefix: CACHE_CONFIG.KEY_PREFIX };
                if (cursor) {
                    listOptions.cursor = cursor;
                }
                const result = await storageAdapter.kv.list(listOptions);
                keys = result.keys || [];
                cursor = result.list_complete ? null : result.cursor;
                listComplete = result.list_complete !== false;
            } else if (typeof storageAdapter.list === 'function') {
                // 使用适配器的 list 方法（KVStorageAdapter 或 D1StorageAdapter）
                // 注意：适配器的 list 方法接受 prefix 字符串参数
                const result = await storageAdapter.list(CACHE_CONFIG.KEY_PREFIX);
                keys = Array.isArray(result) ? result : (result.keys || []);
                cursor = null; // 适配器可能不支持分页，一次性返回所有
                listComplete = true;
            } else {
                console.warn('[Cache] Storage adapter does not support list operation');
                break;
            }

            // 删除缓存
            for (const keyInfo of keys) {
                const key = typeof keyInfo === 'string' ? keyInfo : (keyInfo.name || keyInfo);
                try {
                    if (storageAdapter.kv && typeof storageAdapter.kv.delete === 'function') {
                        await storageAdapter.kv.delete(key);
                    } else {
                        await storageAdapter.delete(key);
                    }
                    cleared++;
                } catch {
                    failed++;
                }
            }

            // 如果列表完成或没有更多数据，退出循环
            if (listComplete || keys.length === 0) {
                cursor = null;
            }
        } while (cursor);


        return { cleared, failed };
    } catch (error) {
        console.error('[Cache] Failed to clear all caches:', error);
        return { cleared: 0, failed: 0 };
    }
}

/**
 * 使指定 Profile 或 Token 的缓存失效
 * @param {Object} storageAdapter - 存储适配器
 * @param {string[]} profileIds - Profile ID 列表
 * @param {string} token - Token（可选）
 * @returns {Promise<number>} 清除的缓存数量
 */
export async function invalidateCaches(storageAdapter, profileIds = [], token = null) {
    let clearedCount = 0;

    // 清除 Profile 缓存
    for (const profileId of profileIds) {
        const cacheKey = generateCacheKey('profile', profileId);
        if (await clearCache(storageAdapter, cacheKey)) {
            clearedCount++;
        }
    }

    // 清除 Token 缓存（主订阅）
    if (token) {
        const cacheKey = generateCacheKey('token', token);
        if (await clearCache(storageAdapter, cacheKey)) {
            clearedCount++;
        }
    }

    return clearedCount;
}
