/**
 * 格式化工具函数
 * @author MiSub Team
 */

/**
 * 修复Clash配置中的WireGuard问题
 * @param {string} content - Clash配置内容
 * @returns {string} - 修复后的配置内容
 */
export function clashFix(content) {
    if (!content || !content.includes('wireguard')) return content;

    let lines = content.split(/\r?\n/);
    let result = '';

    for (let line of lines) {
        // 如果该行包含 wireguard 配置，且缺少 remote-dns-resolve，则补充
        if (line.includes('type: wireguard') || line.includes('"type": "wireguard"') || line.includes("'type': 'wireguard'")) {
            if (!line.includes('remote-dns-resolve')) {
                // 如果是 JSON 对象格式 (用于 fallback)
                if (line.trim().startsWith('{') || line.includes('{')) {
                    line = line.replace(/}\s*$/, ', "remote-dns-resolve": true }');
                } else {
                    // 如果是 YAML 格式 (逗号分隔参数在同一行或是标准多行)
                    // 由于 JS-YAML dump 出的行通常是单行带有多个属性 {"type":"wireguard",...}，
                    // 本系统之前是以单行 YAML/JSON 呈现 proxies 项
                    // 在有问题的 js-yaml 输出中，属性会在同一行。
                    // 补充: 我们也可以直接粗暴地在末尾或括号前追加
                    if (line.endsWith('}')) {
                        line = line.replace(/}\s*$/, ', remote-dns-resolve: true}');
                    } else if (!line.includes('\n')) {
                        line += ', remote-dns-resolve: true';
                    }
                }
            }
        }
        result += line + '\n';
    }

    // 移除末尾多余的换行符
    return result.replace(/\n$/, '');
}

/**
 * 检测字符串是否为有效的Base64格式
 * @param {string} str - 要检测的字符串
 * @returns {boolean} - 是否为有效Base64
 */
export function isValidBase64(str) {
    if (!str || typeof str !== 'string') return false;

    // 去除空白字符，保证纯粹的Base64内容
    const cleanStr = str.replace(/\s/g, '');
    if (!cleanStr) return false;

    // 标准化 Base64URL 中的 -_/ 并补全 padding
    let normalized = cleanStr.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    if (padding) {
        normalized += '='.repeat(4 - padding);
    }

    const base64Regex = /^[A-Za-z0-9+\/=]+$/;
    return base64Regex.test(normalized) && normalized.length > 20;
}

/**
 * 根据客户端类型确定合适的用户代理
 * 参考CF-Workers-SUB的优雅策略：统一使用v2rayN UA获取订阅，简单而有效
 * @param {string} originalUserAgent - 原始用户代理字符串
 * @param {string} url - 请求URL（可选）
 * @returns {string} - 处理后的用户代理字符串
 */
export function getProcessedUserAgent(originalUserAgent, url = '') {
    if (!originalUserAgent) return originalUserAgent;

    // CF-Workers-SUB的精华策略：
    // 统一使用v2rayN UA获取订阅，绕过机场过滤同时保证获取完整节点
    // 不需要复杂的客户端判断，简单而有效
    return 'v2rayN/7.23';
}

/**
 * 根据User Agent确定客户端格式
 * @param {string} userAgentHeader - User-Agent头部
 * @returns {string} - 对应的格式
 */
export function determineFormatByUserAgent(userAgentHeader) {
    const ua = userAgentHeader.toLowerCase();
    // 使用陣列來保證比對的優先順序
    const uaMapping = [
        // Mihomo/Meta 核心的客戶端 - 需要clash格式
        ['flyclash', 'clash'],
        ['mihomo', 'clash'],
        ['clash.meta', 'clash'],
        ['clash-verge', 'clash'],
        ['meta', 'clash'],

        // 其他客戶端
        ['stash', 'clash'],
        ['egern', 'clash'],
        ['nekoray', 'clash'],
        ['sing-box', 'singbox'],
        ['shadowrocket', 'base64'],
        ['v2rayn', 'base64'],
        ['v2rayng', 'base64'],
        ['surge', 'surge'],
        ['loon', 'loon'],
        ['quantumult%20x', 'quanx'],
        ['quantumult', 'quanx'],

        // 最後才匹配通用的 clash，作為向下相容
        ['clash', 'clash']
    ];

    for (const [keyword, format] of uaMapping) {
        if (ua.includes(keyword)) {
            return format;
        }
    }
    return 'base64';
}

/**
 * 从URL参数中确定目标格式
 * @param {URL} url - URL对象
 * @returns {string|null} - 目标格式
 */
export function determineFormatByUrl(url) {
    let targetFormat = url.searchParams.get('target');
    if (!targetFormat) {
        const supportedFormats = ['clash', 'singbox', 'surge', 'loon', 'quanx', 'base64', 'v2ray', 'trojan', 'egern'];
        for (const format of supportedFormats) {
            if (url.searchParams.has(format)) {
                if (format === 'v2ray' || format === 'trojan') {
                    targetFormat = 'base64';
                } else {
                    targetFormat = format;
                }
                break;
            }
        }
    }
    return targetFormat;
}
