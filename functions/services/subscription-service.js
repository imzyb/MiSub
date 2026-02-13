/**
 * 订阅处理服务
 * @author MiSub Team
 */

import { parseNodeList } from '../modules/utils/node-parser.js';
import { getProcessedUserAgent } from '../utils/format-utils.js';
import { prependNodeName, removeFlagEmoji, fixNodeUrlEncoding, sanitizeNodeForYaml } from '../utils/node-utils.js';
import { applyNodeTransformPipeline } from '../utils/node-transformer.js';
import { createTimeoutFetch } from '../modules/utils.js';

/**
 * 订阅获取配置常量
 */
const FETCH_CONFIG = {
    TIMEOUT: 18000,        // 单次请求超时 18 秒
    MAX_RETRIES: 2,        // 最多重试 2 次
    BASE_DELAY: 1000,      // 重试基础延迟 1 秒
    CONCURRENCY: 4,        // 最大并发数
    RETRYABLE_STATUS: [500, 502, 503, 504, 429] // 可重试的 HTTP 状态码
};

/**
 * 带重试的订阅获取函数（支持网络错误和 HTTP 状态码重试）
 * @param {string} url - 请求 URL
 * @param {Object} init - fetch 初始化选项
 * @param {Object} options - 重试选项
 * @returns {Promise<Response>} - 响应对象
 */
