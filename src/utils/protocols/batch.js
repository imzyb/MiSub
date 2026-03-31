import { convertClashProxyToUrl } from './clash.js';
import { validateGeneratedUrl } from './validator.js';

/**
 * 批量转换Clash代理
 */
export function batchConvertClashProxies(proxies) {
    if (!Array.isArray(proxies)) {
        return [];
    }

    const results = [];
    for (const proxy of proxies) {
        const url = convertClashProxyToUrl(proxy);
        if (url && validateGeneratedUrl(url)) {
            results.push({
                name: proxy.name || 'Unknown',
                url: url,
                type: proxy.type,
                original: proxy
            });
        }
    }

    return results;
}
