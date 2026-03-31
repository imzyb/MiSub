/**
 * 加载状态管理工具
 * @author MiSub Team
 */

import { ref } from 'vue';
import { TIMING } from '../constants/timing.js';

/**
 * 创建可复用的加载状态
 * @returns {Object} 加载状态对象
 */
export function createLoadingState() {
    const isLoading = ref(false);
    const loadingMessage = ref('');
    const error = ref(null);
    const lastUpdated = ref(null);

    /**
     * 开始加载
     * @param {string} message - 加载消息
     */
    const startLoading = (message = '加载中...') => {
        isLoading.value = true;
        loadingMessage.value = message;
        error.value = null;
    };

    /**
     * 停止加载
     * @param {boolean} success - 是否成功
     * @param {string} errorMessage - 错误消息
     */
    const stopLoading = (success = true, errorMessage = null) => {
        isLoading.value = false;
        loadingMessage.value = '';
        if (!success) {
            error.value = errorMessage || '操作失败';
        }
        lastUpdated.value = new Date();
    };

    /**
     * 设置错误
     * @param {string} errorMessage - 错误消息
     */
    const setError = (errorMessage) => {
        error.value = errorMessage;
        isLoading.value = false;
        loadingMessage.value = '';
    };

    /**
     * 清除错误
     */
    const clearError = () => {
        error.value = null;
    };

    /**
     * 重置所有状态
     */
    const reset = () => {
        isLoading.value = false;
        loadingMessage.value = '';
        error.value = null;
        lastUpdated.value = null;
    };

    return {
        isLoading,
        loadingMessage,
        error,
        lastUpdated,
        startLoading,
        stopLoading,
        setError,
        clearError,
        reset
    };
}

/**
 * 创建带超时的加载状态
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Object} 加载状态对象
 */
export function createTimeoutLoadingState(timeout = TIMING.REQUEST_TIMEOUT_MS) {
    const loadingState = createLoadingState();
    let timeoutId = null;

    const startLoading = (message = '加载中...') => {
        loadingState.startLoading(message);

        // 设置超时
        timeoutId = setTimeout(() => {
            loadingState.setError('操作超时，请重试');
        }, timeout);
    };

    const stopLoading = (success = true, errorMessage = null) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        loadingState.stopLoading(success, errorMessage);
    };

    return {
        ...loadingState,
        startLoading,
        stopLoading
    };
}
