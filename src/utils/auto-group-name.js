/**
 * 批量导入时的自动分组命名。
 *
 * 目标：用户粘贴/上传一批节点后无需手填分组，自动获得一个可读、可区分批次的名字。
 * 命名来源优先级：
 *   1. 文件名（上传文件时）—— 「导入 nodes」
 *   2. 时间戳 —— 「导入 09-15 18:30」
 *
 * 页面上会显示在分组选择框中，用户可随时改成别的。
 */

/** 两位补零 */
const pad = (n) => String(n).padStart(2, '0');

/**
 * 根据文件名生成分组名。
 * @param {string} fileName 例如「nodes.txt」「我的节点.json」
 * @returns {string} 例如「导入 nodes」
 */
export function groupNameFromFile(fileName) {
    const base = String(fileName || '')
        .replace(/\.[a-z0-9]+$/i, '')
        .trim();
    if (!base) return '';
    // 限制长度，避免超长文件名污染分组
    const clipped = base.length > 24 ? base.slice(0, 24) : base;
    return `导入 ${clipped}`;
}

/**
 * 生成基于时间的分组名（无文件名时使用）。
 * @param {Date} [now]
 * @returns {string} 例如「导入 09-15 18:30」
 */
export function groupNameFromTime(now = new Date()) {
    const date = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return `导入 ${date} ${time}`;
}

/**
 * 统一的自动分组名生成入口。
 * @param {Object} [options]
 * @param {string} [options.fileName] 有文件名时优先使用
 * @param {Date}   [options.now]
 * @returns {string}
 */
export function buildAutoGroupName({ fileName = '', now = new Date() } = {}) {
    return groupNameFromFile(fileName) || groupNameFromTime(now);
}
