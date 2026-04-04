/**
 * 工具函数模块
 * 包含各种通用的辅助函数
 */

/**
 * 计算数据的简单哈希值，用于检测变更
 * @param {any} data - 要计算哈希的数据
 * @returns {string} - 数据的哈希值
 */
export function calculateDataHash(data) {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
}

/**
 * 检测数据是否发生变更
 * @param {any} oldData - 旧数据
 * @param {any} newData - 新数据
 * @returns {boolean} - 是否发生变更
 */
export function hasDataChanged(oldData, newData) {
    if (!oldData && !newData) return false;
    if (!oldData || !newData) return true;
    return calculateDataHash(oldData) !== calculateDataHash(newData);
}

/**
 * 获取 KV namespace。
 * 仅从 Cloudflare Pages 的 env 绑定读取。
 * @param {Object} env
 * @returns {Object|null}
 */
function getKV(env) {
    return env?.MISUB_KV || null;
}

/**
 * 读取运行时环境变量。
 * @param {Object} env
 * @param {string} key
 * @returns {string|undefined}
 */
function getRuntimeEnvValue(env, key) {
    const envValue = env?.[key];
    if (envValue !== undefined && envValue !== null && String(envValue).trim() !== '') {
        return String(envValue);
    }

    return undefined;
}

function isStorageUnavailableError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('kv storage is paused')
        || message.includes('storage is paused')
        || message.includes('namespace is paused');
}

async function safeKvGet(kv, key) {
    if (!kv) return null;
    try {
        return await kv.get(key);
    } catch (error) {
        if (isStorageUnavailableError(error)) {
            console.warn(`[Auth Storage] KV get skipped for ${key}: ${error.message}`);
            return null;
        }
        throw error;
    }
}

async function safeKvPut(kv, key, value) {
    if (!kv) return false;
    try {
        await kv.put(key, value);
        return true;
    } catch (error) {
        if (isStorageUnavailableError(error)) {
            console.warn(`[Auth Storage] KV put skipped for ${key}: ${error.message}`);
            return false;
        }
        throw error;
    }
}

/**
 * 条件性写入KV存储，只在数据真正变更时写入
 * @param {Object} env - Cloudflare环境对象
 * @param {string} key - KV键名
 * @param {any} newData - 新数据
 * @param {any} oldData - 旧数据（可选）
 * @returns {Promise<boolean>} - 是否执行了写入操作
 */
export async function conditionalKVPut(env, key, newData, oldData = null) {
    const kv = getKV(env);
    // 如果没有提供旧数据，先从KV读取
    if (oldData === null) {
        try {
            oldData = await kv.get(key).then(r => r ? JSON.parse(r) : null);
        } catch (error) {
            // 读取失败时，为安全起见执行写入
            await kv.put(key, JSON.stringify(newData));
            return true;
        }
    }

    // 检测数据是否变更
    if (hasDataChanged(oldData, newData)) {
        await kv.put(key, JSON.stringify(newData));
        return true;
    } else {
        return false;
    }
}

/**
 * 获取或生成 Cookie 加密密钥
 * 优先顺序：KV → 环境变量 COOKIE_SECRET → 随机生成（无 KV 时仅内存有效）
 * @param {Object} env - 运行时环境对象
 * @returns {Promise<string>} 密钥
 */
export async function getCookieSecret(env) {
    const kv = getKV(env);
    const runtimeCookieSecret = getRuntimeEnvValue(env, 'COOKIE_SECRET');

    if (kv) {
        // 1. 尝试从 KV 读取
        const kvSecret = await safeKvGet(kv, 'SYSTEM_COOKIE_SECRET');
        if (kvSecret) return kvSecret;

        // 2. 有环境变量则优先回退到环境变量，并尽力写回 KV
        if (runtimeCookieSecret) {
            await safeKvPut(kv, 'SYSTEM_COOKIE_SECRET', runtimeCookieSecret);
            return runtimeCookieSecret;
        }

        // 3. 生成新密钥并尽力持久化到 KV；若 KV 暂不可用则退化为本次运行临时密钥
        const newSecret = crypto.randomUUID();
        await safeKvPut(kv, 'SYSTEM_COOKIE_SECRET', newSecret);
        return newSecret;
    }

    // 无 KV：直接使用环境变量，无则生成临时密钥（重启后失效）
    if (runtimeCookieSecret) return runtimeCookieSecret;
    return crypto.randomUUID();
}

/**
 * 获取管理员密码
 * 优先顺序：环境变量 ADMIN_PASSWORD → KV → 默认值 'admin'
 * @param {Object} env - 运行时环境对象
 * @returns {Promise<string>} 密码
 */
