/**
 * 本机偏好（localStorage）的统一读写入口。
 *
 * 只用「纯本机偏好」：不进后端数据、不影响导出/备份。
 *
 * 为什么不让调用方直接用裸 localStorage —— 两个坑都在这里统一处理：
 *
 * 1. **写入后必须回读校验**。Safari 无痕模式与部分隐私扩展下 `setItem` 不抛错却也不落盘，
 *    只判断「有没有抛异常」会把静默丢失当成成功，表现为「刷新后设置就没了」。
 * 2. **写操作返回布尔值**。调用方才能在失败时提示用户 ——
 *    「点了没反应」是这类缺陷里最难排查的表现。
 */

/** localStorage 是否可用（隐私模式下光是访问它就可能抛错） */
export function canUseLocalStorage() {
    try {
        return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch {
        return false;
    }
}

/**
 * 读取并 JSON 解析一个偏好值。
 * @param {string} key 存储键
 * @param {(value: unknown) => unknown} validate 校验并归一化；返回 undefined 视为不合法
 * @param {unknown} fallback 不存在 / 损坏 / 不合法时的返回值
 */
export function readPreference(key, validate, fallback) {
    try {
        if (!canUseLocalStorage()) return fallback;
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const normalized = validate(JSON.parse(raw));
        return normalized === undefined ? fallback : normalized;
    } catch (error) {
        console.warn(`[LocalPreference] Failed to read "${key}":`, error);
        return fallback;
    }
}

/**
 * 写入偏好（JSON 序列化）并回读校验。
 * @returns {boolean} 是否真正落盘
 */
export function writePreference(key, value) {
    try {
        if (!canUseLocalStorage()) return false;
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        return localStorage.getItem(key) === serialized;
    } catch (error) {
        console.warn(`[LocalPreference] Failed to write "${key}":`, error);
        return false;
    }
}

/**
 * 写入原始字符串偏好（不做 JSON 序列化）。
 * 用于历史遗留的裸字符串键（如 `'true'` 标记），避免改变已存数据的格式。
 * @returns {boolean} 是否真正落盘
 */
export function writeRawPreference(key, value) {
    try {
        if (!canUseLocalStorage()) return false;
        const serialized = String(value);
        localStorage.setItem(key, serialized);
        return localStorage.getItem(key) === serialized;
    } catch (error) {
        console.warn(`[LocalPreference] Failed to write "${key}":`, error);
        return false;
    }
}

/**
 * 读取原始字符串偏好。
 * @returns {string|null}
 */
export function readRawPreference(key) {
    try {
        if (!canUseLocalStorage()) return null;
        return localStorage.getItem(key);
    } catch (error) {
        console.warn(`[LocalPreference] Failed to read "${key}":`, error);
        return null;
    }
}

/**
 * 删除偏好并回读校验。
 * @returns {boolean} key 是否确实已不存在
 */
export function removePreference(key) {
    try {
        if (!canUseLocalStorage()) return false;
        localStorage.removeItem(key);
        return localStorage.getItem(key) === null;
    } catch (error) {
        console.warn(`[LocalPreference] Failed to remove "${key}":`, error);
        return false;
    }
}
