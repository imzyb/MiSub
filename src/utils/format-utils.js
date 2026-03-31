/**
 * 格式化工具函数
 * @author MiSub Team
 */

/**
 * 格式化字节大小
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的字符串
 */
export { formatBytes } from '../shared/utils.js';

/**
 * 格式化日期时间
 * @param {Date|string|number} date - 日期
 * @param {string} format - 格式化类型 'date' | 'time' | 'datetime' | 'relative'
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date, format = 'datetime') {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '无效日期';

    const now = new Date();
    const diff = now - d;

    switch (format) {
        case 'date':
            return d.toLocaleDateString('zh-CN');
        case 'time':
            return d.toLocaleTimeString('zh-CN');
        case 'datetime':
            return d.toLocaleString('zh-CN');
        case 'relative':
            if (diff < 60000) return '刚刚';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
            if (diff < 2592000000) return `${Math.floor(diff / 86400000)}天前`;
            return d.toLocaleDateString('zh-CN');
        default:
            return d.toLocaleString('zh-CN');
    }
}

/**
 * 格式化数字为千分位
 * @param {number} num - 数字
 * @returns {string} 格式化后的字符串
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化百分比
 * @param {number} value - 数值
 * @param {number} total - 总数
 * @param {number} decimals - 小数位数
 * @returns {string} 百分比字符串
 */
export function formatPercentage(value, total, decimals = 1) {
    if (!total || total === 0) return '0%';
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(decimals)}%`;
}

/**
 * 格式化持续时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
export function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0秒';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}秒`);

    return parts.join(' ');
}

/**
 * 截断文本并添加省略号
 * @param {string} text - 文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
export function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * 格式化URL为显示格式
 * @param {string} url - URL
 * @param {number} maxLength - 最大长度
 * @returns {string} 格式化后的URL
 */
export function formatUrl(url, maxLength = 50) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        const display = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname !== '/' ? urlObj.pathname : ''}`;
        return truncateText(display, maxLength);
    } catch {
        return truncateText(url, maxLength);
    }
}