export async function getAdminPassword(env) {
    const runtimeAdminPassword = getRuntimeEnvValue(env, 'ADMIN_PASSWORD');
    if (runtimeAdminPassword) {
        return runtimeAdminPassword.trim();
    }

    const kv = getKV(env);
    if (kv) {
        const kvPassword = await safeKvGet(kv, 'SYSTEM_ADMIN_PASSWORD');
        if (kvPassword) return String(kvPassword).trim();
    }

    return 'admin';
}

/**
 * 获取认证相关调试信息（不返回任何敏感值）
 * @param {Object} env
 * @returns {Promise<Object>}
 */
export async function getAuthDebugInfo(env) {
    const runtimeAdminPassword = getRuntimeEnvValue(env, 'ADMIN_PASSWORD');
    const runtimeCookieSecret = getRuntimeEnvValue(env, 'COOKIE_SECRET');
    const kv = getKV(env);

    let hasKvAdminPassword = false;
    let hasKvCookieSecret = false;

    if (kv) {
        hasKvAdminPassword = !!(await safeKvGet(kv, 'SYSTEM_ADMIN_PASSWORD'));
        hasKvCookieSecret = !!(await safeKvGet(kv, 'SYSTEM_COOKIE_SECRET'));
    }

    let adminPasswordSource = 'default';
    if (runtimeAdminPassword) {
        adminPasswordSource = 'env';
    } else if (hasKvAdminPassword) {
        adminPasswordSource = 'kv';
    }

    let cookieSecretSource = 'generated';
    if (runtimeCookieSecret) {
        cookieSecretSource = 'env';
    } else if (hasKvCookieSecret) {
        cookieSecretSource = 'kv';
    }

    return {
        hasKv: !!kv,
        hasD1: !!env?.MISUB_DB,
        adminPassword: {
            source: adminPasswordSource,
            hasRuntime: !!runtimeAdminPassword,
            hasKvValue: hasKvAdminPassword,
            isDefaultFallback: adminPasswordSource === 'default'
        },
        cookieSecret: {
            source: cookieSecretSource,
            hasRuntime: !!runtimeCookieSecret,
            hasKvValue: hasKvCookieSecret,
            mayRegenerateWithoutKv: !kv && !runtimeCookieSecret
        }
    };
}

/**
 * 检查是否正在使用默认密码
 * @param {Object} env
 * @returns {Promise<boolean>}
 */
export async function isUsingDefaultPassword(env) {
    const current = await getAdminPassword(env);
    return current === 'admin';
}

/**
 * 设置管理员密码
 * 有 KV 时持久化到 KV；无 KV 时抛出提示
 * @param {Object} env - 运行时环境对象
 * @param {string} newPassword - 新密码
 */
export async function setAdminPassword(env, newPassword) {
    const kv = getKV(env);
    if (!kv) {
        throw new Error('当前部署未绑定 KV，请在平台控制台通过环境变量 ADMIN_PASSWORD 修改密码');
    }
    await kv.put('SYSTEM_ADMIN_PASSWORD', newPassword);
}

export { formatBytes } from '../../src/shared/utils.js';

/**
 * 检测字符串是否为有效的Base64格式
 * @param {string} str - 要检测的字符串
 * @returns {boolean} - 是否为有效Base64
 */
export function isValidBase64(str) {
    const cleanStr = str.replace(/\s/g, '');
    if (!cleanStr) return false;

    let normalized = cleanStr.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    if (padding) {
        normalized += '='.repeat(4 - padding);
    }

    const base64Regex = /^[A-Za-z0-9+\/=]+$/;
    return base64Regex.test(normalized) && normalized.length > 20;
}

/**
 * 修复Clash配置中的WireGuard问题
 * @param {string} content - Clash配置内容
 * @returns {string} - 修复后的配置内容
 */
export function clashFix(content) {
    if (content.includes('wireguard') && !content.includes('remote-dns-resolve')) {
        let lines;
        if (content.includes('\r\n')) {
            lines = content.split('\r\n');
        } else {
            lines = content.split('\n');
        }

        let result = "";
        for (let line of lines) {
            if (line.includes('type: wireguard')) {
                const 备改内容 = `, mtu: 1280, udp: true`;
                const 正确内容 = `, mtu: 1280, remote-dns-resolve: true, udp: true`;
                result += line.replace(new RegExp(备改内容, 'g'), 正确内容) + '\n';
            } else {
                result += line + '\n';
            }
        }
        return result;
    }
    return content;
}

import { SYSTEM_CONSTANTS } from './config.js';

