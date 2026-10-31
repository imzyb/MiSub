/**
 * 订阅处理服务
 * @author MiSub Team
 */

import { parseNodeList } from '../modules/utils/node-parser.js';
import { parseNodeInfo } from '../modules/utils/geo-utils.js';
import { getProcessedUserAgent } from '../utils/format-utils.js';
import { buildFetchProxyUrl } from '../utils/fetch-proxy-utils.js';
import {
    prependNodeName,
    addFlagEmoji,
    removeFlagEmoji,
    fixNodeUrlEncoding,
    sanitizeNodeForYaml,
    isLocalProxyEndpoint,
} from '../utils/node-utils.js';
import { runOperatorChain } from '../utils/operator-runner.js';
import { createTimeoutFetch } from '../modules/utils.js';
import { assertPublicNetworkUrl } from '../modules/security-utils.js';
import { isSuspiciousNodeCountDrop } from './node-cache-service.js';

/**
 * 订阅获取配置常量
 */
const FETCH_CONFIG = {
    TIMEOUT: 18000, // 单次请求超时 18 秒
    MAX_RETRIES: 2, // 最多重试 2 次
    BASE_DELAY: 1000, // 重试基础延迟 1 秒
    CONCURRENCY: 4, // 最大并发数
    RETRYABLE_STATUS: [500, 502, 503, 504, 429], // 可重试的 HTTP 状态码
};

const REAL_PROXY_PROTOCOLS = [
    'ss://',
    'ssr://',
    'vmess://',
    'vless://',
    'trojan://',
    'hysteria://',
    'hysteria2://',
    'hy2://',
    'tuic://',
    'anytls://',
    'socks5://',
    'socks://',
    'http://',
    'https://',
    'naive+https://',
    'naive+quic://',
    'wireguard://',
    'mierus://',
];

/**
 * 判断是否是真实代理节点，排除流量/到期/公告等系统伪节点
 */
export function isRealProxyNode(node) {
    if (typeof node !== 'string') return false;
    const trimmed = node.trim().toLowerCase();
    if (!trimmed) return false;
    if (isLocalProxyEndpoint(trimmed)) return false;
    return REAL_PROXY_PROTOCOLS.some((protocol) => trimmed.startsWith(protocol));
}

/**
 * 从订阅响应头中解析机场自报的名称（profile-title / content-disposition）。
 *
 * 这是目前最可靠的机场标识来源——由机场服务端自己声明，不依赖域名猜测。
 * 常见形式：
 *   Profile-Title: base64:<b64(名称)>     （Clash/mihomo 生态的约定）
 *   Profile-Title: 名称                   （部分实现直接放明文）
 *   Content-Disposition: attachment; filename*=UTF-8''名称
 *
 * @param {Headers|Object} headers 响应头（fetch Headers 或普通对象）
 * @returns {string} 解析出的名称，取不到时返回空字符串
 */
export function parseSubscriptionProfileTitle(headers) {
    const read = (name) => {
        if (!headers) return '';
        try {
            if (typeof headers.get === 'function') return headers.get(name) || '';
        } catch {
            /* ignore */
        }
        const lower = name.toLowerCase();
        for (const key of Object.keys(headers || {})) {
            if (key.toLowerCase() === lower) return String(headers[key] || '');
        }
        return '';
    };

    const decodeBase64 = (value) => {
        try {
            const binary = atob(value);
            const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
            return new TextDecoder('utf-8').decode(bytes);
        } catch {
            return '';
        }
    };

    // 1. profile-title（首选）
    let raw = String(read('profile-title') || '').trim();
    if (raw) {
        if (/^base64:/i.test(raw)) {
            const decoded = decodeBase64(raw.slice(7).trim());
            if (decoded) return decoded.trim();
        } else {
            return raw;
        }
    }

    // 2. content-disposition 的 filename*
    const disposition = String(read('content-disposition') || '');
    if (disposition) {
        const utf8 = disposition.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i);
        if (utf8) {
            try {
                return decodeURIComponent(utf8[1].trim()).trim();
            } catch {
                /* ignore */
            }
        }
        const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/i);
        if (plain) {
            const name = plain[1].trim();
            // 过滤掉通用占位名与纯扩展名
            if (name && !/^(subscription|config|clash|sub)\.(yaml|yml|txt|conf)$/i.test(name)) {
                return name.replace(/\.(yaml|yml|txt|conf)$/i, '').trim();
            }
        }
    }

    return '';
}

