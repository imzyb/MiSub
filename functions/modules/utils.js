/**
 * 工具函数模块
 * 包含各种通用的辅助函数
 */

import { StorageFactory } from '../storage-adapter.js';
import { defaultSettings } from './subscription.js';

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
 * 条件性写入KV存储，只在数据真正变更时写入
 * @param {Object} env - Cloudflare环境对象
 * @param {string} key - KV键名
 * @param {any} newData - 新数据
 * @param {any} oldData - 旧数据（可选）
 * @returns {Promise<boolean>} - 是否执行了写入操作
 */
export async function conditionalKVPut(env, key, newData, oldData = null) {
    // 如果没有提供旧数据，先从KV读取
    if (oldData === null) {
        try {
            oldData = await env.MISUB_KV.get(key, 'json');
        } catch (error) {
            // 读取失败时，为安全起见执行写入
            await env.MISUB_KV.put(key, JSON.stringify(newData));
            return true;
        }
    }

    // 检测数据是否变更
    if (hasDataChanged(oldData, newData)) {
        await env.MISUB_KV.put(key, JSON.stringify(newData));
        return true;
    } else {
        return false;
    }
}

/**
 * 格式化字节数为人类可读的格式
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的字符串
 */
export function formatBytes(bytes, decimals = 2) {
    if (!+bytes || bytes < 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0) return '0 B';
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * 检测字符串是否为有效的Base64格式
 * @param {string} str - 要检测的字符串
 * @returns {boolean} - 是否为有效Base64
 */
export function isValidBase64(str) {
    const cleanStr = str.replace(/\s/g, '');
    const base64Regex = /^[A-Za-z0-9+\/=]+$/;
    return base64Regex.test(cleanStr) && cleanStr.length > 20;
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

/**
 * 智能获取订阅内容 - v2rayN优先，失败时使用subconverter
 * @param {string} url - 订阅URL
 * @param {string} preferredUserAgent - 首选用户代理
 * @param {Object} env - Cloudflare环境对象（用于subconverter）
 * @returns {Promise<{success: boolean, content: string, userAgent: string, method: string, error?: string}>}
 */
export async function fetchSubscriptionWithFallback(url, preferredUserAgent = 'v2rayN/7.23', env = null) {
    // Cloudflare SSL 配置
    const cfOptions = {
        insecureSkipVerify: true,
        allowUntrusted: true,
        validateCertificate: false
    };

    // 方案1：直接使用 v2rayN/7.23 获取
    try {
        console.log(`[Subscription Fetch] 尝试直接获取: ${url}`);

        const response = await Promise.race([
            fetch(new Request(url, {
                headers: { 'User-Agent': preferredUserAgent },
                redirect: "follow",
                cf: cfOptions
            })),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 10000))
        ]);

        if (response.ok) {
            const text = await response.text();

            // 检查是否是验证页面或错误页面
            if (text.includes('Just a moment...') || text.includes('cf-browser-verification') ||
                text.includes('Access denied') || text.includes('Error 403')) {
                console.warn(`[Subscription Fetch] 直接获取被拦截，尝试 subconverter`);
            } else if (text.trim().length > 0) {
                console.log(`[Subscription Fetch] 直接获取成功，内容长度: ${text.length}`);
                return {
                    success: true,
                    content: text,
                    userAgent: preferredUserAgent,
                    method: 'direct'
                };
            }
        } else {
            console.warn(`[Subscription Fetch] 直接获取失败，状态码: ${response.status}`);
        }
    } catch (error) {
        console.warn(`[Subscription Fetch] 直接获取异常: ${error.message}`);
    }

    // 方案2：使用 subconverter 间接获取
    if (env && env.MISUB_KV) {
        try {
            console.log(`[Subscription Fetch] 尝试 subconverter 获取: ${url}`);

            // 获取配置
            const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
            const settingsData = await storageAdapter.get('worker_settings_v1') || {};
            const settings = { ...defaultSettings, ...settingsData };

            if (settings.subConverter && settings.subConverter.trim() !== '') {
                const subconverterUrl = new URL(`https://${settings.subConverter}/sub`);
                subconverterUrl.searchParams.set('target', 'base64');  // 获取原始内容
                subconverterUrl.searchParams.set('url', url);
                subconverterUrl.searchParams.set('new_name', 'false');  // 不重命名节点

                const subconverterResponse = await Promise.race([
                    fetch(subconverterUrl.toString(), {
                        headers: { 'User-Agent': 'MiSub-Converter/1.0' },
                        cf: cfOptions
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Subconverter timeout')), 15000))
                ]);

                if (subconverterResponse.ok) {
                    const base64Content = await subconverterResponse.text();

                    // subconverter 返回的是 base64 编码的内容，需要解码
                    try {
                        const decodedContent = atob(base64Content.replace(/\s/g, ''));
                        console.log(`[Subscription Fetch] Subconverter 成功，内容长度: ${decodedContent.length}`);

                        return {
                            success: true,
                            content: decodedContent,
                            userAgent: 'subconverter',
                            method: 'subconverter'
                        };
                    } catch (decodeError) {
                        console.warn(`[Subscription Fetch] Subconverter 内容解码失败: ${decodeError.message}`);
                        // 如果解码失败，尝试直接使用返回的内容
                        return {
                            success: true,
                            content: base64Content,
                            userAgent: 'subconverter',
                            method: 'subconverter'
                        };
                    }
                } else {
                    console.warn(`[Subscription Fetch] Subconverter 失败，状态码: ${subconverterResponse.status}`);
                }
            } else {
                console.warn(`[Subscription Fetch] 未配置 subconverter`);
            }
        } catch (subconverterError) {
            console.warn(`[Subscription Fetch] Subconverter 异常: ${subconverterError.message}`);
        }
    }

    return {
        success: false,
        content: '',
        userAgent: 'none',
        method: 'failed',
        error: '直接获取和 subconverter 都失败'
    };
}

/**
 * 根据客户端类型确定合适的用户代理
 * @param {string} originalUserAgent - 原始用户代理字符串
 * @returns {string} - 处理后的用户代理字符串
 */
export function getProcessedUserAgent(originalUserAgent, url = '') {
    if (!originalUserAgent) return originalUserAgent;

    // CF-Workers-SUB的精华策略：
    // 统一使用v2rayN UA获取订阅，绕过机场过滤同时保证获取完整节点
    return 'v2rayN/7.23';
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

    const fetchPromise = fetch(new Request(input, {
        ...init,
        signal: controller.signal
    }));

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
 * 创建统一错误响应
 * @param {string} error - 错误信息
 * @param {string} context - 错误上下文
 * @param {number} status - HTTP状态码
 * @returns {Response} HTTP响应
 */
export function createErrorResponse(error, context = '', status = 500) {
    const errorInfo = {
        success: false,
        error: error.message || error,
        context,
        timestamp: new Date().toISOString()
    };

    console.error(`[${context || 'Error'}] ${errorInfo.error}`, error);

    return createJsonResponse(errorInfo, status);
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
            console.log(`[${timestamp}] ${message}`, data);
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

    // 如果没有新的 prefixConfig，但有老的 prependSubName，则创建默认的 prefixConfig
    if (!migratedConfig.prefixConfig) {
        const fallbackEnabled = migratedConfig.prependSubName ?? true;
        migratedConfig.prefixConfig = {
            enableManualNodes: fallbackEnabled,
            enableSubscriptions: fallbackEnabled,
            manualNodePrefix: '手动节点'
        };
    }

    // 确保 prefixConfig 的所有字段都存在
    if (!migratedConfig.prefixConfig.hasOwnProperty('enableManualNodes')) {
        migratedConfig.prefixConfig.enableManualNodes = migratedConfig.prependSubName ?? true;
    }
    if (!migratedConfig.prefixConfig.hasOwnProperty('enableSubscriptions')) {
        migratedConfig.prefixConfig.enableSubscriptions = migratedConfig.prependSubName ?? true;
    }
    if (!migratedConfig.prefixConfig.hasOwnProperty('manualNodePrefix')) {
        migratedConfig.prefixConfig.manualNodePrefix = '手动节点';
    }

    return migratedConfig;
}

/**
 * 创建JSON响应
 * @param {Object} data - 响应数据
 * @param {number} status - HTTP状态码
 * @returns {Response} Response对象
 */
export function createJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}