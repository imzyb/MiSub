/**
 * 流量统计和监控服务
 * 借鉴miaomiaowu的流量同步功能，适配Cloudflare Pages
 */

class TrafficMonitor {
    constructor(env) {
        this.env = env;
        this.trafficCache = new Map();
        this.cacheTTL = 30 * 60 * 1000; // 30分钟缓存
    }

    /**
     * 解析流量信息头
     * @param {string} header - subscription-userinfo头
     * @returns {Object}
     */
    parseTrafficHeader(header) {
        if (!header) return null;

        const traffic = {};
        const parts = header.split(';');

        parts.forEach(part => {
            const [key, value] = part.split('=');
            if (!key || !value) return;

            const trimmedKey = key.trim();
            const trimmedValue = value.trim();

            switch (trimmedKey) {
                case 'upload':
                    traffic.upload = this.parseTrafficValue(trimmedValue);
                    break;
                case 'download':
                    traffic.download = this.parseTrafficValue(trimmedValue);
                    break;
                case 'total':
                    traffic.total = this.parseTrafficValue(trimmedValue);
                    break;
                case 'expire':
                    traffic.expire = parseInt(trimmedValue, 10);
                    break;
            }
        });

        return Object.keys(traffic).length > 0 ? traffic : null;
    }

    /**
     * 解析流量数值
     * @param {string} value - 流量字符串
     * @returns {number}
     */
    parseTrafficValue(value) {
        if (!value) return 0;

        // 处理带单位的流量值
        const unit = value.slice(-1).toLowerCase();
        const num = parseFloat(value.slice(0, -1));

        if (isNaN(num)) return 0;

        switch (unit) {
            case 'k':
            case 'kb':
                return num * 1024;
            case 'm':
            case 'mb':
                return num * 1024 * 1024;
            case 'g':
            case 'gb':
                return num * 1024 * 1024 * 1024;
            case 't':
            case 'tb':
                return num * 1024 * 1024 * 1024 * 1024;
            default:
                return num;
        }
    }

    /**
     * 获取并缓存流量信息
     * @param {string} subscriptionUrl - 订阅URL
     * @param {string} userAgent - User-Agent
     * @returns {Promise<Object>}
     */
    async getTrafficInfo(subscriptionUrl, userAgent = 'clash-meta/2.5.0') {
        const cacheKey = `${subscriptionUrl}_${userAgent}`;

        // 检查缓存
        const cached = this.trafficCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        try {
            // 发送HEAD请求获取流量信息
            const response = await fetch(subscriptionUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': userAgent
                }
            });

            const header = response.headers.get('subscription-userinfo');
            const traffic = this.parseTrafficHeader(header);

            // 缓存结果
            this.trafficCache.set(cacheKey, {
                data: traffic,
                timestamp: Date.now()
            });

            return traffic;
        } catch (error) {
            console.error('[TrafficMonitor] 获取流量信息失败:', error);
            return null;
        }
    }

    /**
     * 计算剩余流量百分比
     * @param {Object} traffic - 流量信息
     * @returns {number}
     */
    calculateRemainingPercent(traffic) {
        if (!traffic || !traffic.total) return 100;

        const used = (traffic.upload || 0) + (traffic.download || 0);
        const remaining = traffic.total - used;

        return Math.max(0, Math.min(100, (remaining / traffic.total) * 100));
    }

    /**
     * 检查流量警告
     * @param {Object} traffic - 流量信息
     * @param {number} thresholdPercent - 警告阈值百分比
     * @returns {boolean}
     */
    shouldWarnTraffic(traffic, thresholdPercent = 90) {
        const percent = this.calculateRemainingPercent(traffic);
        return percent <= thresholdPercent;
    }

    /**
     * 清理过期缓存
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.trafficCache.entries()) {
            if (now - value.timestamp > this.cacheTTL) {
                this.trafficCache.delete(key);
            }
        }
    }
}

export const trafficMonitor = new TrafficMonitor();

// 定期清理缓存
setInterval(() => {
    trafficMonitor.cleanupCache();
}, 60 * 60 * 1000); // 每小时清理一次