/**
 * 错误处理工具函数
 * @author MiSub Team
 */

const isDev = import.meta.env.DEV;

/**
 * 标准化API错误响应
 * @param {Error} error - 错误对象
 * @param {string} context - 错误上下文
 * @returns {Object} 标准化的错误对象
 */
export function createApiError(error, context = 'Unknown') {
    console.error(`[${context}] Error:`, error);

    return {
        success: false,
        message: error.message || '未知错误',
        error: error.name || 'Error',
        context,
        timestamp: new Date().toISOString()
    };
}

/**
 * 处理API响应错误
 * @param {Response} response - fetch响应
 * @param {string} context - 请求上下文
 * @returns {Promise<Object>} 错误信息
 */
export async function handleApiResponseError(response, context = 'API Request') {
    let errorMessage = `请求失败 (${response.status})`;

    try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
    } catch (error) {
        if (isDev) {
            console.debug('[ErrorUtils] Failed to parse error response JSON:', error);
        }
    }

    return createApiError(new Error(errorMessage), context);
}

/**
 * 创建带有用户友好消息的Error对象
 * @param {string} message - 错误消息
 * @param {string} userMessage - 用户友好的消息
 * @returns {Error} 错误对象
 */
export function createUserError(message, userMessage) {
    const error = new Error(message);
    error.userMessage = userMessage || message;
    return error;
}

/**
 * 错误边界工具函数
 * @param {Function} fn - 要执行的函数
 * @param {string} context - 错误上下文
 * @returns {Promise<{success: boolean, data?: any, error?: Object}>} 执行结果
 */
export async function safeExecute(fn, context = 'Function Execution') {
    try {
        const data = await fn();
        return { success: true, data };
    } catch (error) {
        return { success: false, error: createApiError(error, context) };
    }
}
