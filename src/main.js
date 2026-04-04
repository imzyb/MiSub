import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { handleError, setToastHandler, configureErrorMonitoring } from './utils/errorHandler.js'
import { useToastStore } from './stores/toast.js'

// 全局错误处理
if (typeof window !== 'undefined') {
  console.debug('[MiSub] Error Handler Loaded (v2026-01-11-fix-link-error)');
  // 处理未捕获的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || '';
    if (message.includes('Failed to fetch dynamically imported module')
      || message.includes('error loading dynamically imported module')) {
      const reloadKey = 'misub:chunk-reload';
      if (sessionStorage.getItem(reloadKey) !== '1') {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
    }
    handleError(event.reason, 'Unhandled Promise Rejection', {
      type: 'promise_rejection'
    });
    event.preventDefault();
  });

  // 处理全局JavaScript错误
  window.addEventListener('error', (event) => {
    if (event.target && event.target !== window) {
      return;
    }
    handleError(event.error || new Error(event.message), 'Global JavaScript Error', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      tagName: event.target?.tagName
    });
  });

  // 处理资源加载错误（忽略第三方资源）
  const assetReloadKey = 'misub:asset-reload';
  const hasAssetReloaded = () => {
    try {
      return sessionStorage.getItem(assetReloadKey) === '1';
    } catch (error) {
      console.warn('[Resource Load] Failed to read sessionStorage:', error);
      return false;
    }
  };
  const markAssetReloaded = () => {
    try {
      sessionStorage.setItem(assetReloadKey, '1');
    } catch (error) {
      console.warn('[Resource Load] Failed to write sessionStorage:', error);
    }
  };

  const tryRecoverAssetLoad = async (resourceUrl) => {
    if (!resourceUrl || !resourceUrl.startsWith(window.location.origin)) return false;
    const resourcePath = resourceUrl.split('?')[0];
    if (!/\/assets\/.+\.(js|css)$/i.test(resourcePath)) return false;
    if (hasAssetReloaded()) return false;

    markAssetReloaded();
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

  window.addEventListener('error', (event) => {
    if (event.target !== window) {
      const resourceUrl = event.target.src || event.target.href || '';

      // 忽略第三方资源加载错误（如 Cloudflare Analytics、广告等）
      const isThirdParty = resourceUrl && !resourceUrl.startsWith(window.location.origin);
      if (isThirdParty) {
        console.debug('[Resource Load] Ignoring third-party resource error:', resourceUrl);
        return;
      }

      // 忽略 LINK 标签的加载错误 (通常是 modulepreload 失败，不影响主应用运行)
      if (event.target.tagName === 'LINK') {
        console.warn('[Resource Load] Ignoring LINK tag error (likely modulepreload):', resourceUrl);
        return;
      }

      // 忽略 Cloudflare 基础设施脚本 (Rocket Loader, Analytics 等)
      // 这些脚本在同源下 (/cdn-cgi/...)，但由 CF 注入，常被隐私设置拦截
      if (resourceUrl && resourceUrl.includes('/cdn-cgi/')) {
        console.debug('[Resource Load] Ignoring Cloudflare infrastructure error:', resourceUrl);
        return;
      }

      tryRecoverAssetLoad(resourceUrl).then((recovered) => {
        if (recovered) return;
        if (isLocalHost && /\/assets\/.+\.(js|css)$/i.test(resourceUrl)) {
          console.debug('[Resource Load] Local asset error suppressed:', resourceUrl);
          return;
        }
        handleError(new Error(`Resource load failed: ${resourceUrl}`), 'Resource Load Error', {
          tagName: event.target.tagName,
          src: resourceUrl
        });
      });
    }
  }, true);
}



const pinia = createPinia()
const app = createApp(App)

// 全局错误处理插件
app.config.errorHandler = (error, instance, info) => {
  handleError(error, 'Vue Component Error', {
    component: instance?.$options?.name || 'Unknown',
    info
  });

};

app.use(pinia)
const toastStore = useToastStore(pinia)
setToastHandler(toastStore.showToast)
configureErrorMonitoring({ endpoint: import.meta.env.VITE_ERROR_REPORT_URL })
app.use(router) // Use Router
app.mount('#app')
