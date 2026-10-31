/**
 * 机场域名推断（前端）
 *
 * 与后端 functions/services/subscription-service.js 的 inferAirportRootDomain 保持一致。
 * 订阅常挂在子域名上，去掉常见前缀后取主域名，供「点击访问官网」使用。
 *
 * 注意：CDN / 托管平台域名不属于机场自有域名，返回空字符串。
 */

const NON_AIRPORT_HOSTS = [
    /\.pages\.dev$/i,
    /\.workers\.dev$/i,
    /\.vercel\.app$/i,
    /\.netlify\.app$/i,
    /\.githubusercontent\.com$/i,
    /\.github\.io$/i,
    /\.r2\.dev$/i,
    /\.trafficmanager\.net$/i,
    /\.cloudfront\.net$/i,
    /\.herokuapp\.com$/i,
    /\.onrender\.com$/i,
];

const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
    'com.cn',
    'net.cn',
    'org.cn',
    'gov.cn',
    'com.hk',
    'com.tw',
    'co.uk',
    'org.uk',
    'me.uk',
    'ac.uk',
    'gov.uk',
    'com.au',
    'net.au',
    'org.au',
    'co.jp',
    'co.kr',
    'co.nz',
    'com.sg',
    'appspot.com',
]);

const COMMON_SUBDOMAIN_LABELS = new Set([
    'sub',
    'sub1',
    'sub2',
    'sub3',
    'sub4',
    'sub5',
    'api',
    'www',
    'jms',
    'dy',
    'node',
    'nodes',
    'cdn',
    's',
    'go',
    'get',
    'link',
    'links',
    'v',
    'v2',
]);

/**
 * 从订阅 URL 推断机场主域名
 * @param {string} sourceUrl
 * @returns {string} 主域名，无法推断时返回空字符串
 */
export function inferAirportRootDomain(sourceUrl) {
    const raw = String(sourceUrl || '').trim();
    if (!/^https?:\/\//i.test(raw)) return '';

    try {
        const host = new URL(raw).hostname.toLowerCase();
        if (!host.includes('.')) return '';
        if (NON_AIRPORT_HOSTS.some((re) => re.test(host))) return '';

        const parts = host.split('.');
        const suffix = parts.slice(-2).join('.');
        const rootLabelCount = MULTI_LABEL_PUBLIC_SUFFIXES.has(suffix) ? 3 : 2;
        let base;
        if (parts.length >= 3) {
            const first = parts[0];
            const isCommonPrefix = COMMON_SUBDOMAIN_LABELS.has(first);
            const isNumberedPrefix = /^[a-z]{0,4}\d+$/i.test(first);
            base = parts.slice(-rootLabelCount);
        } else {
            base = parts;
        }

        const root = base.join('.');
        return root.split('.').length >= 2 ? root : '';
    } catch {
        return '';
    }
}
