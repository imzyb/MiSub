//
// src/lib/api.js
//

import { api, APIError } from './http.js';

/**
 * 统一的 API 错误处理辅助函数
 * @param {Error} error - 错误对象
 * @param {string} context - 错误上下文
 * @returns {Object} 标准错误响应
 */
function handleApiError(error, context = '') {
    console.error(`[API Error - ${context}]`, error);

    let errorType = 'unknown';
    let errorMessage = '未知错误';

    if (error instanceof APIError) {
        if (error.status === 401) {
            errorType = 'auth';
            errorMessage = '认证失败,请重新登录';
        } else {
            errorType = 'server';
            errorMessage = error.message || `HTTP ${error.status}`;
        }
    } else if (error.name === 'AbortError') {
        errorType = 'timeout';
        errorMessage = '请求超时,请稍后重试';
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorType = 'network';
        errorMessage = '网络连接失败,请检查网络连接';
    } else if (error.message === 'UNAUTHORIZED') {
        errorType = 'auth';
        errorMessage = '认证失败,请重新登录';
    } else if (error.message.includes('HTTP')) {
        errorType = 'server';
        errorMessage = error.message;
    } else if (error.name === 'SyntaxError') {
        errorType = 'server';
        errorMessage = '服务器响应格式错误';
    } else {
        errorMessage = error.message || '操作失败,请稍后重试';
    }

    return {
        success: false,
        error: errorMessage,
        errorType: errorType
    };
}
export async function fetchInitialData() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

        const data = await api.get('/api/data', { signal: controller.signal });
        clearTimeout(timeoutId);

        // 检查新的认证状态响应 (200 OK with authenticated: false)
        if (data && data.authenticated === false) {
            return { success: false, error: '认证失败,请重新登录', errorType: 'auth' };
        }

        return { success: true, data };
    } catch (error) {
        return handleApiError(error, 'fetchInitialData');
    }
}

export async function login(password) {
    try {
        const data = await api.post('/api/login', { password });
        return { success: true, data };
    } catch (error) {
        if (error instanceof APIError && error.status === 401) {
            return {
                success: false,
                error: error.data?.message || error.data?.error || '登录失败',
                errorType: 'auth'
            };
        }
        return handleApiError(error, 'login');
    }
}

// [核心修改] saveMisubs 现在接收并发送 profiles
export async function saveMisubs(misubs, profiles) {
    try {
        // 数据预验证
        if (!Array.isArray(misubs) || !Array.isArray(profiles)) {
            return { success: false, error: '数据格式错误：misubs 和 profiles 必须是数组', errorType: 'validation' };
        }

        return await api.post('/api/misubs', { misubs, profiles });
    } catch (error) {
        return handleApiError(error, 'saveMisubs');
    }
}

export async function fetchNodeCount(subUrl, fetchProxy = '', plusAsSpace = false) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

        const payload = { url: subUrl };
        if (fetchProxy) {
            payload.fetchProxy = fetchProxy;
        }
        if (plusAsSpace) {
            payload.plusAsSpace = true;
        }

        const data = await api.post('/api/node_count', payload, { signal: controller.signal });
        clearTimeout(timeoutId);

        return { success: true, data }; // data 包含 { count, userInfo }
    } catch (error) {
        return handleApiError(error, 'fetchNodeCount');
    }
}

export async function fetchSettings() {
    try {
        const data = await api.get(`/api/settings?t=${Date.now()}`);
        return { success: true, data };
    } catch (error) {
        return handleApiError(error, 'fetchSettings');
    }
}

export async function fetchPublicConfig() {
    try {
        const data = await api.get('/api/public_config');
        return { success: true, data };
    } catch (error) {
        return handleApiError(error, 'fetchPublicConfig');
    }
}

export async function saveSettings(settings) {
    try {
        return await api.post('/api/settings', settings);
    } catch (error) {
        return handleApiError(error, 'saveSettings');
    }
}

/**
 * 批量更新订阅的节点信息
 * @param {string[]} subscriptionIds - 要更新的订阅ID数组
 * @returns {Promise<Object>} - 更新结果
 */
export async function batchUpdateNodes(subscriptionIds) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超时

        const result = await api.post('/api/batch_update_nodes', { subscriptionIds }, { signal: controller.signal });
        clearTimeout(timeoutId);

        return result;
    } catch (error) {
        return handleApiError(error, 'batchUpdateNodes');
    }
}

/**
 * 数据迁移：从 KV 迁移到 D1 数据库
 * @returns {Promise<Object>} - 迁移结果
 */
export async function migrateToD1() {
    try {
        return await api.post('/api/migrate_to_d1');
    } catch (error) {
        if (error instanceof APIError) {
            return {
                success: false,
                error: error.message,
                errorType: 'server',
                details: error.data?.details || error.data?.errors
            };
        }
        return handleApiError(error, 'migrateToD1');
    }
}

export async function detectLegacyD1() {
    try {
        return await api.get('/api/detect_legacy_d1');
    } catch (error) {
        return handleApiError(error, 'detectLegacyD1');
    }
}

export async function migrateLegacyD1() {
    try {
        return await api.post('/api/migrate_legacy_d1');
    } catch (error) {
        if (error instanceof APIError) {
            return {
                success: false,
                error: error.message,
                errorType: 'server',
                details: error.data?.details || error.data?.errors
            };
        }
        return handleApiError(error, 'migrateLegacyD1');
    }
}

export async function fetchGithubLatestRelease(repo) {
    try {
        return await api.get(`/api/github/release?repo=${encodeURIComponent(repo)}`);
    } catch (error) {
        return handleApiError(error, 'fetchGithubLatestRelease');
    }
}

/**
 * 测试订阅链接内容
 * @param {string} url - 订阅URL
 * @param {string} userAgent - User-Agent
 * @returns {Promise<Object>} - 测试结果
 */
export async function testSubscription(url, userAgent) {
    try {
        return await api.post('/api/debug_subscription', { url, userAgent });
    } catch (error) {
        return handleApiError(error, 'testSubscription');
    }
}