async function fetchWithRetry(url, init = {}, options = {}) {
    const {
        timeout = FETCH_CONFIG.TIMEOUT,
        maxRetries = FETCH_CONFIG.MAX_RETRIES,
        baseDelay = FETCH_CONFIG.BASE_DELAY,
        retryableStatus = FETCH_CONFIG.RETRYABLE_STATUS
    } = options;

    let lastError;
    let lastResponse;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await createTimeoutFetch(url, init, timeout);

            // 检查是否需要重试（可重试的 HTTP 状态码）
            if (!response.ok && retryableStatus.includes(response.status)) {
                if (attempt < maxRetries) {
                    // 计算延迟：优先使用 Retry-After 头，否则使用指数退避
                    let delay = baseDelay * Math.pow(2, attempt);
                    const retryAfter = response.headers.get('Retry-After');
                    if (retryAfter) {
                        const retryAfterSeconds = parseInt(retryAfter, 10);
                        if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
                            delay = Math.min(retryAfterSeconds * 1000, 30000); // 最多等待 30 秒
                        }
                    }

                    console.warn(`[Retry] HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`);

                    // 释放响应体，避免连接占用
                    try {
                        await response.body?.cancel();
                    } catch (cancelError) {
                        console.debug('[Retry] Failed to cancel response body:', cancelError);
                    }

                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                // 最后一次重试仍失败，保存响应供上层处理
                lastResponse = response;
            }

            return response;
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries) {
                throw error;
            }

            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`[Retry] ${error.message} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // 如果有最后的响应（可重试状态码耗尽），返回它
    if (lastResponse) {
        return lastResponse;
    }

    throw lastError;
}

/**
 * 并发控制器 - 限制同时进行的请求数量
 * @param {number} limit - 最大并发数
 * @returns {Function} - 包装函数
 */
function createConcurrencyLimiter(limit) {
    const safeLimit = Math.max(1, limit || 1); // 防御性检查，确保至少为 1
    let running = 0;
    const queue = [];

    const runNext = () => {
        if (running >= safeLimit || queue.length === 0) return;
        running++;
        const { task, resolve, reject } = queue.shift();
        // 使用 Promise.resolve().then() 包装，确保同步异常也能被捕获
        Promise.resolve()
            .then(task)
            .then(resolve)
            .catch(reject)
            .finally(() => {
                running--;
                runNext();
            });
    };

    return (task) => new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        runNext();
    });
}

/**
 * 生成组合节点列表
 * @param {Object} context - 请求上下文
 * @param {Object} config - 配置对象
 * @param {string} userAgent - 用户代理
 * @param {Array} misubs - 订阅列表
 * @param {string} prependedContent - 预置内容
 * @param {Object} profilePrefixSettings - 配置文件前缀设置
 * @param {boolean} debug - 是否启用调试日志
 * @returns {Promise<string>} - 组合后的节点列表
 */
export async function generateCombinedNodeList(context, config, userAgent, misubs, prependedContent = '', profilePrefixSettings = null, debug = false) {
    // 判断是否启用手动节点前缀
    const shouldPrependManualNodes = profilePrefixSettings?.enableManualNodes ?? true;

    // 判断是否需要添加 Emoji：当模板重命名启用且模板包含 {emoji} 时启用
    const nodeTransformConfig = profilePrefixSettings?.nodeTransform;
    const templateEnabled = nodeTransformConfig?.enabled && nodeTransformConfig?.rename?.template?.enabled;
    // 使用默认模板 '{emoji}{region}-{protocol}-{index}'，如果用户未自定义模板
    const defaultTemplate = '{emoji}{region}-{protocol}-{index}';
    const effectiveTemplate = nodeTransformConfig?.rename?.template?.template || defaultTemplate;
    const templateContainsEmoji = templateEnabled && effectiveTemplate.includes('{emoji}');
    const shouldKeepEmoji = !templateEnabled || templateContainsEmoji;

    // 手动节点前缀文本
    const manualNodePrefix = profilePrefixSettings?.manualNodePrefix ?? '\u624b\u52a8\u8282\u70b9';

    // [重要] 当智能重命名模板启用时，跳过前缀添加，因为智能重命名会完全覆盖节点名称
    // 用户可以在模板中使用 {name} 变量来保留原始信息
    const skipPrefixDueToRenaming = nodeTransformConfig?.enabled && nodeTransformConfig?.rename?.template?.enabled;

    const processedManualNodes = misubs
        .filter(sub => {
            const url = typeof sub?.url === 'string' ? sub.url.trim() : '';
            return Boolean(url) && !url.toLowerCase().startsWith('http');
        })
        .map(node => {
            try {
                const rawUrl = typeof node?.url === 'string' ? node.url.trim() : '';
                if (!rawUrl) return '';

                if (node.isExpiredNode) {
                    return rawUrl; // Directly use the URL for expired node
                }

                // 修复手动SS节点中的URL编码问题（以及 Hysteria2 等其他协议）
                let processedUrl = fixNodeUrlEncoding(rawUrl);
                if (typeof processedUrl !== 'string' || !processedUrl) {
                    processedUrl = rawUrl;
                }

                // 如果用户设置了手动节点名称，则替换链接中的原始名称
                const customNodeName = typeof node.name === 'string' ? node.name.trim() : '';
                if (customNodeName) {
                    processedUrl = applyManualNodeName(processedUrl, customNodeName);
                }

                // 只有在智能重命名未启用时才添加前缀
                const shouldAddPrefix = shouldPrependManualNodes && !skipPrefixDueToRenaming;
                return shouldAddPrefix ? prependNodeName(processedUrl, manualNodePrefix) : processedUrl;
            } catch (error) {
                console.warn('[Subscription] 手动节点处理失败，已跳过:', error?.message || error);
                return '';
            }
        })
        .filter(Boolean)
        .join('\n');

    const httpSubs = misubs.filter(sub => sub && sub.url && sub.url.toLowerCase().startsWith('http'));
    const limiter = createConcurrencyLimiter(FETCH_CONFIG.CONCURRENCY);

    /**
     * 获取单个订阅内容
     * @param {Object} sub - 订阅对象
     * @returns {Promise<string>} - 处理后的节点列表
     */
    const fetchSingleSubscription = async (sub) => {
        try {
            if (debug) {
                console.debug(`[DEBUG] Fetching subscription: ${sub.url}`);
            }
            const processedUserAgent = getProcessedUserAgent(userAgent, sub.url);
            const requestHeaders = { 'User-Agent': processedUserAgent };

            const response = await fetchWithRetry(sub.url, {
                headers: requestHeaders,
                redirect: "follow",
                cf: {
                    insecureSkipVerify: true,
                    allowUntrusted: true,
                    validateCertificate: false
                }
            });

            if (!response.ok) {
                console.warn(`订阅请求失败: ${sub.url}, 状态: ${response.status}`);
                return '';
            }
            const buffer = await response.arrayBuffer();
            let text = new TextDecoder('utf-8').decode(buffer);

            text = await decodeBase64Content(text);

            // 使用统一的 node-parser 解析，确保与预览一致的过滤规则 (UUID校验, Hysteria1过滤, SS加密校验等)
            const parsedObjects = parseNodeList(text);

            let fallbackParsedObjects = parsedObjects;
            if (parsedObjects.length === 0) {
                const fallbackText = await decodeBase64Content(encodeArrayBufferToBase64(buffer));
                const fallbackNodes = parseNodeList(fallbackText);
                if (fallbackNodes.length > 0) {
                    fallbackParsedObjects = fallbackNodes;
                }
            }

            let validNodes = fallbackParsedObjects.map(node => node.url);

            // 应用过滤规则
            validNodes = applyFilterRules(validNodes, sub);


            // 判断是否启用订阅前缀（智能重命名启用时跳过）
            const shouldPrependSubscriptions = profilePrefixSettings?.enableSubscriptions ?? true;
            const shouldAddSubPrefix = shouldPrependSubscriptions && !skipPrefixDueToRenaming;

            return (shouldAddSubPrefix && sub.name)
                ? validNodes.map(node => prependNodeName(node, sub.name)).join('\n')
                : validNodes.join('\n');
        } catch (e) {
            // 订阅处理错误，生成错误节点
            console.warn(`订阅获取失败 [${sub.name || sub.url}]:`, e.message);
            const errorNodeName = `连接错误-${sub.name || '未知'}`;
            return `trojan://error@127.0.0.1:8888?security=tls&allowInsecure=1&type=tcp#${encodeURIComponent(errorNodeName)}`;
        }
    };

    // 使用并发控制器限制同时请求数量，避免网络拥塞
    const subPromises = httpSubs.map(sub => limiter(() => fetchSingleSubscription(sub)));
    const processedSubContents = await Promise.all(subPromises);
    const combinedLines = (processedManualNodes + '\n' + processedSubContents.join('\n'))
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const normalizedLines = shouldKeepEmoji
        ? combinedLines
        : combinedLines.map(line => removeFlagEmoji(line));

    // [Sanitize] Always sanitize node names for YAML compatibility (Subconverter issue with unquoted special chars)
    const sanitizedLines = normalizedLines.map(line => sanitizeNodeForYaml(line));

    const outputLines = nodeTransformConfig?.enabled
        ? applyNodeTransformPipeline(sanitizedLines, { ...nodeTransformConfig, enableEmoji: templateContainsEmoji })
        : [...new Set(sanitizedLines)];
    const uniqueNodesString = outputLines.join('\n');

    // 确保最终的字符串在非空时以换行符结束，以兼容 subconverter
    let finalNodeList = uniqueNodesString;
    if (finalNodeList.length > 0 && !finalNodeList.endsWith('\n')) {
        finalNodeList += '\n';
    }

    // 将虚假节点（如果存在）插入到列表最前面
    let result = finalNodeList;
    if (prependedContent) {
        result = `${prependedContent}\n${finalNodeList}`;
    }

    // --- 日志记录 ---
    try {
        const endTime = Date.now();
        const totalNodes = outputLines.length;
        const successCount = processedSubContents.filter(c => c.length > 0).length;
        const failCount = httpSubs.length - successCount;

        // [Stats Export] Populate generation stats to context for use by handler (deferred logging)
        if (context) {
            context.generationStats = {
                totalNodes,
                sourceCount: httpSubs.length,
                successCount,
                failCount,
                duration: endTime - (context.startTime || Date.now())
            };
        }

        const isInternalRequest = userAgent.includes('MiSub-Backend') || userAgent.includes('TelegramBot');
        if (!debug && config.enableAccessLog && !isInternalRequest) { // 避免递归调试日志，并遵循全局日志设置
            const { LogService } = await import('./log-service.js');

            // 提取客户信息
            let clientIp = 'Unknown';
            let geoInfo = {};
            if (context && context.logMetadata) {
                // Use metadata passed from handler if available
                clientIp = context.logMetadata.clientIp || clientIp;
                geoInfo = context.logMetadata.geoInfo || geoInfo;
            } else if (context && context.request) {
                const cf = context.request.cf;
                clientIp = context.request.headers.get('CF-Connecting-IP')
                    || context.request.headers.get('X-Real-IP')
                    || context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
                    || 'Unknown';
                if (cf) {
                    geoInfo = {
                        country: cf.country,
                        city: cf.city,
                        isp: cf.asOrganization,
                        asn: cf.asn
                    };
                }
            }

            await LogService.addLog(context.env, {
                profileName: profilePrefixSettings?.name || 'Unknown Profile',
                clientIp,
                geoInfo,
                userAgent: userAgent || 'Unknown',
                status: failCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'error'),
                // Include metadata from handler (format, token, type, etc.)
                ...((context && context.logMetadata) ? {
                    format: context.logMetadata.format,
                    token: context.logMetadata.token,
                    type: context.logMetadata.type,
                    domain: context.logMetadata.domain
                } : {}),
                details: {
                    totalNodes,
                    sourceCount: httpSubs.length,
                    successCount,
                    failCount,
                    duration: endTime - (context.startTime || Date.now()) // 需要在上层记录 startTime
                },
                summary: `生成 ${totalNodes} 个节点 (成功: ${successCount}, 失败: ${failCount})`
            });
        }
    } catch (e) {
        console.error('Failed to save access log:', e);
    }

    return result;
}

