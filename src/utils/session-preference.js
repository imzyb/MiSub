/**
 * 会话级偏好（sessionStorage）的统一读写入口。
 *
 * 与 local-preference.js 同一套路，只是作用域换成「当前标签页」：
 * - 浏览器禁用站点数据时，**访问 sessionStorage 本身**就会抛 SecurityError
 * - 写入后回读校验，识别「不抛错也不落盘」的静默丢失
 *
 * 注意：需要「读取 → 判断 → 写入」原子语义的场景**不能**基于本模块拼装，
 * 必须在一个 try 里完成，否则中间态会漏出去。见 chunk-reload.js。
 */

/** sessionStorage 是否可用（禁用站点数据时光是访问它就可能抛错） */
export function canUseSessionStorage() {
    try {
        return typeof sessionStorage !== 'undefined' && sessionStorage !== null;
    } catch {
        return false;
    }
}

/** 读取裸字符串；不存在或不可用时返回 null */
export function readSessionPreference(key) {
    try {
        if (!canUseSessionStorage()) return null;
        return sessionStorage.getItem(key);
    } catch (error) {
        console.warn(`[SessionPreference] Failed to read "${key}":`, error);
        return null;
    }
}

/** 写入裸字符串；返回是否真正落盘（已回读校验） */
export function writeSessionPreference(key, value) {
    try {
        if (!canUseSessionStorage()) return false;
        const serialized = String(value);
        sessionStorage.setItem(key, serialized);
        return sessionStorage.getItem(key) === serialized;
    } catch (error) {
        console.warn(`[SessionPreference] Failed to write "${key}":`, error);
        return false;
    }
}

/** 删除；返回 key 是否确实消失 */
export function removeSessionPreference(key) {
    try {
        if (!canUseSessionStorage()) return false;
        sessionStorage.removeItem(key);
        return sessionStorage.getItem(key) === null;
    } catch (error) {
        console.warn(`[SessionPreference] Failed to remove "${key}":`, error);
        return false;
    }
}