/**
 * 从订阅 URL 推断机场主域名（用于后续抓取官网标题识别品牌）。
 *
 * 机场订阅常挂在子域名上，去掉常见的前缀/子域后可得到主域名：
 *   sub1.gsafevpn.com      -> gsafevpn.com
 *   dy11.baipiaoyes.com    -> baipiaoyes.com
 *   api.5ufclub.com        -> 5ufclub.com
 *   jms.937745389.xyz      -> 937745389.xyz
 *
 * 注意：对于 CDN / 托管平台域名（pages.dev、workers.dev、githubusercontent.com 等）
 * 返回空字符串——它们不属于机场自有域名，抓标题只会得到平台错误页。
 *
 * @param {string} url 订阅源地址
 * @returns {string} 主域名，无法推断时返回空字符串
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
        // 常见机场子域前缀（去掉后取主域名）
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

        let base;
        if (parts.length >= 3) {
            const first = parts[0];
            const isCommonPrefix = COMMON_SUBDOMAIN_LABELS.has(first);
            const isNumberedPrefix = /^[a-z]{0,4}\d+$/i.test(first); // 如 dy11 / sub12 / node3
            base = parts.slice(-rootLabelCount);
        } else {
            base = parts;
        }

        const root = base.join('.');
        // 至少要有 host.tld 两段
        return root.split('.').length >= 2 ? root : '';
    } catch {
        return '';
    }
}

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

/**
 * 抓取机场官网标题，作为品牌名的兜底识别来源。
 *
 * 仅当响应头没有自报名称时才调用，避免不必要的请求开销。
 * 站点标题常见形态：`GsafeVPN` / `Wayne's Portal` / `Notice`
 * 需要过滤掉 Cloudflare 拦截页、默认停机页等噪声。
 *
 * @param {string} rootDomain 机场主域名
 * @param {Object} [options]
 * @param {number} [options.timeout=5000] 超时（毫秒）
 * @returns {Promise<string>} 品牌名，取不到时返回空字符串
 */
const NOISY_SITE_TITLES = [
    /^attention required/i,
    /^just a moment/i,
    /cloudflare$/i,
    /^notice$/i,
    /^welcome$/i,
    /^index$/i,
    /^home$/i,
    /^site not found/i,
    /^404/i,
    /^error/i,
    /^nginx$/i,
    /^apache/i,
    /^default/i,
    /^域名/i,
    /^未找到/i,
];

export async function fetchAirportSiteTitle(rootDomain, options = {}) {
    const { timeout = 5000 } = options;
    const domain = String(rootDomain || '').trim();
    if (!domain || !domain.includes('.')) return '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(`https://${domain}/`, {
            method: 'GET',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
            signal: controller.signal,
        });
        if (!response.ok) return '';

        // 只读前 64KB，标题一定在 <head> 里
        const text = (await response.text()).slice(0, 65536);
        const match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (!match) return '';

        const title = match[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();

        if (!title || title.length > 60) return '';
        if (NOISY_SITE_TITLES.some((re) => re.test(title))) return '';
        return title;
    } catch {
        return '';
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 解析 subscription-userinfo 响应头（流量信息）
 * @param {string} header
 * @returns {Object|null}
 */
export function parseSubscriptionUserInfoHeader(header) {
    if (typeof header !== 'string' || !header.trim()) return null;

    const info = {};
    header.split(';').forEach((part) => {
        const [rawKey, rawValue] = part.trim().split('=');
        const key = rawKey?.trim();
        const value = rawValue?.trim();
        if (!key || value === undefined || value === '') return;
        info[key] = /^\d+$/.test(value) ? Number(value) : value;
    });

    return Object.keys(info).length > 0 ? info : null;
}

/**
 * 构建单机场订阅源的保护性缓存 key
 */
export function buildSubscriptionNodeCacheKey(sub = {}) {
    const id = typeof sub.id === 'string' ? sub.id.trim() : '';
    if (id) return `node_cache_subscription_${encodeURIComponent(id)}`;

    const url = typeof sub.url === 'string' ? sub.url.trim() : '';
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    }
    return `node_cache_subscription_url_${Math.abs(hash).toString(36)}`;
}

/**
 * 构建订阅"过滤配置"指纹（exclude 文本 + 算子链 + 旧版 nodeTransform）。
 * 用于区分"节点数缩减是用户改了过滤配置"与"上游响应被截断"：
 * 前者是预期行为，不应触发骤降保护或回退旧缓存。
 */
export function buildSubscriptionFilterFingerprint(sub = {}) {
    const exclude = typeof sub.exclude === 'string' ? sub.exclude.trim() : '';
    const operators = Array.isArray(sub.operators) ? JSON.stringify(sub.operators) : '';
    const nodeTransform = sub.nodeTransform ? JSON.stringify(sub.nodeTransform) : '';
    return JSON.stringify([exclude, operators, nodeTransform]);
}

/**
 * 读取单机场订阅的保护性缓存（预览链路与输出链路共用）。
 * @param {Object} storage 存储适配器
 * @param {Object} sub 订阅对象（用于构建缓存 key）
 * @returns {Promise<{nodes: string[], nodeCount: number, updatedAt: string, filterFingerprint?: string}|null>}
 */
