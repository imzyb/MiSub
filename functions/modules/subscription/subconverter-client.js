const DEFAULT_SUBCONVERTER_FALLBACKS = [
    'sub.d1.mk', // [Changed] Prioritize d1.mk
    'subapi.cmliussss.net',
    'sub.xeton.dev'
];

const YAML_UNSAFE_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;

/**
 * 清理会破坏 YAML/配置解析的控制字符。
 * 保留 Unicode 字符（含中文/emoji），避免误伤节点名称。
 * @param {string} content - 原始配置内容
 * @returns {{content: string, replacedCount: number}}
 */
export function sanitizeConvertedSubscriptionContent(content) {
    if (typeof content !== 'string' || content.length === 0) {
        return { content: content || '', replacedCount: 0 };
    }

    let replacedCount = 0;
    const sanitized = content.replace(YAML_UNSAFE_CONTROL_CHARS, () => {
        replacedCount += 1;
        return '';
    });

    return { content: sanitized, replacedCount };
}

/**
 * 构建返回给客户端的响应头，避免透传与实际响应体不一致的压缩/长度头。
 * @param {Headers} backendHeaders
 * @param {string} subName
 * @param {Object} cacheHeaders
 * @returns {Headers}
 */
export function buildClientResponseHeaders(backendHeaders, subName, cacheHeaders = {}) {
    const responseHeaders = new Headers(backendHeaders);

    // Node.js fetch 可能已自动解压，但仍保留 content-encoding，
    // 会导致客户端二次解压报错（如 Clash 的 Filter error, bad data）。
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');

    responseHeaders.set('Content-Disposition', `attachment; filename*=utf-8''${encodeURIComponent(subName)}`);
    responseHeaders.set('Content-Type', 'text/plain; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-store, no-cache');

    Object.entries(cacheHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
    });

    return responseHeaders;
}

/**
 * 构建 SubConverter 请求的基础 URL，兼容带/不带协议的配置
 * @param {string} backend - 用户配置的 SubConverter 地址
 * @returns {URL} - 规范化后的 URL 对象，指向 /sub 路径
 */
export function normalizeSubconverterUrl(backend) {
    if (!backend || backend.trim() === '') {
        throw new Error('Subconverter backend is not configured.');
    }

    const trimmed = backend.trim();
    const hasProtocol = /^https?:\/\//i.test(trimmed);

    let baseUrl;
    try {
        baseUrl = new URL(hasProtocol ? trimmed : `https://${trimmed}`);
    } catch (err) {
        throw new Error(`Invalid Subconverter backend: ${trimmed}`);
    }

    const normalizedPath = baseUrl.pathname.replace(/\/+$/, '');
    if (!normalizedPath || normalizedPath === '') {
        baseUrl.pathname = '/sub';
    } else if (!/\/sub$/i.test(normalizedPath)) {
        baseUrl.pathname = `${normalizedPath}/sub`;
    } else {
        baseUrl.pathname = normalizedPath;
    }

    return baseUrl;
}

/**
 * 针对无协议的后端生成 https/http 两种候选，确保最大兼容性
 * @param {string} backend - 用户输入的后端
 * @returns {URL[]} - 去重后的 URL 列表
 */
export function buildSubconverterUrlVariants(backend) {
    const variants = [];
    const hasProtocol = /^https?:\/\//i.test(backend.trim());

    const rawCandidates = hasProtocol
        ? [backend.trim()]
        : [`https://${backend.trim()}`, `http://${backend.trim()}`];

    for (const candidate of rawCandidates) {
        try {
            const urlObj = normalizeSubconverterUrl(candidate);
            // 去重：比较 href
            if (!variants.some(v => v.href === urlObj.href)) {
                variants.push(urlObj);
            }
        } catch (err) {
            // 如果某个变体非法，忽略并继续下一个
            continue;
        }
    }

    return variants;
}

/**
 * 获取 SubConverter 备选列表（去重）
 * @param {string} primary - 首选后端
 * @returns {string[]} - 去重后的候选列表
 */
export function getSubconverterCandidates(primary) {
    const all = [primary, ...DEFAULT_SUBCONVERTER_FALLBACKS];
    return all
        .filter(Boolean)
        .map(item => item.trim())
        .filter((item, index, arr) => item !== '' && arr.indexOf(item) === index);
}

