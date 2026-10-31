/**
 * 机场命名记忆（按域名）
 *
 * 订阅响应头 / 官网标题并不总能给出机场名，而人工判断最准。
 * 因此把用户手动确认过的「域名 -> 名称」记在本地，后续同域名的订阅
 * 可直接沿用，无需再次识别。这是「用自己的数据当名单」的做法。
 *
 * 存储位置：localStorage（纯前端偏好，不进入后端数据，不影响导出/备份）。
 * 读写与失败判定统一走 `local-preference.js`。
 */

import { readPreference, removePreference, writePreference } from './local-preference.js';

const STORAGE_KEY = 'misub:domainNameMemory';
const MAX_ENTRIES = 500;

/** 校验载荷：必须是「域名 -> 名称」的普通对象 */
function normalizeMemory(parsed) {
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

/** 读取全部记忆（容错：损坏时返回空对象） */
function readAll() {
    return readPreference(STORAGE_KEY, normalizeMemory, {});
}

/**
 * 写入全部记忆。
 * @returns {boolean} 是否真正落盘
 */
function writeAll(map) {
    // 控制体积：超出上限时丢弃最早写入的条目
    const entries = Object.entries(map);
    const trimmed =
        entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : map;
    return writePreference(STORAGE_KEY, trimmed);
}

/**
 * 记忆某个域名的机场名。
 * @param {string} domain 机场主域名（小写）
 * @param {string} name 用户确认的名称
 * @returns {boolean} true = 已记住（或本就无需记忆）；false = 需要写入但写入失败
 */
export function rememberDomainName(domain, name) {
    const key = String(domain || '')
        .trim()
        .toLowerCase();
    const value = String(name || '').trim();
    if (!key || !value) return true;
    const map = readAll();
    map[key] = value;
    return writeAll(map);
}

/**
 * 查询某域名记住的名称。
 * @param {string} domain
 * @returns {string} 未记录时返回空字符串
 */
export function lookupDomainName(domain) {
    const key = String(domain || '')
        .trim()
        .toLowerCase();
    if (!key) return '';
    const map = readAll();
    const hit = map[key];
    return typeof hit === 'string' ? hit.trim() : '';
}

/**
 * 清空全部记忆。
 * @returns {boolean} 是否清除成功
 */
export function clearDomainNameMemory() {
    return removePreference(STORAGE_KEY);
}

export const DOMAIN_NAME_MEMORY_KEY = STORAGE_KEY;
