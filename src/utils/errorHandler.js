/**
 * 全局错误处理工具类
 * @author MiSub Team
 */

import { t } from '../i18n/index.js';
import { isChunkLoadError } from './chunk-reload.js';
import { isNetworkErrorMessage } from './network-error.js';

let toastHandler = null;
let monitoringEndpoint = null;
let monitoringHeaders = null;

function resolveMonitoringEndpoint() {
    if (typeof window !== 'undefined' && window.__MISUB_ERROR_REPORT_URL__) {
        return window.__MISUB_ERROR_REPORT_URL__;
    }
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env.VITE_ERROR_REPORT_URL || null;
    }
    return null;
}

monitoringEndpoint = resolveMonitoringEndpoint();

export function setToastHandler(handler) {
    toastHandler = typeof handler === 'function' ? handler : null;
}

export function configureErrorMonitoring({ endpoint, headers } = {}) {
    if (endpoint !== undefined) {
        monitoringEndpoint = endpoint || null;
    }
    if (headers !== undefined) {
        monitoringHeaders = headers || null;
    }
}

class ErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.lastErrors = new Map();
        this.errorResetTime = 60000; // 1 分钟
    }

    /**
     * 处理并记录错误
     * @param {Error} error - 错误对象
     * @param {string} context - 错误上下文
     * @param {Object} additionalData - 附加数据
     */
    handleError(error, context = '', additionalData = {}) {
        const errorKey = this.getErrorKey(error, context);

        // 更新错误计数
        this.updateErrorCount(errorKey);

        // 构建错误信息
        const errorInfo = {
            timestamp: new Date().toISOString(),
            message: error.message || '未知错误',
            stack: error.stack,
            context,
            additionalData,
            count: this.errorCounts.get(errorKey),
            key: errorKey,
        };

        // 记录错误
        console.error(`[${context || 'Global Error'}] ${error.message}`, {
            ...errorInfo,
            stack: error.stack,
        });

        // 保存最近的错误
        this.lastErrors.set(errorKey, {
            ...errorInfo,
            timestamp: Date.now(),
        });

        // 清理过期的错误记录
        this.cleanupOldErrors();

        // 根据错误频率决定是否显示用户通知
        if (this.shouldShowUserNotification(errorKey)) {
            this.showUserNotification(errorInfo);
        }

        // 在生产环境中发送到错误监控服务
        if (!import.meta.env.DEV && this.shouldSendToMonitoring(errorInfo)) {
            this.sendToMonitoringService(errorInfo);
        }

        return errorInfo;
    }

    /**
     * 生成错误的唯一键
     * @param {Error} error - 错误对象
     * @param {string} context - 上下文
     * @returns {string} 错误键
     */
    getErrorKey(error, context) {
        const message = error.message || '未知错误';
        const stack = error.stack?.split('\n')[0] || '';
        return `${context}:${message}:${stack}`.substring(0, 100);
    }

    /**
     * 更新错误计数
     * @param {string} errorKey - 错误键
     */
    updateErrorCount(errorKey) {
        const current = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, current + 1);
    }

    /**
     * 清理过期的错误记录
     */
    cleanupOldErrors() {
        const now = Date.now();
        for (const [key, error] of this.lastErrors.entries()) {
            if (now - error.timestamp > this.errorResetTime) {
                this.errorCounts.delete(key);
                this.lastErrors.delete(key);
            }
        }
    }

    /**
     * 判断是否应该显示用户通知
     * @param {string} errorKey - 错误键
     * @returns {boolean} 是否显示通知
     */
    shouldShowUserNotification(errorKey) {
        const count = this.errorCounts.get(errorKey) || 0;

        // 第一次错误或错误次数是 5 的倍数时显示
        return count === 1 || count % 5 === 0;
    }

    /**
     * 判断是否应该发送到监控服务
     * @param {Object} errorInfo - 错误信息
     * @returns {boolean} 是否发送
     */
    shouldSendToMonitoring(errorInfo) {
        // 仅发送关键错误或高频错误
        return (
            errorInfo.count >= 3 ||
            errorInfo.context?.includes('critical') ||
            errorInfo.message?.includes('network')
        );
    }

    /**
     * 显示用户通知
     * @param {Object} errorInfo - 错误信息
     */
    showUserNotification(errorInfo) {
        const handler = toastHandler || (typeof window !== 'undefined' ? window.showToast : null);
        if (!handler) return;

        let message = this.getUserFriendlyMessage(errorInfo);

        if (errorInfo.count > 1) {
            message += ` (已发生${errorInfo.count}次)`;
        }

        handler(message, 'error', 5000);
    }

    /**
     * 获取用户友好的错误消息
     *
     * 文案统一走 i18n（`errors.*`）：这个函数是全局兜底提示的出口，
     * 原先硬编码中文会让英文界面下的所有错误提示都变成中文。
     * @param {Object} errorInfo - 错误信息
     * @returns {string} 用户友好的消息
     */
    getUserFriendlyMessage(errorInfo) {
        const { message, context } = errorInfo;

        if (message.includes('timeout')) {
            return t('errors.timeout');
        }
        if (message.includes('Resource load failed')) {
            const failedSrc = errorInfo.additionalData?.src || '';
            const fileName = failedSrc.split('/').pop() || 'unknown';
            if (typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent)) {
                return t('errors.resourceLoadIntercepted', { fileName });
            }
            // 走到这里说明自动清缓存重载已经试过一次且仍然失败，
            // 所以提示「强制刷新」而不是普通刷新（普通刷新会命中同一份缓存）。
            return t('errors.resourceLoad', { fileName });
        }
        // 必须排在 network 判断之前：动态 chunk 加载失败的消息里含 "fetch"
        // （Failed to fetch dynamically imported module），会被下面的 network 分支
        // 误判成网络问题，让用户去检查网络 —— 而真实原因是发版后旧页面请求了
        // 已删除的资源，检查网络永远解决不了。判定复用 chunk-reload 的谓词，
        // 避免两处模式匹配漂移。
        if (isChunkLoadError(message)) {
            return t('errors.chunkLoadFailed');
        }
        if (isNetworkErrorMessage(message)) {
            return t('errors.network');
        }
        if (message.includes('Unauthorized') || message.includes('401')) {
            return t('errors.unauthorized');
        }
        // ⚠️ 下面两条匹配的是**服务端返回的消息文本**（functions/ 里产生的中文），
        // 不是界面文案，所以不能用 t() 改写，也不能本地化。
        // 这是一条隐式跨端契约，用正则容忍语序/虚词差异，别退化成 includes 精确子串：
        //   - 服务端既会说「请先恢复 KV 绑定」，也会说「KV 未绑定」，
        //     多一个「未」字就让 includes('KV 绑定') 整个失效；
        //   - 服务端 D1 适配器抛的是英文 'D1 database not available'。
        // tests/unit/error-handler-server-contract.test.js 会扫描 functions/ 钉住这条契约。
        if (/MISUB_KV|KV\s*(?:未)?绑定/.test(message)) {
            return t('errors.kvMissing');
        }
        if (/MISUB_DB|D1\s*(?:未)?绑定|D1 database not available/i.test(message)) {
            return t('errors.d1Missing');
        }
        // 这两种语言的措辞都要认：message 既可能来自服务端（中文），
        // 也可能是客户端 `throw new Error(t('store.saveFailed'))` 抛出的本地化文案。
        // 只认中文的话，英文界面下这条分支永远不命中，用户看到的是通用提示 ——
        // 分类随界面语言漂移。tests/unit/error-message-i18n-collision.test.js
        // 会断言同一个 key 的中英版本落在同一分支。
        if (/storage|保存失败|save failed/i.test(message)) {
            return t('errors.saveFailed');
        }
        if (context?.includes('subscription')) {
            return t('errors.subscriptionFailed');
        }
        if (context?.includes('batch')) {
            return t('errors.batchFailed');
        }

        return t('errors.generic');
    }

    /**
     * 发送错误到监控服务
     * @param {Object} errorInfo - 错误信息
     */
    async sendToMonitoringService(errorInfo) {
        try {
            const endpoint = monitoringEndpoint || resolveMonitoringEndpoint();
            if (!endpoint) return;

            const payload = {
                ...errorInfo,
                url: typeof window !== 'undefined' ? window.location.href : '',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
                timestamp: errorInfo.timestamp || new Date().toISOString(),
            };
            const body = JSON.stringify(payload);

            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                const blob = new Blob([body], { type: 'application/json' });
                navigator.sendBeacon(endpoint, blob);
                return;
            }

            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(monitoringHeaders || {}) },
                body,
                keepalive: true,
            });
        } catch (e) {
            // 监控服务失败，避免无限递归
            console.warn('[Error Monitoring Failed]', e);
        }
    }

    /**
     * 获取错误统计信息
     * @returns {Object} 错误统计
     */
    getErrorStats() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce(
                (sum, count) => sum + count,
                0
            ),
            uniqueErrors: this.errorCounts.size,
            recentErrors: Array.from(this.lastErrors.values()),
        };
    }

    /**
     * 重置错误统计
     */
    reset() {
        this.errorCounts.clear();
        this.lastErrors.clear();
    }
}

const globalErrorHandler = new ErrorHandler();

export { ErrorHandler, globalErrorHandler };

export const handleError = (error, context, data) => {
    return globalErrorHandler.handleError(error, context, data);
};

export const getErrorStats = () => {
    return globalErrorHandler.getErrorStats();
};

if (typeof window !== 'undefined') {
    window.errorHandler = globalErrorHandler;
}