/**
 * 解码Base64内容
 * @param {string} text - 可能包含Base64的文本
 * @returns {Promise<string>} - 解码后的文本
 */
async function decodeBase64Content(text) {
    try {
        const cleanedText = text.replace(/\s/g, '');
        const { isValidBase64 } = await import('../utils/format-utils.js');
        if (isValidBase64(cleanedText)) {
            let normalized = cleanedText.replace(/-/g, '+').replace(/_/g, '/');
            const padding = normalized.length % 4;
            if (padding) {
                normalized += '='.repeat(4 - padding);
            }
            const binaryString = atob(normalized);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
            return new TextDecoder('utf-8').decode(bytes);
        }
    } catch (e) {
        console.debug('[Subscription] Base64 decode failed, using raw text:', e);
    }
    return text;
}

/**
 * 将手动节点的自定义名称应用到节点链接中
 * @param {string} nodeUrl - 节点URL
 * @param {string} customName - 用户自定义名称
 * @returns {string} - 应用名称后的URL
 */
function applyManualNodeName(nodeUrl, customName) {
    if (!customName) return nodeUrl;

    // vmess 协议：修改 base64 解码后 JSON 中的 ps 字段
    if (nodeUrl.startsWith('vmess://')) {
        try {
            const hashIndex = nodeUrl.indexOf('#');
            let base64Part = hashIndex !== -1
                ? nodeUrl.substring('vmess://'.length, hashIndex)
                : nodeUrl.substring('vmess://'.length);

            // 处理 URL 编码和 URL-safe base64
            if (base64Part.includes('%')) {
                base64Part = decodeURIComponent(base64Part);
            }
            base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
            // 补齐 padding
            while (base64Part.length % 4 !== 0) {
                base64Part += '=';
            }

            const binaryString = atob(base64Part);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const jsonString = new TextDecoder('utf-8').decode(bytes);
            const nodeConfig = JSON.parse(jsonString);

            // 类型校验：确保是对象
            if (nodeConfig && typeof nodeConfig === 'object') {
                nodeConfig.ps = customName;

                const newJsonString = JSON.stringify(nodeConfig);
                const newBase64Part = btoa(unescape(encodeURIComponent(newJsonString)));
                return 'vmess://' + newBase64Part;
            }
        } catch (e) {
            console.debug('[Subscription] VMess decode failed, falling back to fragment update:', e);
        }
    }

    // 其他协议：修改 URL 的 #fragment 部分
    try {
        const hashIndex = nodeUrl.lastIndexOf('#');
        const baseLink = hashIndex !== -1 ? nodeUrl.substring(0, hashIndex) : nodeUrl;
        return `${baseLink}#${encodeURIComponent(customName)}`;
    } catch (e) {
        return nodeUrl;
    }
}



