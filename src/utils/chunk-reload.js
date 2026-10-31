/**
 * 动态 chunk 加载失败后的「重载一次」恢复逻辑。
 *
 * 发版后旧页面会去请求已被删除的 chunk（`Failed to fetch dynamically imported
 * module`），表现为白屏。main.js（unhandledrejection）与 router/index.js
 * （router.onError）都要处理这个场景，两边逻辑原本是逐字重复的，收敛到这里。
 *
 * 关键约束：**在没有成功写下标记时，绝不能返回 true。**
 * 浏览器禁用站点数据（隐私模式 / 站点权限里关掉「Cookie 与站点数据」）时，
 * sessionStorage 读写会抛 SecurityError，此时无法记录「已经重载过」。
 * 如果仍然放行重载，页面会陷入
 * 「加载失败 → 重载 → 仍然失败 → 再重载」的无限刷新循环，
 * 用户既看不到内容也停不下来 —— 比不自动恢复严重得多。
 */

const RELOAD_KEY = 'misub:chunk-reload';

const CHUNK_ERROR_PATTERNS = [
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
];

/** 是否为「动态导入的 chunk 拿不到」这一类错误 */
export function isChunkLoadError(message) {
    const text = String(message || '');
    return CHUNK_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
}

/**
 * 是否应当执行重载。
 *
 * 返回 true 时**标记已经写过**，调用方直接 reload 即可，不必再自己记账。
 * 本次会话内只会返回一次 true（后续同会话的 chunk 错误不再重载，避免循环）。
 */
export function shouldReloadForChunkError() {
    try {
        if (sessionStorage.getItem(RELOAD_KEY) === '1') return false;
        sessionStorage.setItem(RELOAD_KEY, '1');
        return true;
    } catch (error) {
        console.warn('[Chunk Reload] sessionStorage unavailable, skip auto reload:', error);
        return false;
    }
}