/**
 * 根据客户端类型确定合适的用户代理
 * @param {string} originalUserAgent - 原始用户代理字符串
 * @returns {string} - 处理后的用户代理字符串
 */
export function getProcessedUserAgent(originalUserAgent, url = '') {
    if (!originalUserAgent) return originalUserAgent;

    // CF-Workers-SUB的精华策略：
    // 统一使用v2rayN UA获取订阅，绕过机场过滤同时保证获取完整节点
    return SYSTEM_CONSTANTS.FETCHER_USER_AGENT;
}

/**
 * 名称前缀辅助函数
 * @param {string} link - 节点链接
 * @param {string} prefix - 前缀文本
 * @returns {string} 添加前缀后的链接
 */
export function prependNodeName(link, prefix) {
    if (!prefix) return link;
    const appendToFragment = (baseLink, namePrefix) => {
        const hashIndex = baseLink.lastIndexOf('#');
        const originalName = hashIndex !== -1 ? decodeURIComponent(baseLink.substring(hashIndex + 1)) : '';
        const base = hashIndex !== -1 ? baseLink.substring(0, hashIndex) : baseLink;
        if (originalName.startsWith(namePrefix)) {
            return baseLink;
        }
        const newName = originalName ? `${namePrefix} - ${originalName}` : namePrefix;
        return `${base}#${encodeURIComponent(newName)}`;
    };
    if (link.startsWith('vmess://')) {
        try {
            const base64Part = link.substring('vmess://'.length);
            const binaryString = atob(base64Part);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const jsonString = new TextDecoder('utf-8').decode(bytes);
            const nodeConfig = JSON.parse(jsonString);
            const originalPs = nodeConfig.ps || '';
            if (!originalPs.startsWith(prefix)) {
                nodeConfig.ps = originalPs ? `${prefix} - ${originalPs}` : prefix;
            }
            const newJsonString = JSON.stringify(nodeConfig);
            const newBase64Part = btoa(unescape(encodeURIComponent(newJsonString)));
            return 'vmess://' + newBase64Part;
        } catch (e) {
            console.error("为 vmess 节点添加名称前缀失败，将回退到通用方法。", e);
            return appendToFragment(link, prefix);
        }
    }
    return appendToFragment(link, prefix);
}

/**
 * 创建带超时的请求
 * @param {RequestInfo} input - 请求输入
 * @param {RequestInit} init - 请求初始化选项
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<Response>} 响应
 */
export function createTimeoutFetch(input, init = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // 分离 cf 选项：cf 是 Cloudflare Workers fetch 特有的选项，
    // 不属于标准 RequestInit，不应传入 Request 构造器。
    // 将其直接传给 fetch() 的第二参数，Cloudflare 环境正常生效，Node.js 环境安全忽略。
    const { cf, ...requestInit } = init;
    const request = new Request(input, {
        ...requestInit,
        signal: controller.signal
    });
    const fetchPromise = cf ? fetch(request, { cf }) : fetch(request);

    return fetchPromise.finally(() => {
        clearTimeout(timeoutId);
    });
}

/**
 * 带重试机制的请求函数
 * @param {RequestInfo} input - 请求输入
 * @param {RequestInit} init - 请求初始化选项
 * @param {Object} options - 选项
 * @param {number} options.maxRetries - 最大重试次数
 * @param {number} options.timeout - 每次请求超时时间
 * @param {number} options.baseDelay - 基础延迟时间
 * @returns {Promise<Response>} 响应
 */
