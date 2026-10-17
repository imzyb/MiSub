import { parseNodeList } from '../utils/node-parser.js';
import { fetchWithRetry } from '../../services/fetch-utils.js';
import { buildFetchProxyUrl } from '../../utils/fetch-proxy-utils.js';
import {
    readSubscriptionNodeCache,
    buildSubscriptionFilterFingerprint,
} from '../../services/subscription-service.js';
import {
    filterNodeObjects,
    parseFilterRuleText,
    encodeArrayBufferToBase64,
} from '../utils/node-cleaner.js';

/**
 * 获取单个订阅的节点
 * @param {string} url - 订阅URL
 * @param {string} subscriptionName - 订阅名称
 * @param {string} userAgent - 用户代理
 * @param {string} customUserAgent - 自定义用户代理 (可选)
 * @param {boolean} debug - 是否启用调试日志
 * @param {string} excludeRules - 过滤规则文本
 * @param {boolean} skipCertVerify - 是否跳过 TLS 证书校验
 * @param {boolean} plusAsSpace - 是否将名称中的 + 视为空格
 * @param {boolean} enableNodeCache - 是否开启保护性缓存节点
 * @param {Object} [storageAdapter] - 存储适配器（传入后上游失败时回退保护性缓存）
 * @param {Object} [subscription] - 订阅对象（构建缓存 key 与过滤指纹）
 * @returns {Promise<Object>} 节点获取结果
 */
export async function fetchSubscriptionNodes(
    url,
    subscriptionName,
    userAgent,
    customUserAgent = null,
    debug = false,
    excludeRules = '',
    fetchProxy = null,
    skipCertVerify = false,
    plusAsSpace = false,
    enableNodeCache = false,
    storageAdapter = null,
    subscription = null
) {
    // 自动检测调试 Token
    const shouldDebug = debug || (url && url.includes('b0b422857bb46aba65da8234c84f38c6'));

    /**
     * 上游拉取失败或无有效节点时，回退到保护性缓存（与订阅输出链路行为一致）。
     * @param {string|null} upstreamError 上游错误信息（回退成功时保留在结果中）
     * @param {boolean} requireFingerprintMatch 上游成功但 0 节点时，要求过滤配置
     *   与缓存写入时一致才回退——用户刚改过滤导致的 0 节点是预期结果，不得用旧缓存顶替
     * @returns {Promise<Object|null>} 回退结果，无法回退时返回 null
     */
    const fallbackToNodeCache = async (upstreamError, requireFingerprintMatch) => {
        if (!enableNodeCache || !storageAdapter || !subscription) return null;
        try {
            const cached = await readSubscriptionNodeCache(storageAdapter, subscription);
            if (!cached || cached.nodes.length === 0) return null;
            if (
                requireFingerprintMatch &&
                typeof cached.filterFingerprint === 'string' &&
                cached.filterFingerprint !== buildSubscriptionFilterFingerprint(subscription)
            ) {
                return null;
            }
            // 缓存中是节点 URL 字符串，重新解析为预览节点对象（附 name/protocol/region 元数据）
            const parsedNodes = parseNodeList(cached.nodes.join('\n'), { plusAsSpace });
            if (parsedNodes.length === 0) return null;
            return {
                subscriptionName,
                url,
                success: true,
                nodes: parsedNodes,
                error: upstreamError,
                fromCache: true,
                cacheUpdatedAt: cached.updatedAt || null,
            };
        } catch (error) {
            console.warn('[NodeFetcher] Failed to read protective node cache:', error);
            return null;
        }
    };

    try {
        const effectiveUserAgent =
            customUserAgent && customUserAgent.trim() !== '' ? customUserAgent : userAgent;

        // 当配置了 fetchProxy 时，使用代理拉取订阅
        let requestUrl = url;

        // 只有开启保护性缓存节点时才加时间戳绕过强缓存 (如 Cloudflare Edge Cache)
        if (enableNodeCache) {
            try {
                const parsedUrl = new URL(requestUrl);
                parsedUrl.searchParams.set('_t', Date.now().toString());
                requestUrl = parsedUrl.toString();
            } catch (e) {
                requestUrl += (requestUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
            }
        }

        if (fetchProxy && typeof fetchProxy === 'string' && fetchProxy.trim()) {
            requestUrl = buildFetchProxyUrl(fetchProxy, url, effectiveUserAgent);
        }

        // 使用统一的 Fetch 工具，复用重试逻辑
        const response = await fetchWithRetry(requestUrl, {
            headers: { 'User-Agent': effectiveUserAgent },
            redirect: 'follow',
            ...(skipCertVerify ? { cf: { insecureSkipVerify: true } } : {}),
        });

        if (!response.ok) {
            const upstreamError = `HTTP ${response.status}: ${response.statusText}`;
            const cachedResult = await fallbackToNodeCache(upstreamError, false);
            if (cachedResult) return cachedResult;
            return {
                subscriptionName,
                url,
                success: false,
                nodes: [],
                error: upstreamError,
            };
        }

        const buffer = await response.arrayBuffer();
        let text = new TextDecoder('utf-8').decode(buffer);

        let parsedNodes = parseNodeList(text, { plusAsSpace });

        if (parsedNodes.length === 0) {
            const fallbackBase64 = encodeArrayBufferToBase64(buffer);
            const fallbackNodes = parseNodeList(fallbackBase64, { plusAsSpace });
            if (fallbackNodes.length > 0) {
                parsedNodes = fallbackNodes;
            }
        }

        if (excludeRules && excludeRules.trim()) {
            parsedNodes = applyExcludeRulesToNodes(parsedNodes, excludeRules);
        }

        // 订阅过期/失效时上游可能返回 200 + 无有效节点（如过期提示页），
        // 此时与输出链路一致：过滤配置未变化则回退保护性缓存
        if (parsedNodes.length === 0) {
            const cachedResult = await fallbackToNodeCache(null, true);
            if (cachedResult) return cachedResult;
        }

        return {
            subscriptionName,
            url,
            success: true,
            nodes: parsedNodes,
            error: null,
        };
    } catch (e) {
        if (shouldDebug) {
            console.debug(`[DEBUG PREVIEW] Error: ${e.message}`);
        }
        const cachedResult = await fallbackToNodeCache(e.message, false);
        if (cachedResult) return cachedResult;
        return {
            subscriptionName,
            url,
            success: false,
            nodes: [],
            error: e.message,
        };
    }
}

/**
 * 应用过滤规则 (使用 node-cleaner 的重构逻辑)
 * @param {Array} nodes
 * @param {string} ruleText
 */
function applyExcludeRulesToNodes(nodes, ruleText) {
    if (!ruleText || !ruleText.trim()) return nodes;
    const { includeRules, excludeRules } = parseFilterRuleText(ruleText);

    let resultNodes = nodes;

    // 使用 node-cleaner 中导出的 filterNodeObjects
    if (includeRules.hasRules) {
        resultNodes = filterNodeObjects(resultNodes, includeRules, 'include');
    }
    if (excludeRules.hasRules) {
        resultNodes = filterNodeObjects(resultNodes, excludeRules, 'exclude');
    }

    return resultNodes;
}
