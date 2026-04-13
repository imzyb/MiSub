/**
 * iOS客户端缓存优化服务
 * 专门处理Surge和Loon的缓存策略
 */

const IOS_CACHE_CONFIG = {
    CACHE_TTL: 300000, // 5分钟缓存
    IOS_CLIENTS: ['surge', 'loon', 'egern'],
    CACHE_KEY_PREFIX: 'ios_sub_'
};

class IOSCacheService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * 生成iOS客户端缓存键
     */
    generateCacheKey(url, userAgent, targetFormat) {
        const client = this.detectIOSClient(userAgent);
        if (!client) return null;

        return `${IOS_CACHE_CONFIG.CACHE_KEY_PREFIX}${client}_${btoa(url)}_${targetFormat}`;
    }

    /**
     * 检测是否为iOS客户端
     */
    detectIOSClient(userAgent) {
        if (!userAgent) return null;
        const ua = userAgent.toLowerCase();

        for (const client of IOS_CACHE_CONFIG.IOS_CLIENTS) {
            if (ua.includes(client) && !ua.includes('mac')) {
                return client;
            }
        }
        return null;
    }

    /**
     * 获取缓存的订阅内容
     */
    get(url, userAgent, targetFormat) {
        const cacheKey = this.generateCacheKey(url, userAgent, targetFormat);
        if (!cacheKey) return null;

        const cached = this.cache.get(cacheKey);
        if (!cached) return null;

        // 检查是否过期
        if (Date.now() - cached.timestamp > IOS_CACHE_CONFIG.CACHE_TTL) {
            this.cache.delete(cacheKey);
            return null;
        }

        console.log(`[iOS缓存] 命中缓存: ${cacheKey}`);
        return cached.data;
    }

    /**
     * 设置缓存
     */
    set(url, userAgent, targetFormat, data) {
        const cacheKey = this.generateCacheKey(url, userAgent, targetFormat);
        if (!cacheKey) return;

        this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });

        console.log(`[iOS缓存] 设置缓存: ${cacheKey}`);
    }

    /**
     * 清理过期缓存
     */
    cleanup() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > IOS_CACHE_CONFIG.CACHE_TTL) {
                this.cache.delete(key);
            }
        }
    }
}

// 导出单例实例
export const iosCacheService = new IOSCacheService();

// 定期清理缓存
setInterval(() => {
    iosCacheService.cleanup();
}, 60000); // 每分钟清理一次
