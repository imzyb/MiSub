/**
 * 日志服务模块
 * 处理订阅访问日志的存储和检索
 */

const LOG_KV_KEY = 'misub_system_logs';
const LOG_INDEX_KV_KEY = 'misub_system_logs:index';
const LOG_BUCKET_PREFIX = 'misub_system_logs:';
const MAX_LOG_ENTRIES = 200;
const MAX_LOG_AGE_DAYS = 30;
const MAX_LOG_AGE_MS = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
const SUCCESS_LOG_COOLDOWN_MS = 5 * 60 * 1000;
const ERROR_LOG_COOLDOWN_MS = 60 * 1000;
const MAX_PERSISTED_LOGS_PER_MINUTE = 12;

function getKV(env) {
    return env?.MISUB_KV || null;
}

function getLogBucketKey(timestamp) {
    const date = new Date(timestamp);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${LOG_BUCKET_PREFIX}${yyyy}-${mm}-${dd}`;
}

async function getLogBucketIndex(kv) {
    const raw = await kv.get(LOG_INDEX_KV_KEY);
    const index = raw ? JSON.parse(raw) : null;
    return Array.isArray(index) ? index : [];
}

async function saveLogBucketIndex(kv, keys) {
    const unique = Array.from(new Set(keys)).sort().reverse();
    await kv.put(LOG_INDEX_KV_KEY, JSON.stringify(unique.slice(0, MAX_LOG_AGE_DAYS + 2)));
}
// 全局内存队列，用于削峰填谷和防写竞争
let logBatch = [];
let isFlushing = false;
let recentLogFingerprints = new Map();
let persistedLogTimestamps = [];

function cleanupLogBudgets(now = Date.now()) {
    persistedLogTimestamps = persistedLogTimestamps.filter(ts => (now - ts) < 60 * 1000);
    for (const [fingerprint, expiresAt] of recentLogFingerprints.entries()) {
        if (expiresAt <= now) {
            recentLogFingerprints.delete(fingerprint);
        }
    }
}

function getLogFingerprint(logEntry) {
    const type = logEntry?.type || 'unknown';
    const token = logEntry?.token || 'unknown';
    const format = logEntry?.format || 'unknown';
    const status = logEntry?.status || 'unknown';
    const domain = logEntry?.domain || 'unknown';
    const message = logEntry?.details?.error || logEntry?.summary || '';
    return `${status}|${type}|${token}|${format}|${domain}|${message}`;
}

function shouldPersistLog(logEntry) {
    const now = Date.now();
    cleanupLogBudgets(now);

    const mode = logEntry?.persistenceMode === 'full' ? 'full' : 'light';
    if (mode === 'full') {
        return true;
    }

    const isError = logEntry?.status === 'error';
    const fingerprint = getLogFingerprint(logEntry);
    const cooldownMs = isError ? ERROR_LOG_COOLDOWN_MS : SUCCESS_LOG_COOLDOWN_MS;
    const fingerprintExpiresAt = recentLogFingerprints.get(fingerprint) || 0;

    if (fingerprintExpiresAt > now) {
        return false;
    }

    if (!isError && persistedLogTimestamps.length >= MAX_PERSISTED_LOGS_PER_MINUTE) {
        return false;
    }

    recentLogFingerprints.set(fingerprint, now + cooldownMs);
    persistedLogTimestamps.push(now);
    return true;
}

export const LogService = {
    /**
     * 添加一条新日志 (支持 Isolate 级别的批量异步写入)
     * @param {Object} env - Cloudflare Environment
     * @param {Object} logEntry - 日志内容
     */
    async addLog(env, logEntry) {
        if (!getKV(env)) return;
        if (!shouldPersistLog(logEntry)) return null;

        const enrichedLog = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            ...logEntry
        };

        // 放入全局内存队列
        logBatch.push(enrichedLog);

        // 如果没有正在刷盘的任务，则启动刷盘。
        // 由于调用点通常在 ctx.waitUntil 中，这保证了请求结束后仍有执行时间。
        if (!isFlushing) {
            isFlushing = true;
            // 简单的防抖：给并发请求一点时间累积日志
            await new Promise(resolve => setTimeout(resolve, 500));
            await this._flush(env);
        }

        return enrichedLog;
    },

    /**
     * 内部方法：将内存队列中的日志批量刷入 KV
     */
    async _flush(env) {
        if (logBatch.length === 0) {
            isFlushing = false;
            return;
        }

        // 把当前队列的数据取出
        const batchToFlush = [...logBatch];
        logBatch = [];

        try {
            const kv = getKV(env);
            const now = Date.now();
            const bucketKey = getLogBucketKey(now);
            let logs = await kv.get(bucketKey).then(r => r ? JSON.parse(r) : null) || [];
            if (!Array.isArray(logs)) logs = [];

            // 把新收集到的一批日志插入到头部 (倒序输入保证时间线不乱)
            logs.unshift(...batchToFlush.reverse());

            // 1. 过滤过期日志 (30天)
            logs = logs.filter(log => (now - log.timestamp) <= MAX_LOG_AGE_MS);

            // 2. 单桶限制数量，避免单 key 无限增长
            const perBucketLimit = Math.max(MAX_LOG_ENTRIES, 100);
            if (logs.length > perBucketLimit) {
                logs = logs.slice(0, perBucketLimit);
            }

            await kv.put(bucketKey, JSON.stringify(logs));

            const bucketIndex = await getLogBucketIndex(kv);
            if (!bucketIndex.includes(bucketKey)) {
                bucketIndex.push(bucketKey);
            }

            const validBucketKeys = bucketIndex.filter(key => {
                const suffix = key.replace(LOG_BUCKET_PREFIX, '');
                const bucketTime = Date.parse(`${suffix}T00:00:00Z`);
                return !Number.isNaN(bucketTime) && (now - bucketTime) <= (MAX_LOG_AGE_MS + 24 * 60 * 60 * 1000);
            });

            await saveLogBucketIndex(kv, validBucketKeys);
        } catch (error) {
            console.error('[LogService] Failed to flush batch logs:', error);
            // 写入失败时尝试把日志塞回队列前部
            logBatch.unshift(...batchToFlush);
        } finally {
            // 检查是否有在刷盘期间新进来的日志
            if (logBatch.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
                await this._flush(env);
            } else {
                isFlushing = false;
            }
        }
    },

    /**
     * 获取日志列表
     * @param {Object} env - Cloudflare Environment
     */
    async getLogs(env) {
        const kv = getKV(env);
        if (!kv) return [];
        try {
            const [bucketIndex, legacyRaw] = await Promise.all([
                getLogBucketIndex(kv),
                kv.get(LOG_KV_KEY)
            ]);

            const bucketEntries = await Promise.all(
                bucketIndex.map(key => kv.get(key).then(raw => raw ? JSON.parse(raw) : []).catch(() => []))
            );

            const legacyLogs = legacyRaw ? JSON.parse(legacyRaw) : null;
            const logs = [...bucketEntries.flat(), ...(Array.isArray(legacyLogs) ? legacyLogs : [])]
                .filter(log => (Date.now() - log.timestamp) <= MAX_LOG_AGE_MS)
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, MAX_LOG_ENTRIES);

            return logs;
        } catch (error) {
            console.error('[LogService] Failed to get logs:', error);
            return [];
        }
    },

    /**
     * 清空日志
     * @param {Object} env - Cloudflare Environment
     */
    async clearLogs(env) {
        const kv = getKV(env);
        if (!kv) return;
        try {
            const bucketIndex = await getLogBucketIndex(kv);
            await Promise.all([
                kv.delete(LOG_KV_KEY),
                kv.delete(LOG_INDEX_KV_KEY),
                ...bucketIndex.map(key => kv.delete(key))
            ]);
            return true;
        } catch (error) {
            console.error('[LogService] Failed to clear logs:', error);
            return false;
        }
    }
};
