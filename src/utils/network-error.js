import { isChunkLoadError } from './chunk-reload.js';

/**
 * 判断一条错误消息是否代表「网络不可用」。
 *
 * ⚠️ 这里刻意**不匹配中文文案**。错误消息是上游抛出的**数据**，不是界面文案：
 * 之前 NodePreviewModal.vue 与 useNodePreview.js 都用 `err.message.includes('网络')`
 * 判定，但整个代码库没有任何地方抛出含「网络」二字的错误 ——
 * 那个分支永远不会命中，网络失败时用户看到的是原始的 "Failed to fetch"。
 * 更糟的是，一旦有人真把那条消息本地化，判定就会随界面语言漂移：
 * 中文环境能命中、英文环境命中不了。这和之前「拿翻译文案当筛选哨兵」是同一类缺陷。
 *
 * 所以判定依据只认各家浏览器/运行时实际抛出的措辞，并统一收在这里，
 * 避免多处模式匹配各自漂移。
 */
const NETWORK_ERROR_PATTERNS = [
    'failed to fetch', // Chrome / Edge：fetch 网络层失败
    'fetch failed', // Node 18+ undici
    'networkerror', // Firefox：NetworkError when attempting to fetch resource.
    'network request failed',
    'load failed', // Safari：fetch 失败只说 Load failed
    'net::err_', // Chromium 网络层错误码，如 net::ERR_INTERNET_DISCONNECTED
    'err_internet_disconnected',
    'err_network_changed',
    'err_name_not_resolved',
    'err_connection_refused',
    'econnrefused',
    'etimedout',
    // 兜底保留历史行为：errorHandler 原先就认裸 'network'（例如 "network down"）
    'network',
];

/**
 * @param {unknown} message 错误消息（或任意可字符串化的值）
 * @returns {boolean} 是否属于网络类失败
 */
export function isNetworkErrorMessage(message) {
    const text = String(message ?? '').toLowerCase();
    if (!text) return false;

    // 必须排除：动态 chunk 加载失败的消息里含 "fetch"
    //（Failed to fetch dynamically imported module），但那是发版后旧页面请求了
    // 已删除的资源，让用户去检查网络永远解决不了。
    if (isChunkLoadError(message)) return false;

    return NETWORK_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
}