/**
 * 应用过滤规则
 * @param {Array} validNodes - 有效节点列表
 * @param {Object} sub - 订阅对象
 * @returns {Array} - 过滤后的节点列表
 */
function applyFilterRules(validNodes, sub) {
    const ruleText = sub.exclude;
    if (!ruleText || ruleText.trim() === '') return validNodes;

    const lines = ruleText
        .split('\n')
        .map(r => r.trim())
        .filter(Boolean);

    if (lines.length === 0) return validNodes;

    // 规则分割：--- 为分隔，keep: 为白名单
    const dividerIndex = lines.findIndex(line => line === '---');
    const hasDivider = dividerIndex !== -1;

    const excludeLines = hasDivider
        ? lines.slice(0, dividerIndex)
        : lines.filter(line => !line.toLowerCase().startsWith('keep:'));

    const keepLines = hasDivider
        ? lines.slice(dividerIndex + 1)
        : lines.filter(line => line.toLowerCase().startsWith('keep:'));

    const excludeRules = buildRuleSet(excludeLines, false);
    const keepRules = buildRuleSet(keepLines, true);

    const whitelistOnly = !hasDivider && keepRules.hasRules;
    const shouldApplyWhitelist = (hasDivider && keepRules.hasRules) || whitelistOnly;

    const afterExclude = whitelistOnly
        ? [...validNodes]
        : filterNodes(validNodes, excludeRules, 'exclude');

    return shouldApplyWhitelist
        ? filterNodes(afterExclude, keepRules, 'include')
        : afterExclude;
}