/**
 * 从 Subconverter 获取转换后的订阅
 * @param {string[]} candidates - 后端 URL 列表
 * @param {Object} options - 请求选项
 * @param {string} options.targetFormat - 目标格式
 * @param {string} options.callbackUrl - 回调 URL (for conversion)
 * @param {string|null} options.subConfig - 外部配置 URL
 * @param {string} options.subName - 订阅名称 (for filename)
 * @param {Object} options.cacheHeaders - 需要透传的缓存头
 * @param {boolean} [options.enableScv=false] - 是否禁用证书校验
 * @param {boolean} [options.enableUdp=false] - 是否启用 UDP
 * @param {number} [options.timeout=15000] - 单次请求超时时间(ms)
 * @returns {Promise<{response: Response, usedEndpoint: string}>}
 * @throws {Error} 如果所有尝试都失败
 */
export async function fetchFromSubconverter(candidates, options) {
    const {
        targetFormat,
        callbackUrl,
        subConfig,
        subName,
        cacheHeaders = {},
        enableScv = false,
        enableUdp = false,
        enableEmoji = false,
        timeout = 15000
    } = options;

    const triedEndpoints = [];
    let lastError = null;

    // [Debug Logging Entry]
    console.log(`[SubConverter Start] Candidates: ${JSON.stringify(candidates)}`);

    for (const backend of candidates) {
        const variants = buildSubconverterUrlVariants(backend);

        for (const subconverterUrl of variants) {
            triedEndpoints.push(subconverterUrl.origin + subconverterUrl.pathname);

            try {
                // Build Query Params
                subconverterUrl.searchParams.set('target', targetFormat);
                subconverterUrl.searchParams.set('url', callbackUrl);
                if (enableScv) {
                    subconverterUrl.searchParams.set('scv', 'true');
                }
                if (enableUdp) {
                    subconverterUrl.searchParams.set('udp', 'true');
                }
                subconverterUrl.searchParams.set('emoji', enableEmoji ? 'true' : 'false');

                if ((targetFormat === 'clash' || targetFormat === 'loon' || targetFormat === 'surge') &&
                    subConfig && subConfig.trim() !== '') {
                    subconverterUrl.searchParams.set('config', subConfig);
                }

                // Timeout Control
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                let response;
                try {
                    response = await fetch(subconverterUrl.toString(), {
                        method: 'GET',
                        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MiSub-Backend)' },
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timeoutId);
                }

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`Status ${response.status}: ${errorBody}`);
                }

                // Success! Prepare Response
                let responseText = await response.text();

                // [Sanitize Response V9] TRUE Whitelist & Hex Logging
                let isBase64 = false;
                let decodedText = responseText;

                // Simple Base64 detection
                if (!responseText.includes('\n') && /^[A-Za-z0-9+/=]+$/.test(responseText.trim())) {
                    try {
                        const rawDecoded = atob(responseText.trim());
                        // Verify if it looks like YAML/Config
                        if (rawDecoded.includes('proxies:') || rawDecoded.includes('name:')) {
                            decodedText = rawDecoded;
                            isBase64 = true;
                        }
                    } catch (e) {
                        // Not base64, treat as text
                    }
                }

                const { content: sanitizedText, replacedCount } = sanitizeConvertedSubscriptionContent(decodedText);
                if (replacedCount > 0) {
                    console.log(`[MiSub Sanitize] Removed ${replacedCount} unsafe control chars in ${isBase64 ? 'Base64' : 'Plain'} content.`);
                }
                if (isBase64) {
                    responseText = btoa(sanitizedText);
                } else {
                    responseText = sanitizedText;
                }

                // [Debug Logging Response]
                console.log(`[SubConverter Response] Status: ${response.status}`);
                console.log(`[SubConverter Preview] ${responseText.slice(0, 500)}`);

                // [Validation] Check for invalid HTML response 
                if (responseText.trim().startsWith('<!DOCTYPE html>') || responseText.includes('<html')) {
                    throw new Error(`Backend returned HTML instead of subscription content: ${responseText.slice(0, 100)}...`);
                }

                const responseHeaders = buildClientResponseHeaders(response.headers, subName, cacheHeaders);

                return {
                    response: new Response(responseText, {
                        status: 200,
                        statusText: 'OK',
                        headers: responseHeaders
                    }),
                    usedEndpoint: subconverterUrl.origin
                };

            } catch (error) {
                lastError = error;
                // [Enhanced Logging]
                console.log(`[SubConverter Error] Backend: ${subconverterUrl.origin}, URL: ${subconverterUrl.toString()}`);
                console.log(`[SubConverter Error] Details:`, error);
                console.warn(`[SubConverter] Error with backend ${subconverterUrl.origin}: ${error.message}`);
            }
        }
    }

    // If we get here, all failed
    throw new Error(`${lastError ? lastError.message : 'Unknown error'}. Tried: ${triedEndpoints.join(', ')}`);
}
