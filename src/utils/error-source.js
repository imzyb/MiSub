/**
 * 全局错误来源判定。
 *
 * window 上的 error / unhandledrejection 事件会把**非本站**脚本的错误一并抛出：
 * 浏览器扩展注入的脚本（chrome-extension://…、content_main.js）、用户脚本、
 * 跨域第三方脚本，以及被浏览器因安全策略抹平为 "Script error." 的跨域错误。
 *
 * 这些错误此前都会被 handleError 当作应用故障上报，并以
 * 「操作失败，请稍后重试」的错误提示弹给用户 —— 与 MiSub 完全无关的噪音。
 * 这里集中判定来源，供 main.js 的全局监听器过滤。
 */

const EXTENSION_PROTOCOL = /^(chrome|moz|safari-web|safari)-extension:\/\//i;
/** 注入/匿名脚本：eval 产生的 VMxxx、about:blank、blob:、data: */
const INJECTED_SCRIPT = /^(VM\d+|about:|blob:|data:|eval)/i;
/** 栈中出现的扩展脚本 */
const EXTENSION_IN_STACK = /[a-z-]*extension:\/\//i;
/** 栈中出现的注入脚本位置，如 "(VM144:2:19429)" */
const INJECTED_IN_STACK = /(?:^|[\s(@])VM\d+(?::[\d:]+)?/m;
const URL_IN_STACK = /https?:\/\/[^\s)]+/g;
/** 浏览器抹平后的跨域错误消息 */
const OPAQUE_ERROR_MESSAGE = 'Script error.';

function resolveOrigin(origin) {
    if (origin) return origin;
    if (typeof window !== 'undefined' && window.location) return window.location.origin;
    return null;
}

function safeOrigin(url, fallbackOrigin) {
    try {
        return new URL(url, fallbackOrigin).origin;
    } catch (error) {
        return null;
    }
}

/**
 * 判断 window error 事件是否来自本站脚本。
 * @param {{filename?: string, message?: string}} info
 * @param {string} [origin] 本站 origin（默认取 window.location.origin）
 * @returns {boolean} true 表示应当作为应用错误处理
 */
export function isAppScriptError(info = {}, origin) {
    const base = resolveOrigin(origin);
    const filename = String(info.filename || '').trim();

    if (!filename) {
        // 无 filename：跨域脚本错误会被浏览器抹平为 "Script error."，属第三方噪音；
        // 其他情况可能是本站行内脚本，保守保留。
        return String(info.message || '').trim() !== OPAQUE_ERROR_MESSAGE;
    }

    if (EXTENSION_PROTOCOL.test(filename) || INJECTED_SCRIPT.test(filename)) {
        return false;
    }

    const scriptOrigin = safeOrigin(filename, base);
    if (!scriptOrigin || !base) return false;

    return scriptOrigin === base;
}

/**
 * 判断 Promise 拒绝是否来自本站代码。
 * @param {Error|*} reason 拒绝原因
 * @param {string} [origin] 本站 origin（默认取 window.location.origin）
 * @returns {boolean} true 表示属于第三方/扩展噪音，应当忽略
 */
export function isForeignRejection(reason, origin) {
    if (!reason) return false;

    const base = resolveOrigin(origin);
    const message = String(reason.message || '').trim();
    if (message === OPAQUE_ERROR_MESSAGE) return true;

    const stack = String(reason.stack || '');
    // 缺少栈信息时无法判断来源，保守上报
    if (!stack) return false;

    if (EXTENSION_IN_STACK.test(stack) || INJECTED_IN_STACK.test(stack)) return true;

    const urls = stack.match(URL_IN_STACK);
    if (!urls || !urls.length) return false;

    // 栈中出现的所有脚本位置都不属于本站 → 第三方噪音
    return urls.every((url) => safeOrigin(url, base) !== base);
}
