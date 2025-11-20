//
// src/lib/api.js
//
export async function fetchInitialData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) {
            console.error("Session invalid or API error, status:", response.status);
            return null;
        }
        // 后端已经更新，会返回 { misubs, profiles, config }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        return null;
    }
}

export async function login(password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        return response;
    } catch (error) {
        console.error("Login request failed:", error);
        return { ok: false, error: '网络请求失败' };
    }
}

// [核心修改] saveMisubs 现在接收并发送 profiles
export async function saveMisubs(misubs, profiles) {
    try {
        // 数据预验证
        if (!Array.isArray(misubs) || !Array.isArray(profiles)) {
            return { success: false, message: '数据格式错误：misubs 和 profiles 必须是数组' };
        }

        const response = await fetch('/api/misubs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 将 misubs 和 profiles 一起发送
            body: JSON.stringify({ misubs, profiles })
        });

        // 检查HTTP状态码
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || errorData.error || `服务器错误 (${response.status})`;
            return { success: false, message: errorMessage };
        }

        return await response.json();
    } catch (error) {
        console.error('saveMisubs 网络请求失败:', error);

        // 根据错误类型返回更具体的错误信息
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return { success: false, message: '网络连接失败，请检查网络连接' };
        } else if (error.name === 'SyntaxError') {
            return { success: false, message: '服务器响应格式错误' };
        } else {
            return { success: false, message: `网络请求失败: ${error.message}` };
        }
    }
}

export async function fetchNodeCount(subUrl) {
    try {
        const res = await fetch('/api/node_count', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: subUrl })
        });
        const data = await res.json();
        return data; // [修正] 直接返回整个对象 { count, userInfo }
    } catch (e) {
        console.error('fetchNodeCount error:', e);
        return { count: 0, userInfo: null };
    }
}

export async function fetchSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) return {};
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return {};
    }
}

export async function saveSettings(settings) {
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        // 检查HTTP状态码
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || errorData.error || `服务器错误 (${response.status})`;
            return { success: false, message: errorMessage };
        }

        return await response.json();
    } catch (error) {
        console.error('saveSettings 网络请求失败:', error);

        // 根据错误类型返回更具体的错误信息
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return { success: false, message: '网络连接失败，请检查网络连接' };
        } else if (error.name === 'SyntaxError') {
            return { success: false, message: '服务器响应格式错误' };
        } else {
            return { success: false, message: `网络请求失败: ${error.message}` };
        }
    }
}

/**
 * 批量更新订阅的节点信息
 * @param {string[]} subscriptionIds - 要更新的订阅ID数组
 * @returns {Promise<Object>} - 更新结果
 */
export async function batchUpdateNodes(subscriptionIds) {
    try {
        const response = await fetch('/api/batch_update_nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionIds })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || errorData.error || `服务器错误 (${response.status})`;
            return { success: false, message: errorMessage };
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Failed to batch update nodes:", error);
        return { success: false, message: '网络请求失败，请检查网络连接' };
    }
}

/**
 * 数据迁移：从 KV 迁移到 D1 数据库
 * @returns {Promise<Object>} - 迁移结果
 */
export async function migrateToD1() {
    try {
        const response = await fetch('/api/migrate_to_d1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || errorData.error || `服务器错误 (${response.status})`;
            return { success: false, message: errorMessage };
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Failed to migrate to D1:", error);
        return { success: false, message: '网络请求失败，请检查网络连接' };
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
        const response = await fetch('/api/debug_subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, userAgent })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || errorData.error || `服务器错误 (${response.status})`;
            return { success: false, message: errorMessage };
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Failed to test subscription:", error);
        return { success: false, message: '网络请求失败，请检查网络连接' };
    }
}