export async function readSubscriptionNodeCache(storage, sub) {
    if (!storage?.get) return null;
    try {
        const cached = await storage.get(buildSubscriptionNodeCacheKey(sub));
        if (!cached || !Array.isArray(cached.nodes)) return null;
        const nodes = cached.nodes.filter(isRealProxyNode);
        return nodes.length > 0 ? { ...cached, nodes } : null;
    } catch (error) {
        console.warn('[SubscriptionCache] Failed to read cache:', error);
        return null;
    }
}

async function writeSubscriptionNodeCache(storage, sub, nodes) {
    if (!storage?.put) return false;
    const realNodes = Array.isArray(nodes) ? nodes.filter(isRealProxyNode) : [];
    if (realNodes.length === 0) return false;

    try {
        await storage.put(buildSubscriptionNodeCacheKey(sub), {
            nodes: realNodes,
            nodeCount: realNodes.length,
            updatedAt: new Date().toISOString(),
            filterFingerprint: buildSubscriptionFilterFingerprint(sub),
            sourceId: sub?.id || null,
            sourceName: sub?.name || '',
            sourceUrl: sub?.url || '',
        });
        return true;
    } catch (error) {
        console.warn('[SubscriptionCache] Failed to write cache:', error);
        return false;
    }
}

async function writeSubscriptionRuntimeInfo(storage, sub, runtimeInfo = {}) {
    if (!storage || !sub?.id) return false;
    const { nodeCount, userInfo, lastGoodNodeCount, detectedName } = runtimeInfo;
    const hasUserInfo = Object.prototype.hasOwnProperty.call(runtimeInfo, 'userInfo');
    const hasLastGoodNodeCount = Object.prototype.hasOwnProperty.call(
        runtimeInfo,
        'lastGoodNodeCount'
    );
    const hasDetectedName = typeof detectedName === 'string' && detectedName.trim().length > 0;

    try {
        const applyUpdate = (current) => {
            if (!current) return current;
            return {
                ...current,
                nodeCount: Number.isFinite(nodeCount) ? nodeCount : current.nodeCount,
                ...(hasLastGoodNodeCount &&
                Number.isFinite(lastGoodNodeCount) &&
                lastGoodNodeCount > 0
                    ? { lastGoodNodeCount }
                    : {}),
                ...(hasUserInfo ? { userInfo } : {}),
                // 识别到的机场名：仅记录，不覆盖用户手动设置的 name
                ...(hasDetectedName ? { detectedName: detectedName.trim() } : {}),
                lastError: null,
                lastUpdate: new Date().toISOString(),
            };
        };

        if (typeof storage.updateSubscriptionById === 'function') {
            return Boolean(await storage.updateSubscriptionById(sub.id, applyUpdate));
        }

        if (typeof storage.get === 'function' && typeof storage.put === 'function') {
            const all = await storage.get('misub_subscriptions_v1');
            if (!Array.isArray(all)) return false;
            const index = all.findIndex((item) => item?.id === sub.id);
            if (index === -1) return false;
            all[index] = applyUpdate(all[index]);
            await storage.put('misub_subscriptions_v1', all);
            return true;
        }
    } catch (error) {
        console.warn('[SubscriptionRuntimeInfo] Failed to write subscription info:', error);
    }

    return false;
}

function scheduleSubscriptionRuntimeInfoUpdate(context, storage, sub, runtimeInfo) {
    const promise = writeSubscriptionRuntimeInfo(storage, sub, runtimeInfo);

    if (context && typeof context.waitUntil === 'function') {
        context.waitUntil(
            promise.catch((error) => {
                console.warn('[SubscriptionRuntimeInfo] Async update failed:', error);
            })
        );
        return;
    }

    promise.catch((error) => {
        console.warn('[SubscriptionRuntimeInfo] Async update failed:', error);
    });
}

