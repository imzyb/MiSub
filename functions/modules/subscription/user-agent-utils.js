/**
 * User-Agent Utility Functions
 * Handles browser detection and target format determination based on User-Agent strings.
 */

/**
 * 判断是否为浏览器请求（用于伪装/公开页逻辑）
 * 排除常见的代理客户端 User-Agent
 * @param {string} userAgent 
 * @returns {boolean}
 */
export function isBrowserAgent(userAgent) {
    if (!userAgent) return false;
    // Common browser keywords
    // [Updated] Explicitly added: Firefox, Via, UCBrowser, Quark, MQQBrowser (QQ), Konqueror
    const isBrowser = /Mozilla|Chrome|Safari|Edge|Opera|Firefox|Via|UCBrowser|Quark|MQQBrowser|Konqueror/i.test(userAgent);
    // Common proxy client keywords to exclude
    const isProxyClient = /clash|v2ray|surge|loon|shadowrocket|quantumult|stash|shadowsocks|mihomo|meta|nekobox|nekoray|sfi|sfa|sfra/i.test(userAgent);

    return isBrowser && !isProxyClient;
}

/**
 * 根据 User-Agent 和 URL 参数确定目标格式
 * @param {string} userAgent 
 * @param {URLSearchParams} searchParams 
 * @returns {string} targetFormat (e.g., 'clash', 'singbox', 'base64')
 */
export function determineTargetFormat(userAgent, searchParams) {
    // 1. Check URL parameters first
    let targetFormat = searchParams.get('target');
    if (!targetFormat) {
        const supportedFormats = ['clash', 'singbox', 'surge', 'loon', 'base64', 'v2ray', 'trojan', 'quanx'];
        for (const format of supportedFormats) {
            if (searchParams.has(format)) {
                // Normalize v2ray/trojan to base64 as they share the output format
                targetFormat = (format === 'v2ray' || format === 'trojan') ? 'base64' : format;
                break;
            }
        }
    }

    if (targetFormat) {
        const normalizedTarget = targetFormat.toLowerCase();
        if (normalizedTarget === 'singbox' || normalizedTarget === 'sing-box') {
            return 'base64';
        }
        if (normalizedTarget === 'surge') {
            const ver = searchParams.get('ver');
            const safeVer = ver && /^\d+$/.test(ver) ? parseInt(ver, 10) : 4;
            return `surge&ver=${safeVer}`;
        }
        if (normalizedTarget.startsWith('surge&ver=')) {
            return normalizedTarget;
        }
        return targetFormat;
    }

    // 2. Check User-Agent
    const ua = (userAgent || '').toLowerCase();

    // --- Surge Specific Handling ---
    // Extract version accurately (e.g., "Surge/4.0", "Surge Mac/3.0", "Surge-Mac/5.0")
    if (ua.includes('surge')) {
        const surgeMatch = ua.match(/surge(?:\s*-?\s*mac)?\/(\d+)/);
        if (surgeMatch) {
            const version = parseInt(surgeMatch[1], 10);
            // Subconverter primarily supports &ver=2, 3, 4. For versions >= 4, use 4.
            return `surge&ver=${version >= 4 ? 4 : Math.max(2, version)}`;
        }
        return 'surge&ver=4';
    }

    // Mapping array to ensure priority order
    const uaMapping = [
        // Mihomo/Meta Core Clients -> Clash
        ['flclash', 'clash'],
        ['flyclash', 'clash'],
        ['butterfly', 'clash'],
        ['mihomo', 'clash'],
        ['clash.meta', 'clash'],
        ['clash-verge', 'clash'],
        ['meta', 'clash'],

        // Other Clients
        ['stash', 'clash'],
        ['nekoray', 'clash'],
        ['sing-box', 'base64'],
        ['singbox', 'base64'],
        ['shadowrocket', 'base64'],
        ['v2rayn', 'base64'],
        ['v2rayng', 'base64'],
        ['loon', 'loon'],
        ['quantumult%20x', 'quanx'],
        ['quantumult', 'quanx'],

        // Fallback for generic clash
        ['clash', 'clash']
    ];

    for (const [keyword, format] of uaMapping) {
        if (ua.includes(keyword)) {
            return format;
        }
    }

    // 3. Default fallback
    return 'base64';
}