function buildRuleSet(lines, stripKeepPrefix = false) {
    const protocols = new Set();
    const patterns = [];

    for (const rawLine of lines) {
        let line = rawLine.trim();
        if (!line || line === '---') continue;

        if (stripKeepPrefix && line.toLowerCase().startsWith('keep:')) {
            line = line.substring('keep:'.length).trim();
        }
        if (!line) continue;

        if (line.toLowerCase().startsWith('proto:')) {
            const parts = line.substring('proto:'.length)
                .split(',')
                .map(p => p.trim().toLowerCase())
                .filter(Boolean);
            parts.forEach(p => protocols.add(p));
            continue;
        }

        patterns.push(line);
    }

    const nameRegex = buildSafeRegex(patterns);
    return {
        protocols,
        nameRegex,
        hasRules: protocols.size > 0 || Boolean(nameRegex)
    };
}

function buildSafeRegex(patterns) {
    if (!patterns.length) return null;
    try {
        return new RegExp(patterns.join('|'), 'i');
    } catch (e) {
        console.warn('Invalid include/exclude regex, skipped:', e.message);
        return null;
    }
}

function filterNodes(nodes, rules, mode = 'exclude') {
    if (!rules || !rules.hasRules) return nodes;
    const isInclude = mode === 'include';

    return nodes.filter(nodeLink => {
        const protocol = extractProtocol(nodeLink);
        const nodeName = extractNodeName(nodeLink, protocol);

        const protocolHit = protocol && rules.protocols.has(protocol);
        const nameHit = rules.nameRegex ? rules.nameRegex.test(nodeName) : false;

        if (isInclude) {
            return protocolHit || nameHit;
        }
        return !(protocolHit || nameHit);
    });
}

function extractProtocol(nodeLink) {
    const match = nodeLink.match(/^([a-z0-9.+-]+):\/\//i);
    return match ? match[1].toLowerCase() : '';
}

function extractNodeName(nodeLink, protocol) {
    const hashIndex = nodeLink.lastIndexOf('#');
    if (hashIndex !== -1) {
        try {
            return decodeURIComponent(nodeLink.substring(hashIndex + 1));
        } catch (e) {
            return nodeLink.substring(hashIndex + 1);
        }
    }

    if (protocol === 'vmess') {
        return decodeVmessName(nodeLink);
    }
    return '';
}

function decodeVmessName(nodeLink) {
    try {
        let base64Part = nodeLink.substring('vmess://'.length);
        if (base64Part.includes('%')) {
            base64Part = decodeURIComponent(base64Part);
        }
        base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
        while (base64Part.length % 4 !== 0) {
            base64Part += '=';
        }
        const binaryString = atob(base64Part);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const jsonString = new TextDecoder('utf-8').decode(bytes);
        const nodeConfig = JSON.parse(jsonString);
        return typeof nodeConfig.ps === 'string' ? nodeConfig.ps : '';
    } catch (e) {
        return '';
    }
}

/**
 * ArrayBuffer -> Base64 ??
 */
function encodeArrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}