export async function retryFetch(input, init = {}, options = {}) {
    const {
        maxRetries = 3,
        timeout = 10000,
        baseDelay = 1000
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await createTimeoutFetch(input, init, timeout);
        } catch (error) {
            lastError = error;

            // 如果是最后一次尝试，直接抛出错误
            if (attempt === maxRetries) {
                throw error;
            }

            // 计算延迟时间（指数退避）
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`[Retry] Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);

            // 等待延迟
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}



/**
 * 安全的存储操作包装器
 * @param {Function} operation - 存储操作函数
 * @param {any} fallback - 操作失败时的默认返回值
 * @param {string} context - 操作上下文
 * @returns {Promise<any>} 操作结果
 */
export async function safeStorageOperation(operation, fallback = null, context = '') {
    try {
        return await operation();
    } catch (error) {
        console.error(`[Storage] ${context} failed:`, error);
        return fallback;
    }
}

/**
 * 通用日志函数
 * @param {string} level - 日志级别 (info, warn, error)
 * @param {string} message - 日志消息
 * @param {any} data - 附加数据
 */
export function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        data
    };

    switch (level) {
        case 'info':
            console.info(`[${timestamp}] ${message}`, data);
            break;
        case 'warn':
            console.warn(`[${timestamp}] ${message}`, data);
            break;
        case 'error':
            console.error(`[${timestamp}] ${message}`, data);
            break;
        default:
            console.info(`[${timestamp}] ${message}`, data);
    }

    return logEntry;
}

/**
 * 获取回调令牌
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<string>} 回调令牌
 */
export async function getCallbackToken(env) {
    const secret = env.COOKIE_SECRET || 'default-callback-secret';
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode('callback-static-data'));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * 处理配置的向后兼容性，确保新的前缀配置结构存在
 * @param {Object} config - 原始配置对象
 * @returns {Object} - 处理后的配置对象
 */
export function migrateConfigSettings(config) {
    const migratedConfig = { ...config };

    // [Fix] 强制转换为布尔值，防止 KV 中存储了字符串"false"导致判断错误
    const toBoolean = (val) => {
        if (typeof val === 'string') {
            return val.toLowerCase() === 'true';
        }
        return !!val;
    };

    if (migratedConfig.hasOwnProperty('enableAccessLog')) {
        migratedConfig.enableAccessLog = toBoolean(migratedConfig.enableAccessLog);
    }
    if (migratedConfig.hasOwnProperty('enableTrafficNode')) {
        migratedConfig.enableTrafficNode = toBoolean(migratedConfig.enableTrafficNode);
    }
    if (migratedConfig.hasOwnProperty('subConverterScv')) {
        migratedConfig.subConverterScv = toBoolean(migratedConfig.subConverterScv);
    }
    if (migratedConfig.hasOwnProperty('subConverterUdp')) {
        migratedConfig.subConverterUdp = toBoolean(migratedConfig.subConverterUdp);
    }
    if (migratedConfig.hasOwnProperty('builtinLoonSkipCertVerify')) {
        migratedConfig.builtinLoonSkipCertVerify = toBoolean(migratedConfig.builtinLoonSkipCertVerify);
    }

    return migratedConfig;
}


/**
 * 创建标准JSON响应
 * @param {Object} data - 响应数据
 * @param {number} status - HTTP状态码
 * @param {Object} headers - 额外的HTTP头
 * @returns {Response}
 */
export function createJsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            ...headers
        }
    });
}

/**
 * 获取用于外部回调的基础 URL
 * @param {Object} env - Cloudflare环境对象
 * @param {URL} requestUrl - 当前请求 URL
 * @returns {URL} - 规范化后的基础 URL
 */
export function getPublicBaseUrl(env, requestUrl) {
    const configured = (env?.MISUB_CALLBACK_URL || env?.MISUB_PUBLIC_URL || '').trim();
    if (!configured) {
        return new URL(requestUrl.origin);
    }

    const hasProtocol = /^https?:\/\//i.test(configured);
    const normalized = hasProtocol ? configured : `https://${configured}`;
    const baseUrl = new URL(normalized);
    baseUrl.pathname = '';
    baseUrl.search = '';
    baseUrl.hash = '';
    return baseUrl;
}

/**
 * 自定义 API 错误类
 */
export class APIError extends Error {
    constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

/**
 * 转义HTML特殊字符，防止XSS和Telegram解析错误
 * @param {string} str - 需要转义的字符串
 * @returns {string} - 转义后的字符串
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 创建标准错误响应
 * @param {Error|string} error - 错误对象或错误消息
 * @param {number} status - HTTP状态码 (默认500)
 * @returns {Response}
 */
export function createErrorResponse(error, status = 500) {
    let message = 'Internal Server Error';
    let code = 'INTERNAL_ERROR';
    let details = null;

    if (error instanceof APIError) {
        status = error.status;
        message = error.message;
        code = error.code;
        details = error.details;
    } else if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }

    return createJsonResponse({
        success: false,
        error: message,
        code,
        details
    }, status);
}

/**
 * 迁移旧版 profile ID，去除 'profile_' 前缀
 * 旧版 generateProfileId() 使用 generateId('profile') 生成带前缀的 ID，
 * 当前版本已修复为不加前缀，但数据库中可能存留旧数据。
 * @param {Array} profiles - 订阅组列表
 * @returns {boolean} 是否发生了迁移
 */
export function migrateProfileIds(profiles) {
    if (!Array.isArray(profiles)) return false;
    let migrated = false;
    for (const p of profiles) {
        if (p.id && p.id.startsWith('profile_')) {
            p.id = p.id.slice('profile_'.length);
            migrated = true;
        }
    }
    return migrated;
}
