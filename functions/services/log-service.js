/**
 * 日志服务模块
 * 处理订阅访问日志的存储和检索
 */

const LOG_KV_KEY = 'misub_system_logs';
const MAX_LOG_ENTRIES = 500;
const MAX_LOG_AGE_DAYS = 30;
const MAX_LOG_AGE_MS = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
// 全局内存队列，用于削峰填谷和防写竞争
let logBatch = [];
let isFlushing = false;

export const LogService = {
    /**
     * 添加一条新日志 (支持 Isolate 级别的批量异步写入)
     * @param {Object} env - Cloudflare Environment
     * @param {Object} logEntry - 日志内容
     */
    async addLog(env, logEntry) {
        if (!env.MISUB_KV) return;

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
            // 获取现有日志
            let logs = await env.MISUB_KV.get(LOG_KV_KEY, 'json') || [];
            if (!Array.isArray(logs)) logs = [];

            // 把新收集到的一批日志插入到头部 (倒序输入保证时间线不乱)
            logs.unshift(...batchToFlush.reverse());

            // 1. 过滤过期日志 (30天)
            const now = Date.now();
            logs = logs.filter(log => (now - log.timestamp) <= MAX_LOG_AGE_MS);

            // 2. 限制数量 (500条)
            if (logs.length > MAX_LOG_ENTRIES) {
                logs = logs.slice(0, MAX_LOG_ENTRIES);
            }

            // 保存回 KV
            await env.MISUB_KV.put(LOG_KV_KEY, JSON.stringify(logs));
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
        if (!env.MISUB_KV) return [];
        try {
            const logs = await env.MISUB_KV.get(LOG_KV_KEY, 'json');
            return Array.isArray(logs) ? logs : [];
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
        if (!env.MISUB_KV) return;
        try {
            await env.MISUB_KV.delete(LOG_KV_KEY);
            return true;
        } catch (error) {
            console.error('[LogService] Failed to clear logs:', error);
            return false;
        }
    }
};
