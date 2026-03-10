import { COMMON_NODE_PROTOCOLS } from '../../constants/nodeProtocols.js';

/**
 * 验证生成的URL是否有效
 */
export function validateGeneratedUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    try {
        const supportedProtocols = COMMON_NODE_PROTOCOLS;

        // 检查是否包含协议分隔符
        if (!url.includes('://')) {
            return false;
        }

        const protocol = url.split('://')[0].toLowerCase();

        // 检查协议是否支持
        if (!supportedProtocols.includes(protocol)) {
            return false;
        }

        // [FIX] 检查URL格式的完整性
        // 1. 不应该包含多个 '?' (查询参数分隔符只能有一个)
        const questionMarkCount = (url.match(/\?/g) || []).length;
        if (questionMarkCount > 1) {
            console.warn(`[URL Validation] 无效URL - 包含多个问号: ${url.substring(0, 100)}...`);
            return false;
        }

        // 2. 基本的URL结构验证
        const urlParts = url.split('://');
        if (urlParts.length !== 2 || !urlParts[1]) {
            return false;
        }

        // 3. 确保有服务器地址部分
        const afterProtocol = urlParts[1];
        if (afterProtocol.length < 3) { // 至少需要 "x:y" 这样的格式
            return false;
        }

        return true;
    } catch (e) {
        console.error('[URL Validation] 验证失败:', e);
        return false;
    }
}
