/**
 * 全局错误处理工具类
 * @author MiSub Team
 */

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
      key: errorKey
    };

    // 记录错误
    console.error(`[${context || 'Global Error'}] ${error.message}`, {
      ...errorInfo,
      stack: error.stack
    });

    // 保存最近的错误
    this.lastErrors.set(errorKey, {
      ...errorInfo,
      timestamp: Date.now()
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
    return errorInfo.count >= 3 ||
      errorInfo.context?.includes('critical') ||
      errorInfo.message?.includes('network');
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
   * @param {Object} errorInfo - 错误信息
   * @returns {string} 用户友好的消息
   */
  getUserFriendlyMessage(errorInfo) {
    const { message, context } = errorInfo;

    if (message.includes('timeout')) {
      return '请求超时，请稍后重试';
    }
    if (message.includes('Resource load failed')) {
      const failedSrc = errorInfo.additionalData?.src || '';
      const fileName = failedSrc.split('/').pop() || 'unknown';
      if (typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent)) {
        return `资源加载失败 (${fileName})。可能是浏览器隐私设置或扩展拦截了部分资源。`;
      }
      return `资源加载失败 (${fileName})，请尝试刷新页面`;
    }
    if (message.includes('network') || message.includes('fetch')) {
      return '网络连接失败，请检查网络';
    }
    if (message.includes('Unauthorized') || message.includes('401')) {
      return '认证失败，请重新登录';
    }
    if (message.includes('MISUB_KV') || message.includes('KV 绑定')) {
      return '服务端存储未初始化，请联系管理员配置 KV 绑定';
    }
    if (message.includes('MISUB_DB') || message.includes('D1 绑定')) {
      return '服务端数据库未初始化，请联系管理员配置 D1 绑定';
    }
    if (message.includes('storage') || message.includes('保存失败')) {
      return '数据保存失败，请稍后重试';
    }
    if (context?.includes('subscription')) {
      return '订阅更新失败，请稍后重试';
    }
    if (context?.includes('batch')) {
      return '批量操作失败，已降级为逐个处理';
    }

    return '操作失败，请稍后重试';
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
        timestamp: errorInfo.timestamp || new Date().toISOString()
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
        keepalive: true
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
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      uniqueErrors: this.errorCounts.size,
      recentErrors: Array.from(this.lastErrors.values())
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
