/**
 * 订阅同步管理器
 * 借鉴Sub-Store的同步机制，适配Cloudflare Pages
 */

class SubscriptionSyncManager {
    constructor(env) {
        this.env = env;
        this.syncStates = new Map();
    }

    /**
     * 检查订阅是否需要同步
     * @param {string} subscriptionId
     * @param {number} cacheExpireMinutes - 缓存过期时间（分钟）
     * @returns {boolean}
     */
    shouldSync(subscriptionId, cacheExpireMinutes = 60) {
        const state = this.syncStates.get(subscriptionId);
        if (!state) return true;

        const elapsed = Date.now() - state.lastSync;
        const expireMs = cacheExpireMinutes * 60 * 1000;

        return elapsed > expireMs;
    }

    /**
     * 记录同步状态
     * @param {string} subscriptionId
     * @param {boolean} success
     * @param {string} error
     */
    recordSync(subscriptionId, success = true, error = null) {
        this.syncStates.set(subscriptionId, {
            lastSync: Date.now(),
            success,
            error,
            consecutiveFailures: success ? 0 : (this.syncStates.get(subscriptionId)?.consecutiveFailures || 0) + 1
        });
    }

    /**
     * 获取同步状态
     * @param {string} subscriptionId
     * @returns {Object}
     */
    getSyncState(subscriptionId) {
        return this.syncStates.get(subscriptionId) || {
            lastSync: 0,
            success: true,
            error: null,
            consecutiveFailures: 0
        };
    }

    /**
     * 清理过期状态
     */
    cleanup() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24小时前
        for (const [key, state] of this.syncStates.entries()) {
            if (state.lastSync < cutoff) {
                this.syncStates.delete(key);
            }
        }
    }
}

export const subscriptionSyncManager = new SubscriptionSyncManager();

// 定期清理
setInterval(() => {
    subscriptionSyncManager.cleanup();
}, 60 * 60 * 1000); // 每小时清理一次