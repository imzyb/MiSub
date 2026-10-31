/**
 * 首页「待处理事项」的忽略列表 —— 纯函数层。
 *
 * 有些待处理项在当前阶段并不打算处理（例如暂时不想固定主 Token），
 * 但健康检查每次都会重新推导出来，用户无法把它从列表里去掉。
 * 这里提供对「已忽略 id 数组」的纯操作，让视图可以主动收起不关心的项。
 *
 * ⚠️ 这个模块**不再自己读写任何存储**。
 *
 * 忽略列表原先只存在 localStorage，换设备/换浏览器就丢，用户反复忽略同一个项。
 * 现在它作为 `settings.dismissedHealthItems` 随设置同步到服务端，跨设备生效。
 * 所以存储与同步的职责交给调用方（`DashboardView` → `useDataStore.saveSettings`），
 * 这里只负责「数组怎么算」——纯函数才好单测，也不会和 Pinia / 存储耦合。
 *
 * 本文件底部保留两个一次性迁移 helper：老用户浏览器里已经存在的忽略记录，
 * 首次打开时并入设置，避免升级后已忽略的项全部复活。
 */

import { readPreference, removePreference } from './local-preference.js';

/** 历史上存放忽略列表的 localStorage key（仅用于一次性迁移） */
export const LEGACY_DISMISSED_HEALTH_ITEMS_KEY = 'misub:dismissedHealthItems';

/** 上限，防止异常数据把设置对象撑大 */
export const MAX_DISMISSED_HEALTH_ITEMS = 100;

/** 单个 id 规范化：非字符串或空白一律视为无效 */
function normalizeId(id) {
    if (typeof id !== 'string') return '';
    return id.trim();
}

/**
 * 校验并规范化一份「已忽略 id 列表」。
 *
 * 输入可能来自设置接口（用户手改、旧版本写坏、被其它工具污染），
 * 所以必须逐项过滤：非数组退化为空列表，非字符串/空串丢弃，重复项去重。
 * @param {unknown} value
 * @returns {string[]} 规范化后的新数组
 */
export function normalizeDismissedHealthItemIds(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const result = [];
    for (const entry of value) {
        const id = normalizeId(entry);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        result.push(id);
    }
    return result;
}

/**
 * 某个待处理项是否已被忽略。
 * @param {string[]} ids 已忽略的 id 列表
 * @param {string} id
 */
export function isHealthItemDismissed(ids, id) {
    const key = normalizeId(id);
    if (!key) return false;
    return normalizeDismissedHealthItemIds(ids).includes(key);
}

/**
 * 追加一个忽略项。
 *
 * 超出上限时丢弃最早写入的条目（保持与历史行为一致）。
 * @param {string[]} ids
 * @param {string} id
 * @returns {string[]} 规范化后的新数组（无变化时是内容等价的新数组，
 *          调用方若要判断「有没有真的变化」，用 isHealthItemDismissed 先判）
 */
export function addDismissedHealthItem(ids, id) {
    const current = normalizeDismissedHealthItemIds(ids);
    const key = normalizeId(id);
    if (!key || current.includes(key)) return current;
    return [...current, key].slice(-MAX_DISMISSED_HEALTH_ITEMS);
}

/**
 * 过滤掉已被忽略的条目。
 * @param {Array<{id: string}>} items
 * @param {string[]} ids 已忽略的 id 列表
 * @returns {Array} 保留的条目
 */
export function filterDismissedHealthItems(items, ids) {
    if (!Array.isArray(items)) return [];
    const dismissed = new Set(normalizeDismissedHealthItemIds(ids));
    return items.filter((item) => !dismissed.has(item?.id));
}

/**
 * 读取旧版留在 localStorage 里的忽略列表（一次性迁移用）。
 *
 * 迁移完成后必须调用 `clearLegacyDismissedHealthItemIds()`，
 * 否则每次启动都会把它重新并入设置 —— 用户在新设备上「全部恢复」后
 * 回到旧设备，旧记录又会被塞回去。
 * @returns {string[]}
 */
export function readLegacyDismissedHealthItemIds() {
    return readPreference(LEGACY_DISMISSED_HEALTH_ITEMS_KEY, normalizeDismissedHealthItemIds, []);
}

/**
 * 清除旧版 localStorage 记录。
 * @returns {boolean} 是否清除成功（存储被禁用时为 false）
 */
export function clearLegacyDismissedHealthItemIds() {
    return removePreference(LEGACY_DISMISSED_HEALTH_ITEMS_KEY);
}
