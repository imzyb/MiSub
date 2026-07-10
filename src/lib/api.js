//
// src/lib/api.js
//

import { api, APIError } from './http.js';
import { t } from '../i18n/index.js';

/**
 * 统一的 API 错误处理辅助函数
 * @param {Error} error - 错误对象
 * @param {string} context - 错误上下文
 * @returns {Object} 标准错误响应
 */
function handleApiError(error, context = '') {
    console.error(`[API Error - ${context}]`, error);

    let errorType = 'unknown';
    let errorMessage = t('subscriptions.unknownError');

    let status = null;

    if (error instanceof APIError) {
        status = error.status;
        if (error.status === 401) {
            errorType = 'auth';
            errorMessage = t('settings.authFailedRelogin');
        } else {
            errorType = 'server';
            const message = error.message || `HTTP ${error.status}`;
            errorMessage = formatHttpErrorMessage(error.status, message);
        }
    } else if (error.name === 'AbortError') {
        errorType = 'timeout';
        errorMessage = t('settings.requestTimeout');
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorType = 'network';
        errorMessage = t('settings.networkFailedGeneric');
    } else if (error.message === 'UNAUTHORIZED') {
        errorType = 'auth';
        errorMessage = t('settings.authFailedRelogin');
    } else if (error.message.includes('HTTP')) {
        errorType = 'server';
        errorMessage = error.message;
    } else if (error.name === 'SyntaxError') {
        errorType = 'server';
        errorMessage = t('settings.serverResponseInvalid');
    } else {
        errorMessage = error.message || t('settings.operationFailed');
    }

    return {
        success: false,
        error: errorMessage,
        errorType: errorType,
        status
    };
}

function extractHttpStatus(message = '') {
    const match = String(message).match(/HTTP\s+(\d{3})/i);
    return match ? Number(match[1]) : null;
}

function formatHttpErrorMessage(status, message = '') {
    const normalizedMessage = String(message || '').trim();
    if (!status) return normalizedMessage;
    if (new RegExp(`^HTTP\\s+${status}\\b`, 'i').test(normalizedMessage)) {
        return normalizedMessage;
    }
    return `HTTP ${status}: ${normalizedMessage || `HTTP ${status}`}`;
}

function normalizeApiFailure(data, fallbackMessage = t('settings.operationFailed')) {
    const error = data?.error || data?.message || fallbackMessage;
    const status = data?.status || extractHttpStatus(error);
    return {
        success: false,
        error,
        errorType: data?.errorType || (status ? 'server' : 'unknown'),
        status,
        data
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
            return { success: false, error: t('settings.authFailedRelogin'), errorType: 'auth' };
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
                error: error.data?.message || error.data?.error || t('settings.loginFailed'),
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
            return { success: false, error: t('settings.dataFormatInvalid'), errorType: 'validation' };
        }

        return await api.post('/api/misubs', { misubs, profiles });
    } catch (error) {
        return handleApiError(error, 'saveMisubs');
    }
}

export async function fetchNodeCount(subUrl, fetchProxy = '', plusAsSpace = false, userAgent = '') {
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
        if (userAgent) {
            payload.userAgent = userAgent;
        }

        const data = await api.post('/api/node_count', payload, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (data?.success === false) {
            return normalizeApiFailure(data, t('settings.updateNodeInfoFailed'));
        }

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
 * 恢复出厂设置（仅限设置项，不删除节点和订阅组）
 * @returns {Promise<Object>} - 重置结果
 */
export async function resetSettings() {
    try {
        return await api.post('/api/settings/reset');
    } catch (error) {
        return handleApiError(error, 'resetSettings');
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

        if (result?.success === false) {
            return normalizeApiFailure(result, '批量更新节点信息失败');
        }

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

export async function testSubconverterBackend(backend, target = 'clash') {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const data = await api.post('/api/subconverter/test', { backend, target }, { signal: controller.signal });
        clearTimeout(timeoutId);
        return data;
    } catch (error) {
        return handleApiError(error, 'testSubconverterBackend');
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
