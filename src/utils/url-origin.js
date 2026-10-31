/**
 * URL origin helpers used by browser-level error recovery.
 */

export function isSameOriginUrl(value, origin, baseUrl = origin) {
    if (!origin || value === undefined || value === null || value === '') return false;

    try {
        return new URL(String(value), baseUrl || origin).origin === origin;
    } catch {
        return false;
    }
}

export function isLocalHost(hostname) {
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(
        String(hostname || '')
            .trim()
            .toLowerCase()
    );
}

/**
 * 判断资源路径是否为「关键资产」。
 *
 * 只有打包产物里的 JS/CSS 失败才会影响应用运行，才值得「清缓存重载」与致命错误上报。
 * 图片、字体、manifest 等非关键资源失败不该弹提示：伪装开启时服务端会**有意**对未鉴权的
 * 品牌资源（/logo.png、/favicon.*）返回伪装页或 404，那属于正常现象而非故障
 * （见 functions/[[path]].js 的 isBrandAsset 分支）。
 */
const CRITICAL_ASSET_PATTERN = /\/assets\/.+\.(js|css)$/i;

export function isCriticalAssetPath(pathname) {
    return CRITICAL_ASSET_PATTERN.test(String(pathname || ''));
}
