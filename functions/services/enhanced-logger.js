/**
 * 增强的错误处理和日志服务
 * 借鉴miaomiaowu的详细日志记录
 */

class EnhancedLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.logLevels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        };
        this.currentLevel = process.env.LOG_LEVEL ? this.logLevels[process.env.LOG_LEVEL.toUpperCase()] : this.logLevels.INFO;
    }

    /**
     * 记录调试日志
     */
    debug(message, ...args) {
        this.log('DEBUG', message, ...args);
    }

    /**
     * 记录信息日志
     */
    info(message, ...args) {
        this.log('INFO', message, ...args);
    }

    /**
     * 记录警告日志
     */
    warn(message, ...args) {
        this.log('WARN', message, ...args);
    }

    /**
     * 记录错误日志
     */
    error(message, ...args) {
        this.log('ERROR', message, ...args);
    }

    /**
     * 核心日志记录方法
     */
    log(level, message, ...args) {
        if (this.logLevels[level] < this.currentLevel) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message: typeof message === 'string' ? message : JSON.stringify(message),
            args: args.length > 0 ? args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ) : undefined
        };

        // 添加到内存日志
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // 控制台输出
        const consoleMethod = level === 'ERROR' ? 'error' :
                             level === 'WARN' ? 'warn' :
                             level === 'DEBUG' ? 'debug' : 'log';

        console[consoleMethod](`[${timestamp}] ${level}: ${logEntry.message}`,
            ...(logEntry.args || []));
    }

    /**
     * 记录HTTP请求详情
     */
    logHttpRequest(url, method = 'GET', status = null, duration = null, error = null) {
        const logData = {
            url: url.length > 100 ? url.substring(0, 100) + '...' : url,
            method,
            status,
            duration: duration ? `${duration}ms` : null,
            error: error ? error.message : null
        };

        if (error) {
            this.error('HTTP请求失败', logData);
        } else if (status >= 400) {
            this.warn('HTTP请求异常', logData);
        } else {
            this.debug('HTTP请求成功', logData);
        }
    }

    /**
     * 记录订阅处理详情
     */
    logSubscriptionProcess(subscriptionName, url, nodeCount, duration, error = null) {
        const logData = {
            subscription: subscriptionName,
            url: url.length > 50 ? url.substring(0, 50) + '...' : url,
            nodeCount,
            duration: `${duration}ms`,
            error: error ? error.message : null
        };

        if (error) {
            this.error('订阅处理失败', logData);
        } else {
            this.info('订阅处理成功', logData);
        }
    }

    /**
     * 获取最近的日志
     * @param {number} limit - 返回的日志数量
     * @param {string} level - 过滤的日志级别
     * @returns {Array}
     */
    getRecentLogs(limit = 100, level = null) {
        let filteredLogs = this.logs;

        if (level) {
            filteredLogs = this.logs.filter(log => log.level === level.toUpperCase());
        }

        return filteredLogs.slice(-limit);
    }

    /**
     * 导出日志
     * @returns {string}
     */
    exportLogs() {
        return this.logs.map(log =>
            `[${log.timestamp}] ${log.level}: ${log.message}${log.args ? ' ' + log.args.join(' ') : ''}`
        ).join('\n');
    }

    /**
     * 清理日志
     */
    clearLogs() {
        this.logs = [];
    }
}

export const enhancedLogger = new EnhancedLogger();