/**
 * 订阅组合管理器
 * 借鉴Sub-Store的组合订阅功能，适配Cloudflare Pages
 */

class SubscriptionCombiner {
    constructor() {
        this.combinedCache = new Map();
        this.cacheTTL = 15 * 60 * 1000; // 15分钟缓存
    }

    /**
     * 组合多个订阅
     * @param {Array} subscriptions - 订阅配置数组
     * @param {Object} options - 组合选项
     * @returns {Promise<Array>} - 组合后的节点列表
     */
    async combineSubscriptions(subscriptions = [], options = {}) {
        const {
            ignoreFailed = false, // 忽略失败的订阅
            deduplicate = true,   // 去重
            maxConcurrency = 3    // 最大并发数
        } = options;

        if (!subscriptions.length) return [];

        // 生成缓存键
        const cacheKey = this.generateCacheKey(subscriptions, options);
        const cached = this.combinedCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            console.log('[SubscriptionCombiner] 使用缓存的组合结果');
            return cached.data;
        }

        console.log(`[SubscriptionCombiner] 开始组合 ${subscriptions.length} 个订阅`);

        const results = [];
        const errors = [];

        // 分批处理，避免并发过多
        for (let i = 0; i < subscriptions.length; i += maxConcurrency) {
            const batch = subscriptions.slice(i, i + maxConcurrency);

            const batchPromises = batch.map(async (sub, index) => {
                try {
                    const nodes = await this.fetchSubscription(sub, index + i);
                    return { success: true, nodes, subscription: sub };
                } catch (error) {
                    console.error(`[SubscriptionCombiner] 订阅 ${sub.name || sub.url} 获取失败:`, error);
                    return { success: false, error, subscription: sub };
                }
            });

            const batchResults = await Promise.all(batchPromises);

            batchResults.forEach(result => {
                if (result.success) {
                    results.push(...result.nodes);
                } else {
                    errors.push(result);
                }
            });
        }

        // 处理失败的订阅
        if (errors.length > 0) {
            if (!ignoreFailed) {
                throw new Error(`组合订阅失败: ${errors.length} 个订阅获取失败`);
            }
            console.warn(`[SubscriptionCombiner] 忽略 ${errors.length} 个失败的订阅`);
        }

        let combinedNodes = results;

        // 去重
        if (deduplicate) {
            combinedNodes = this.deduplicateNodes(combinedNodes);
            console.log(`[SubscriptionCombiner] 去重后剩余 ${combinedNodes.length} 个节点`);
        }

        // 缓存结果
        this.combinedCache.set(cacheKey, {
            data: combinedNodes,
            timestamp: Date.now()
        });

        console.log(`[SubscriptionCombiner] 组合完成，共 ${combinedNodes.length} 个节点`);
        return combinedNodes;
    }

    /**
     * 获取单个订阅
     * @param {Object} subscription - 订阅配置
     * @param {number} index - 索引
     * @returns {Promise<Array>}
     */
    async fetchSubscription(subscription, index) {
        const { url, userAgent = 'clash-meta/2.5.0', timeout = 15000 } = subscription;

        console.log(`[SubscriptionCombiner] 获取订阅 ${index + 1}: ${subscription.name || url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': userAgent
            },
            signal: AbortSignal.timeout(timeout)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();

        // 简单解析Clash格式
        try {
            const config = jsyaml.load(content);
            return config.proxies || [];
        } catch (error) {
            // 如果不是YAML，尝试base64解码
            try {
                const decoded = atob(content.trim());
                const config = jsyaml.load(decoded);
                return config.proxies || [];
            } catch (decodeError) {
                throw new Error('无法解析订阅内容');
            }
        }
    }

    /**
     * 节点去重
     * @param {Array} nodes - 节点列表
     * @returns {Array}
     */
    deduplicateNodes(nodes) {
        const seen = new Set();
        return nodes.filter(node => {
            const key = `${node.server}:${node.port}:${node.type}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 生成缓存键
     * @param {Array} subscriptions - 订阅列表
     * @param {Object} options - 选项
     * @returns {string}
     */
    generateCacheKey(subscriptions, options) {
        const subKeys = subscriptions.map(sub => `${sub.url}_${sub.userAgent || ''}`).sort();
        return `${subKeys.join('|')}_${JSON.stringify(options)}`;
    }

    /**
     * 清理过期缓存
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.combinedCache.entries()) {
            if (now - value.timestamp > this.cacheTTL) {
                this.combinedCache.delete(key);
            }
        }
    }
}

export const subscriptionCombiner = new SubscriptionCombiner();

// 定期清理缓存
setInterval(() => {
    subscriptionCombiner.cleanupCache();
}, 30 * 60 * 1000); // 每30分钟清理一次