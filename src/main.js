import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './assets/main.css';
import App from './App.vue';
import router from './router';
import { handleError, setToastHandler, configureErrorMonitoring } from './utils/errorHandler.js';
import { isAppScriptError, isForeignRejection } from './utils/error-source.js';
import { i18n } from './i18n/index.js';
import { useToastStore } from './stores/toast.js';
import { configureUnauthorizedHandler } from './lib/http.js';
import { isCriticalAssetPath, isLocalHost, isSameOriginUrl } from './utils/url-origin.js';
import { isChunkLoadError, shouldReloadForChunkError } from './utils/chunk-reload.js';
import { readSessionPreference, writeSessionPreference } from './utils/session-preference.js';

// 全局错误处理
if (typeof window !== 'undefined') {
    console.debug('[MiSub] Error Handler Loaded (v2026-01-11-fix-link-error)');
    // 处理未捕获的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
        const message = event.reason?.message || '';
        // 发版后旧页面拿不到已删除的 chunk：重载一次（见 utils/chunk-reload.js）。
        // 注意不要在这里 return —— 本次会话已经重载过时不会再次重载，
        // 此时需要继续往下走到 handleError，让用户知道加载失败了。
        if (isChunkLoadError(message) && shouldReloadForChunkError()) {
            window.location.reload();
        }
        // 浏览器扩展注入脚本 / 跨域第三方脚本导致的拒绝与自己无关（如扩展的
        // reportAllChanges TypeError）。静默丢弃：preventDefault 同时抑制
        // 浏览器默认的控制台报错输出，避免与 MiSub 无关的噪音。
        if (isForeignRejection(event.reason)) {
            event.preventDefault();
            return;
        }
        handleError(event.reason, 'Unhandled Promise Rejection', {
            type: 'promise_rejection',
        });
        event.preventDefault();
    });

    // 处理全局JavaScript错误
    window.addEventListener('error', (event) => {
        if (event.target && event.target !== window) {
            return;
        }
        if (!isAppScriptError({ filename: event.filename, message: event.message })) {
            // 非本站脚本（扩展、跨域第三方、被抹平的 Script error.）不算应用故障
            event.preventDefault();
            return;
        }
        handleError(event.error || new Error(event.message), 'Global JavaScript Error', {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            tagName: event.target?.tagName,
        });
    });

    // 处理资源加载错误（忽略第三方资源）
    const assetReloadKey = 'misub:asset-reload';
    const currentOrigin = window.location.origin;
    const localHost = isLocalHost(window.location.hostname);
    const isSameOriginResource = (resourceUrl) =>
        isSameOriginUrl(resourceUrl, currentOrigin, window.location.href);
    // 只有打包产物里的 JS/CSS 失败才值得「清缓存重载」与错误上报，
    // 判定逻辑见 utils/url-origin.js 的 isCriticalAssetPath。
    const hasAssetReloaded = () => readSessionPreference(assetReloadKey) === '1';
    const markAssetReloaded = () => writeSessionPreference(assetReloadKey, '1');

    const tryRecoverAssetLoad = async (resourceUrl) => {
        if (!isSameOriginResource(resourceUrl)) return false;
        let resourcePath = '';
        try {
            resourcePath = new URL(resourceUrl, window.location.href).pathname;
        } catch {
            return false;
        }
        if (!isCriticalAssetPath(resourcePath)) return false;
        if (hasAssetReloaded()) return false;

        // 写不进标记就绝不能重载：站点数据被禁用时 sessionStorage 不可用，
        // 「已重载过」永远读不到，于是每次重载都会再次走到这里 →
        // 「加载失败 → 重载 → 仍然失败 → 再重载」无限刷新（实测 5 秒 62 次）。
        // 宁可放弃自动恢复，也不能把用户卡在刷新循环里。
        if (!markAssetReloaded()) {
            console.warn('[Resource Load] Cannot persist reload marker, skip auto recovery');
            return false;
        }
        try {
            if ('caches' in window) {
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map((key) => caches.delete(key)));
            }
        } catch (error) {
            console.warn('[Resource Load] Failed to clear cache:', error);
        }

        const reloadUrl = new URL(window.location.href);
        reloadUrl.searchParams.set('__misub_reload', Date.now().toString());
        window.location.replace(reloadUrl.toString());
        return true;
    };

    window.addEventListener(
        'error',
        (event) => {
            if (event.target !== window) {
                const resourceUrl = event.target.src || event.target.href || '';

                // 忽略第三方资源加载错误（如 Cloudflare Analytics、广告等）
                const isThirdParty = resourceUrl && !isSameOriginResource(resourceUrl);
                if (isThirdParty) {
                    console.debug(
                        '[Resource Load] Ignoring third-party resource error:',
                        resourceUrl
                    );
                    return;
                }

                // 忽略 LINK 标签的加载错误 (通常是 modulepreload 失败，不影响主应用运行)
                if (event.target.tagName === 'LINK') {
                    console.warn(
                        '[Resource Load] Ignoring LINK tag error (likely modulepreload):',
                        resourceUrl
                    );
                    return;
                }

                // 忽略 Cloudflare 基础设施脚本 (Rocket Loader, Analytics 等)
                // 这些脚本在同源下 (/cdn-cgi/...)，但由 CF 注入，常被隐私设置拦截
                if (resourceUrl && resourceUrl.includes('/cdn-cgi/')) {
                    console.debug(
                        '[Resource Load] Ignoring Cloudflare infrastructure error:',
                        resourceUrl
                    );
                    return;
                }

                tryRecoverAssetLoad(resourceUrl).then((recovered) => {
                    if (recovered) return;

                    // 非 JS/CSS 资源（图片、字体、manifest 等）加载失败不影响应用运行，
                    // 也不该弹「请尝试刷新页面」——刷新解决不了，反而会误报服务端有意返回的
                    // 品牌资源 404，把正常的伪装行为说成故障。
                    let resourcePath = '';
                    try {
                        resourcePath = new URL(resourceUrl, window.location.href).pathname;
                    } catch {
                        console.debug('[Resource Load] Unresolvable resource error:', resourceUrl);
                        return;
                    }
                    if (!isCriticalAssetPath(resourcePath)) {
                        console.debug(
                            '[Resource Load] Non-critical resource error suppressed:',
                            resourceUrl
                        );
                        return;
                    }
                    if (localHost) {
                        console.debug('[Resource Load] Local asset error suppressed:', resourceUrl);
                        return;
                    }
                    handleError(
                        new Error(`Resource load failed: ${resourceUrl}`),
                        'Resource Load Error',
                        {
                            tagName: event.target.tagName,
                            src: resourceUrl,
                        }
                    );
                });
            }
        },
        true
    );
}

const pinia = createPinia();
const app = createApp(App);

configureUnauthorizedHandler(({ url }) => {
    window.dispatchEvent(new CustomEvent('misub:unauthorized', { detail: { url } }));
});

// 全局错误处理插件
app.config.errorHandler = (error, instance, info) => {
    handleError(error, 'Vue Component Error', {
        component: instance?.$options?.name || 'Unknown',
        info,
    });
};

app.use(pinia);
app.use(i18n);
const toastStore = useToastStore(pinia);
setToastHandler(toastStore.showToast);
configureErrorMonitoring({ endpoint: import.meta.env.VITE_ERROR_REPORT_URL });
app.use(router); // Use Router
app.mount('#app');
