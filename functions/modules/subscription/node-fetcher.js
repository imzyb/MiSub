import { parseNodeList } from '../utils/node-parser.js';
import { fetchWithRetry } from '../../services/fetch-utils.js';
import {
    filterNodeObjects,
    buildRuleSet,
    encodeArrayBufferToBase64
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
 * @returns {Promise<Object>} 节点获取结果
 */
export async function fetchSubscriptionNodes(url, subscriptionName, userAgent, customUserAgent = null, debug = false, excludeRules = '', fetchProxy = null, skipCertVerify = false, plusAsSpace = false) {
    // 自动检测调试 Token
    const shouldDebug = debug || (url && url.includes('b0b422857bb46aba65da8234c84f38c6'));

    try {
        const effectiveUserAgent = customUserAgent && customUserAgent.trim() !== ''
            ? customUserAgent
            : userAgent;

        // 当配置了 fetchProxy 时，使用代理拉取订阅
        let requestUrl = url;
        if (fetchProxy && typeof fetchProxy === 'string' && fetchProxy.trim()) {
            requestUrl = fetchProxy.trim() + encodeURIComponent(url);
        }

        // 使用统一的 Fetch 工具，复用重试逻辑
        const response = await fetchWithRetry(requestUrl, {
            headers: { 'User-Agent': effectiveUserAgent },
            redirect: "follow",
            ...(skipCertVerify ? { cf: { insecureSkipVerify: true } } : {})
        });

        if (!response.ok) {
            return {
                subscriptionName,
                url,
                success: false,
                nodes: [],
                error: `HTTP ${response.status}: ${response.statusText}`
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

        return {
            subscriptionName,
            url,
            success: true,
            nodes: parsedNodes,
            error: null
        };
    } catch (e) {
        if (shouldDebug) {
            console.debug(`[DEBUG PREVIEW] Error: ${e.message}`);
        }
        return {
            subscriptionName,
            url,
            success: false,
            nodes: [],
            error: e.message
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
    const lines = ruleText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length === 0) return nodes;

    const dividerIndex = lines.findIndex(line => line === '---');
    // 如果没有分隔符，默认全是 exclude
    const includeLines = dividerIndex === -1 ? [] : lines.slice(dividerIndex + 1);
    const excludeLines = dividerIndex === -1 ? lines : lines.slice(0, dividerIndex);

    // 使用 node-cleaner 中导出的 buildRuleSet
    const includeRules = buildRuleSet(includeLines, true);
    const excludeRules = buildRuleSet(excludeLines);

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