function recordCurrentRequestRuntimeInfo(context, sub, runtimeInfo) {
    const key = sub?.id || sub?.url;
    if (!context || !key) return;

    context.currentSubscriptionRuntimeInfo = context.currentSubscriptionRuntimeInfo || {};
    context.currentSubscriptionRuntimeInfo[key] = runtimeInfo;
}

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
        retryableStatus = FETCH_CONFIG.RETRYABLE_STATUS,
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

                    console.warn(
                        `[Retry] HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`
                    );

                    // 释放响应体，避免连接占用
                    try {
                        await response.body?.cancel();
                    } catch (cancelError) {
                        console.debug('[Retry] Failed to cancel response body:', cancelError);
                    }

                    await new Promise((resolve) => setTimeout(resolve, delay));
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
            console.warn(
                `[Retry] ${error.message} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    // 如果有最后的响应（可重试状态码耗尽），返回它
    if (lastResponse) {
        return lastResponse;
    }

    throw lastError;
}

/**
 * 确保配置是数组格式（处理 D1 数据库可能返回的 JSON 字符串）
 */
function ensureArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
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

    return (task) =>
        new Promise((resolve, reject) => {
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
export async function generateCombinedNodeList(
    context,
    config,
    userAgent,
    misubs,
    prependedContent = '',
    profilePrefixSettings = null,
    debug = false,
    skipCertVerify = false
) {
    // 判断是否启用手动节点前缀
    const shouldPrependManualNodes = profilePrefixSettings?.enableManualNodes ?? true;

    // 判断是否在节点名称前添加分组名称
    const prependGroupName = profilePrefixSettings?.prependGroupName ?? false;

    // [修复] 多级 Emoji 开关控制逻辑
    const nodeTransformConfig = profilePrefixSettings?.nodeTransform;
    const templateEnabled =
        nodeTransformConfig?.enabled && nodeTransformConfig?.rename?.template?.enabled;
    const defaultTemplate = '{emoji}{region}-{protocol}-{index}';
    const effectiveTemplate = nodeTransformConfig?.rename?.template?.template || defaultTemplate;
    const templateContainsEmoji = templateEnabled && effectiveTemplate.includes('{emoji}');

    // 确定最终是否保留/添加 Emoji
    // 优先级：nodeTransform.addFlagEmoji (来自 URL 或组件设置) > config.enableFlagEmoji (全局设置)
    const emojiEnabledByConfig = config.enableFlagEmoji !== false;
    const emojiExplicitlyDisabled = nodeTransformConfig?.addFlagEmoji === false;
    const emojiExplicitlyEnabled = nodeTransformConfig?.addFlagEmoji === true;

    let shouldKeepEmoji = emojiEnabledByConfig;
    if (emojiExplicitlyDisabled) shouldKeepEmoji = false;
    if (emojiExplicitlyEnabled) shouldKeepEmoji = true;

    // 强制约束：如果启用了模板命名且模板不含 {emoji}，则必须移除
    if (templateEnabled && !templateContainsEmoji) {
        shouldKeepEmoji = false;
    }

    // 手动节点前缀文本
    const manualNodePrefix = profilePrefixSettings?.manualNodePrefix ?? '\u624b\u52a8\u8282\u70b9';

    // [重要] 当智能重命名模板启用时，跳过前缀添加，因为智能重命名会完全覆盖节点名称
    // 用户可以在模板中使用 {name} 变量来保留原始信息
    const skipPrefixDueToRenaming =
        nodeTransformConfig?.enabled && nodeTransformConfig?.rename?.template?.enabled;

    // --- 阶段 1: 数据准备与手动节点处理 ---

    // [增强修复] 定义统一的订阅源级转换中枢
    const applySubscriptionTransforms = async (nodes, subSource) => {
        if (!nodes || nodes.length === 0) return [];

        let currentNodes = [...nodes];

        // 1. [配置水合] 执行 Workflow 算子 (操作符)
        let subOperators = ensureArray(subSource?.operators);
        if (
            !subOperators.length &&
            subSource?.nodeTransform?.enabled &&
            subSource.nodeTransform.operators
        ) {
            subOperators = ensureArray(subSource.nodeTransform.operators);
        }

        if (subOperators.length > 0) {
            currentNodes = await runOperatorChain(currentNodes, subOperators, {
                subName: subSource?.name,
                userAgent,
                config,
            });
        }

        // 2. 应用传统的文本过滤规则 (exclude/include)
        currentNodes = applyFilterRules(currentNodes, subSource);

        return currentNodes;
    };

    // 重构后的手动节点处理逻辑
    const manualSubSourceGroups = misubs.filter((sub) => {
        if (sub?.isFromSubProfile) return true;
        const url = typeof sub?.url === 'string' ? sub.url.trim() : '';
        return Boolean(url) && !/^https?:\/\//i.test(url);
    });

    let manualProcessedLines = [];
    for (const sub of manualSubSourceGroups) {
        try {
            const rawUrl = typeof sub?.url === 'string' ? sub.url.trim() : '';
            if (!rawUrl) continue;

            let processedUrl = fixNodeUrlEncoding(rawUrl, {
                plusAsSpace: Boolean(sub?.plusAsSpace),
            });
            const customNodeName = typeof sub.name === 'string' ? sub.name.trim() : '';
            if (customNodeName && !sub?.isFromSubProfile)
                processedUrl = applyManualNodeName(processedUrl, customNodeName);

            const nodeGroup = typeof sub.group === 'string' ? sub.group.trim() : '';
            if (prependGroupName && nodeGroup && !skipPrefixDueToRenaming)
                processedUrl = prependNodeName(processedUrl, nodeGroup);

            const shouldAddPrefix =
                shouldPrependManualNodes && !skipPrefixDueToRenaming && !sub?.isFromSubProfile;
            const finalRawUrl = shouldAddPrefix
                ? prependNodeName(processedUrl, manualNodePrefix)
                : processedUrl;

            // [核心对齐] 对手动节点应用订阅源级转换（算子+过滤 + 组级诊断）
            const transformed = await applySubscriptionTransforms([finalRawUrl], sub);
            if (transformed.length > 0) {
                manualProcessedLines.push(...transformed);
            }
        } catch (e) {
            // Ignore
        }
    }

    const processedManualNodeList = manualProcessedLines.join('\n');

    const httpSubs = misubs.filter(
        (sub) =>
            !sub?.isFromSubProfile &&
            sub &&
            sub.url &&
            /^https?:\/\//i.test(sub.url) &&
            !/^https?:\/\/[^/?#]+:\d+\/?#/i.test(sub.url)
    );
    const limiter = createConcurrencyLimiter(FETCH_CONFIG.CONCURRENCY);
    let upstreamSuccessCount = 0; // 追踪真正从远程拉取成功的订阅数（不含 per-sub 缓存回退）

    /**
     * 获取单个订阅内容
     * @param {Object} sub - 订阅对象
     * @returns {Promise<string>} - 处理后的节点列表
     */
    const fetchSingleSubscription = async (sub) => {
        const cacheEnabled = sub?.enableNodeCache === true;
        const storage = context?.storage;
        const recordEmptyRuntimeInfo = () => {
            if (cacheEnabled) return;
            const runtimeInfo = {
                nodeCount: 0,
                userInfo: null,
            };
            recordCurrentRequestRuntimeInfo(context, sub, runtimeInfo);
            scheduleSubscriptionRuntimeInfoUpdate(context, storage, sub, runtimeInfo);
        };
        const readCachedNodes = async () => {
            if (!cacheEnabled) return [];
            const cached = await readSubscriptionNodeCache(storage, sub);
            return cached?.nodes || [];
        };
        const readCacheEntry = async () => {
            if (!cacheEnabled) return null;
            return readSubscriptionNodeCache(storage, sub);
        };
        // 旧缓存没有指纹时视为"配置未变化"，保持原有的截断保护行为
        const hasFilterConfigChanged = (cached) =>
            Boolean(cached) &&
            typeof cached.filterFingerprint === 'string' &&
            cached.filterFingerprint !== buildSubscriptionFilterFingerprint(sub);

        try {
            const customUserAgent =
                typeof sub.customUserAgent === 'string' ? sub.customUserAgent.trim() : '';
            const processedUserAgent = customUserAgent || getProcessedUserAgent(userAgent, sub.url);
            const requestHeaders = { 'User-Agent': processedUserAgent };

            // [Fetch Proxy] 获取单点订阅专属拉取代理前缀
            assertPublicNetworkUrl(sub.url);
            let requestUrl = sub.url;

            // 只有开启保护性缓存节点时才加时间戳绕过强缓存 (如 Cloudflare Edge Cache)
            if (cacheEnabled) {
                try {
                    const parsedUrl = new URL(requestUrl);
                    parsedUrl.searchParams.set('_t', Date.now().toString());
                    requestUrl = parsedUrl.toString();
                } catch (e) {
                    requestUrl += (requestUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
                }
            }

            if (sub.fetchProxy && typeof sub.fetchProxy === 'string' && sub.fetchProxy.trim()) {
                requestUrl = buildFetchProxyUrl(sub.fetchProxy, sub.url, processedUserAgent);
            }
            requestUrl = assertPublicNetworkUrl(requestUrl).toString();

            const response = await fetchWithRetry(requestUrl, {
                headers: requestHeaders,
                redirect: 'follow',
                ...(skipCertVerify
                    ? {
                          cf: {
                              insecureSkipVerify: true,
                              allowUntrusted: true,
                              validateCertificate: false,
                          },
                      }
                    : {}),
            });

            if (!response.ok) {
                recordEmptyRuntimeInfo();
                return (await readCachedNodes()).join('\n');
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

            let validNodes = fallbackParsedObjects.map((node) => node.url);

            // [截断检测基线] 骤降保护必须基于"过滤前"的上游真实节点数：
            // 用户配置的 include/exclude 过滤与算子链造成的缩减是预期行为，
            // 若基于过滤后的数量比较，开启仅包含过滤会导致输出被整体清空。
            const upstreamRealNodeCount = validNodes.filter(isRealProxyNode).length;

            // --- 统一转换治理 (算子 + 过滤 + 组级诊断) ---
            validNodes = await applySubscriptionTransforms(validNodes, sub);

            const realNodes = validNodes.filter(isRealProxyNode);
            const knownNodeCount = Math.max(
                Number(sub?.lastGoodNodeCount) || 0,
                Number(sub?.nodeCount) || 0
            );
            if (
                Number.isFinite(knownNodeCount) &&
                isSuspiciousNodeCountDrop(knownNodeCount, upstreamRealNodeCount)
            ) {
                const cachedNodes = await readCachedNodes();
                console.warn(
                    `[Subscription] Rejecting suspicious node-count drop for ${sub.id || sub.url} (${knownNodeCount} known -> ${upstreamRealNodeCount} fetched)`
                );
                if (cachedNodes.length > 0) return cachedNodes.join('\n');
                // Do not write nodeCount=0 here: this response is suspicious,
                // not evidence that the subscription has no usable nodes.
                return '';
            }
            if (cacheEnabled && realNodes.length === 0) {
                // 过滤条件变化后命中 0 节点是配置的预期结果，不能回退旧配置的缓存节点
                const cached = await readCacheEntry();
                if (!hasFilterConfigChanged(cached)) return (cached?.nodes || []).join('\n');
            } else if (cacheEnabled) {
                const cached = await readCacheEntry();
                if (
                    !hasFilterConfigChanged(cached) &&
                    isSuspiciousNodeCountDrop(cached?.nodes?.length || 0, realNodes.length)
                ) {
                    console.warn(
                        `[SubscriptionCache] Refusing suspicious node-count drop for ${sub.id || sub.url} (${cached.nodes.length} -> ${realNodes.length})`
                    );
                    return cached.nodes.join('\n');
                }
            }
            if (!cacheEnabled && realNodes.length === 0) {
                recordEmptyRuntimeInfo();
            }

            if (cacheEnabled) {
                await writeSubscriptionNodeCache(storage, sub, realNodes);
            }

            if (realNodes.length > 0) {
                upstreamSuccessCount++;
                const userInfo = parseSubscriptionUserInfoHeader(
                    response.headers.get('subscription-userinfo')
                );
                // 机场识别：仅使用响应头自报名称（零额外请求）。
                // 官网标题兜底改为「按需触发」——见 /api/detect_airport_name，
                // 避免每次刷新订阅都多发一次外部请求（拖慢整体、增加失败面）。
                const detectedName = parseSubscriptionProfileTitle(response.headers);
                const runtimeInfo = {
                    nodeCount: realNodes.length,
                    userInfo,
                    ...(detectedName ? { detectedName } : {}),
                    ...(realNodes.length >= 10 ? { lastGoodNodeCount: realNodes.length } : {}),
                };
                recordCurrentRequestRuntimeInfo(context, sub, runtimeInfo);
                scheduleSubscriptionRuntimeInfoUpdate(context, storage, sub, runtimeInfo);
            }

            // 判断是否启用订阅前缀（智能重命名启用时跳过）
            const shouldPrependSubscriptions = profilePrefixSettings?.enableSubscriptions ?? true;
            const shouldAddSubPrefix = shouldPrependSubscriptions && !skipPrefixDueToRenaming;

            return shouldAddSubPrefix && sub.name
                ? validNodes.map((node) => prependNodeName(node, sub.name)).join('\n')
                : validNodes.join('\n');
        } catch (e) {
            recordEmptyRuntimeInfo();
            return (await readCachedNodes()).join('\n');
        }
    };

    // 使用并发控制器限制同时请求数量，避免网络拥塞
    const subPromises = httpSubs.map((sub) => limiter(() => fetchSingleSubscription(sub)));
    const processedSubContents = await Promise.all(subPromises);

    // --- 阶段 1: 原始数据汇聚 (Raw Data Aggregation) ---
    const rawCombinedLines = (processedManualNodeList + '\n' + processedSubContents.join('\n'))
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    // 去重，保留原始顺序中的第一次出现
    let currentLines = [...new Set(rawCombinedLines)];

    if (!shouldKeepEmoji) {
        currentLines = currentLines.map((line) => removeFlagEmoji(line));
    }

    // --- 阶段 2: 核心转换引擎 (Logic Transformation Engine) ---
    // 优先级: 订阅组 Operator Chain > 全局默认 Operator Chain > 旧版 Node Pipeline (桥接模式)

    let activeOperators = [];

    // 获取工作流配置（支持字符串自动解析）
    if (profilePrefixSettings?.operators) {
        activeOperators = ensureArray(profilePrefixSettings.operators);
    }

    if (!activeOperators.length && config.defaultOperators) {
        activeOperators = ensureArray(config.defaultOperators);
    }

    if (!activeOperators.length) {
        const legacyConfig = nodeTransformConfig?.enabled
            ? nodeTransformConfig
            : config.defaultNodeTransform;
        activeOperators = adaptLegacyTransform(legacyConfig);
    }

    // 2.1 执行 Workflow 链式处理 (算子操作)
    if (activeOperators.length > 0) {
        currentLines = await runOperatorChain(currentLines, activeOperators, {
            subName: profilePrefixSettings?.name,
            userAgent,
            config,
        });
    }

    // 2.2 [安全保险] 再次应用订阅组级别的全局过滤逻辑 (Profile-level)
    if (profilePrefixSettings && (profilePrefixSettings.exclude || profilePrefixSettings.include)) {
        currentLines = applyFilterRules(currentLines, profilePrefixSettings);
    }

    // 2.3 [兜底] 应用 Worker 级别的全局过滤逻辑 (Global-level)
    if (config && (config.exclude || config.include)) {
        currentLines = applyFilterRules(currentLines, config);
    }

    // --- 阶段 3: 后置格式化与增强 (Post-Formatting & Enhancement) ---

    // 3.1 YAML 兼容性净化
    currentLines = currentLines.map((line) => sanitizeNodeForYaml(line));

    // 3.2 最终智能化补齐 (Flag Emoji)
    const finalLines = shouldKeepEmoji
        ? currentLines.map((line) => addFlagEmoji(line))
        : currentLines;

    // --- 阶段 4: 结果拼装与返回 ---
    const finalNodeList = finalLines.join('\n');
    let result =
        finalNodeList.length > 0
            ? finalNodeList.endsWith('\n')
                ? finalNodeList
                : finalNodeList + '\n'
            : '';

    // 将虚假节点（如果存在）插入到列表最前面
    if (prependedContent) {
        result = `${prependedContent}\n${result}`;
    }

    // --- 日志记录 ---
    try {
        const endTime = Date.now();
        const totalNodes = finalLines.length;
        const successCount = processedSubContents.filter((c) => c.length > 0).length;
        const failCount = httpSubs.length - successCount;

        // [Stats Export] Populate generation stats to context for use by handler (deferred logging)
        if (context) {
            context.generationStats = {
                totalNodes,
                sourceCount: httpSubs.length,
                successCount,
                failCount,
                upstreamSuccessCount,
                duration: endTime - (context.startTime || Date.now()),
            };
        }

        const isInternalRequest =
            userAgent.includes('MiSub-Backend') || userAgent.includes('TelegramBot');
        if (!debug && config.enableAccessLog && !isInternalRequest) {
            // 避免递归调试日志，并遵循全局日志设置
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
                clientIp =
                    context.request.headers.get('CF-Connecting-IP') ||
                    context.request.headers.get('X-Real-IP') ||
                    context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                    'Unknown';
                if (cf) {
                    geoInfo = {
                        country: cf.country,
                        city: cf.city,
                        isp: cf.asOrganization,
                        asn: cf.asn,
                    };
                }
            }

            await LogService.addLog(context.env, {
                profileName: profilePrefixSettings?.name || 'Unknown Profile',
                clientIp,
                geoInfo,
                userAgent: userAgent || 'Unknown',
                status: failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'error',
                // Include metadata from handler (format, token, type, etc.)
                ...(context && context.logMetadata
                    ? {
                          format: context.logMetadata.format,
                          token: context.logMetadata.token,
                          type: context.logMetadata.type,
                          domain: context.logMetadata.domain,
                      }
                    : {}),
                details: {
                    totalNodes,
                    sourceCount: httpSubs.length,
                    successCount,
                    failCount,
                    duration: endTime - (context.startTime || Date.now()), // 需要在上层记录 startTime
                },
                summary: `生成 ${totalNodes} 个节点 (成功: ${successCount}, 失败: ${failCount})`,
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
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
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
            let base64Part =
                hashIndex !== -1
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
            console.debug(
                '[Subscription] VMess decode failed, falling back to fragment update:',
                e
            );
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
export function applyFilterRules(validNodes, sub) {
    const ruleText = sub.exclude;
    if (!ruleText || ruleText.trim() === '') return validNodes;

    const lines = ruleText
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);

    if (lines.length === 0) return validNodes;

    // 规则分割：--- 为分隔，keep: 为白名单
    const dividerIndex = lines.findIndex((line) => line === '---');
    const hasDivider = dividerIndex !== -1;

    let excludeLines = [];
    let keepLines = [];

    if (hasDivider) {
        lines.slice(0, dividerIndex).forEach((l) => {
            if (l.toLowerCase().startsWith('keep:')) {
                keepLines.push(l);
            } else {
                excludeLines.push(l);
            }
        });
        lines.slice(dividerIndex + 1).forEach((l) => {
            keepLines.push(l);
        });
    } else {
        excludeLines = lines.filter((line) => !line.toLowerCase().startsWith('keep:'));
        keepLines = lines.filter((line) => line.toLowerCase().startsWith('keep:'));
    }

    const excludeRules = buildRuleSet(excludeLines, false);
    const keepRules = buildRuleSet(keepLines, true);

    let result = validNodes;

    if (keepRules.hasRules) {
        result = filterNodes(result, keepRules, 'include');
    }

    if (excludeRules.hasRules) {
        result = filterNodes(result, excludeRules, 'exclude');
    }

    return result;
}

/**
 * 应用订阅治理转换：算子链 + 基于文本的过滤
 * @param {string[]} nodeUrls
 * @param {Object} sub
 * @returns {Promise<string[]>}
 */
async function applySubscriptionTransforms(nodeUrls, sub) {
    if (!nodeUrls || nodeUrls.length === 0) return [];

    let processed = [...nodeUrls];

    // 1. 应用算子链 (如果有算子定义)
    if (Array.isArray(sub.operators) && sub.operators.length > 0) {
        processed = await runOperatorChain(processed, sub.operators);
    }

    // 2. 应用传统的过滤规则 (exclude/include)
    processed = applyFilterRules(processed, sub);

    return processed;
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
            const parts = line
                .substring('proto:'.length)
                .split(',')
                .map((p) => p.trim().toLowerCase())
                .filter(Boolean);
            parts.forEach((p) => protocols.add(p));
            continue;
        }

        patterns.push(line);
    }

    const nameRegex = buildSafeRegex(patterns);
    return {
        protocols,
        nameRegex,
        hasRules: protocols.size > 0 || Boolean(nameRegex),
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

    return nodes.filter((nodeLink) => {
        // [升级] 传统过滤引擎现在也支持元数据/ISO感知
        const nodeInfo = parseNodeInfo(nodeLink);
        const protocol = nodeInfo.protocol || '';
        const nodeName = nodeInfo.name || '';
        const regionZh = nodeInfo.region || '';

        // --- [ISO感知核心逻辑] ---
        // 我们利用 geo-utils 中的 extractNodeRegion 来反查 ISO 代码
        // 虽然 info 里没显式带 regionCode，但在 rules 匹配时增加深度检测
        const protocolHit = protocol && rules.protocols.has(protocol);

        let nameHit = false;
        if (rules.nameRegex) {
            // [双重匹配] 匹配原始名称、中文名，以及尝试匹配 ISO 关键词
            nameHit = rules.nameRegex.test(nodeName) || rules.nameRegex.test(regionZh);

            // 如果上述没中，但规则包含大写 ISO 代码，尝试深度匹配
            if (!nameHit && /^[A-Z]{2}$/.test(rules.nameRegex.source)) {
                // 这里可以进一步扩展，但为了性能目前保持双重匹配
            }
        }

        if (isInclude) {
            return protocolHit || nameHit;
        }
        return !(protocolHit || nameHit);
    });
}

/**
 * 桥接模式：将旧版 NodeTransform 配置转换为新的 Operator 列表
 * @param {Object} config - 旧版配置对象
 * @returns {Array} - 转换后的操作符列表
 */
function adaptLegacyTransform(config) {
    if (!config || !config.enabled) return [];

    const ops = [];

    // 1. 过滤器 (Filter)
    const filter = config.filter;
    if (
        filter &&
        (filter.include?.enabled ||
            filter.exclude?.enabled ||
            filter.protocols?.enabled ||
            filter.regions?.enabled ||
            filter.script?.enabled ||
            filter.useless?.enabled)
    ) {
        ops.push({
            id: 'legacy-filter',
            type: 'filter',
            enabled: true,
            params: { ...filter },
        });
    }

    // 2. 正则重命名 (Regex Rename)
    const regex = config.rename?.regex;
    if (regex?.enabled && regex.rules?.length > 0) {
        ops.push({
            id: 'legacy-rename-regex',
            type: 'rename',
            enabled: true,
            params: { regex: { ...regex } },
        });
    }

    // 3. 模板重命名 (Template Rename)
    const template = config.rename?.template;
    if (template?.enabled) {
        ops.push({
            id: 'legacy-rename-template',
            type: 'rename',
            enabled: true,
            params: {
                template: {
                    enabled: true,
                    template: template.template || '{emoji}{region}-{protocol}-{index}',
                    offset: template.indexStart || 1,
                    indexScope: template.indexScope || 'region',
                },
            },
        });
    }

    // 4. 重命名脚本 (Script Rename)
    const renameScript = config.rename?.script;
    if (renameScript?.enabled && renameScript.expression) {
        ops.push({
            id: 'legacy-rename-script',
            type: 'script',
            enabled: true,
            params: {
                code: `return ($nodes) => { return $nodes.map(n => { n.name = (${renameScript.expression})(n.name, n); return n; }); }`,
            },
        });
    }

    // 5. 去重 (Dedup)
    const dedup = config.dedup;
    if (dedup?.enabled) {
        ops.push({
            id: 'legacy-dedup',
            type: 'dedup',
            enabled: true,
            params: { ...dedup },
        });
    }

    // 6. 排序 (Sort)
    const sort = config.sort;
    if (sort?.enabled && sort.keys?.length > 0) {
        ops.push({
            id: 'legacy-sort',
            type: 'sort',
            enabled: true,
            params: { ...sort },
        });
    }

    return ops;
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
