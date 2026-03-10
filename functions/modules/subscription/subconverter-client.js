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
 * 构建返回给客户端的响应头
 * @param {Headers} backendHeaders
 * @param {string} subName
 * @param {string} targetFormat
 * @param {Object} cacheHeaders
 * @returns {Headers}
 */
export function buildClientResponseHeaders(backendHeaders, subName, targetFormat = '', cacheHeaders = {}) {
    // [修正] 不再拷贝后端所有头信息，避免透传 subscription-userinfo 等头导致
    // FlClash 等客户端解析崩溃（Dart RangeError）。
    const responseHeaders = new Headers();

    responseHeaders.set('Content-Disposition', `attachment; filename*=utf-8''${encodeURIComponent(subName)}`);
    
    // 根据目标格式设置 Content-Type
    if (targetFormat.includes('clash')) {
        responseHeaders.set('Content-Type', 'text/yaml; charset=utf-8');
    } else {
        responseHeaders.set('Content-Type', 'text/plain; charset=utf-8');
    }

    responseHeaders.set('Cache-Control', 'no-store, no-cache');

    // 仅保留安全的、MiSub 自定义的缓存状态头
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

    console.log(`[SubConverter Start] Candidates: ${JSON.stringify(candidates)}`);

    // 展平所有的变体成一个一维数组
    const allVariants = [];
    for (const backend of candidates) {
        allVariants.push(...buildSubconverterUrlVariants(backend));
    }

    if (allVariants.length === 0) {
        throw new Error('No valid subconverter backend candidates');
    }

    const HEDGE_DELAY_MS = 1500; // 错峰时间 1.5 秒
    const controllers = [];
    const errors = [];

    return new Promise((resolve, reject) => {
        let isResolved = false;
        let activeCount = 0;
        let index = 0;
        let nextTimer = null;

        const attemptNext = () => {
            if (isResolved) return;

            if (index >= allVariants.length) {
                if (activeCount === 0) {
                    reject(new Error(`All subconverter attempts failed. Tried: ${allVariants.map(v => v.origin).join(', ')}. Errors: ${errors.map(e => e.message).join(' | ')}`));
                }
                return;
            }

            const subconverterUrl = allVariants[index++];
            activeCount++;

            const controller = new AbortController();
            controllers.push(controller);
            let reqTimeoutId = null;

            (async () => {
                try {
                    // 构建查询参数
                    subconverterUrl.searchParams.set('target', targetFormat);
                    subconverterUrl.searchParams.set('url', callbackUrl);
                    if (enableScv) subconverterUrl.searchParams.set('scv', 'true');
                    if (enableUdp) subconverterUrl.searchParams.set('udp', 'true');
                    subconverterUrl.searchParams.set('emoji', enableEmoji ? 'true' : 'false');

                    if ((targetFormat === 'clash' || targetFormat === 'loon' || targetFormat.startsWith('surge')) &&
                        subConfig && subConfig.trim() !== '') {
                        subconverterUrl.searchParams.set('config', subConfig);
                    }

                    // 单个请求的绝对生命周期
                    reqTimeoutId = setTimeout(() => controller.abort(), timeout);

                    const response = await fetch(subconverterUrl.toString(), {
                        method: 'GET',
                        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MiSub-Backend)' },
                        signal: controller.signal
                    });

                    if (!response.ok) {
                        const errorBody = await response.text();
                        throw new Error(`Status ${response.status}: ${errorBody}`);
                    }

                    // 处理响应...
                    let responseText = await response.text();
                    let isBase64 = false;
                    let decodedText = responseText;

                    if (!responseText.includes('\n') && /^[A-Za-z0-9+/=]+$/.test(responseText.trim())) {
                        try {
                            const rawDecoded = atob(responseText.trim());
                            if (rawDecoded.includes('proxies:') || rawDecoded.includes('name:')) {
                                decodedText = rawDecoded;
                                isBase64 = true;
                            }
                        } catch (e) {
                            // 不做处理，保持非Base64
                        }
                    }

                    const { content: sanitizedText, replacedCount } = sanitizeConvertedSubscriptionContent(decodedText);
                    if (replacedCount > 0) {
                        console.log(`[MiSub Sanitize] Removed ${replacedCount} unsafe control chars. Base64: ${isBase64}`);
                    }
                    
                    // [修正] 只有目标格式明确要求是 base64 时才返回 base64。
                    // 以前的逻辑是：如果后端返回了 base64，我们就再转回去。
                    // 但对于 Clash 等客户端，即使后端由于某种原因返回了 base64，MiSub 也应该解码成明文发给客户端。
                    responseText = (targetFormat === 'base64') ? btoa(sanitizedText) : sanitizedText;

                    if (responseText.trim().startsWith('<!DOCTYPE html>') || responseText.includes('<html')) {
                        throw new Error(`Backend returned HTML instead of subscription. Prefix: ${responseText.slice(0, 100)}`);
                    }

                    const responseHeaders = buildClientResponseHeaders(response.headers, subName, targetFormat, cacheHeaders);

                    if (!isResolved) {
                        isResolved = true;
                        if (nextTimer) clearTimeout(nextTimer);
                        
                        // 结束并清理其他竞态请求
                        controllers.forEach(c => {
                            if (c !== controller) c.abort();
                        });

                        resolve({
                            response: new Response(responseText, {
                                status: 200,
                                statusText: 'OK',
                                headers: responseHeaders
                            }),
                            usedEndpoint: subconverterUrl.origin
                        });
                    }

                } catch (error) {
                    if (error.name !== 'AbortError') {
                        errors.push(error);
                        console.warn(`[SubConverter Error] Backend: ${subconverterUrl.origin} | Msg: ${error.message}`);
                    }
                } finally {
                    if (reqTimeoutId) clearTimeout(reqTimeoutId);
                    activeCount--;
                    
                    // 如果自己失败了，但在超时前，立刻尝试下一个
                    if (!isResolved && activeCount === 0 && index < allVariants.length) {
                        if (nextTimer) clearTimeout(nextTimer);
                        attemptNext();
                    } else if (!isResolved && activeCount === 0 && index >= allVariants.length) {
                        // 彻底所有请求都失败完毕
                        reject(new Error(`All subconverter attempts failed. Tried: ${allVariants.map(v => v.origin).join(', ')}. Errors: ${errors.map(e => e.message).join(' | ')}`));
                    }
                }
            })();

            // 每隔 HEDGE_DELAY_MS 启动下一个兜底请求 (错峰并发)
            if (!isResolved && index < allVariants.length) {
                if (nextTimer) clearTimeout(nextTimer);
                nextTimer = setTimeout(attemptNext, HEDGE_DELAY_MS);
            }
        };

        attemptNext();
    });
}
