import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'
import App from './App.vue'
import { handleError } from './utils/errorHandler.js'

// 全局错误处理
if (typeof window !== 'undefined') {
  // 处理未捕获的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, 'Unhandled Promise Rejection', {
      type: 'promise_rejection'
    });
    event.preventDefault();
  });

  // 处理全局JavaScript错误
  window.addEventListener('error', (event) => {
    handleError(event.error || new Error(event.message), 'Global JavaScript Error', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      tagName: event.target?.tagName
    });
  });

  // 处理资源加载错误
  window.addEventListener('error', (event) => {
    if (event.target !== window) {
      handleError(new Error(`Resource load failed: ${event.target.src || event.target.href}`), 'Resource Load Error', {
        tagName: event.target.tagName,
        src: event.target.src || event.target.href
      });
    }
  }, true);
}

// PWA Service Worker 注册
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      if (import.meta.env.DEV) {
        console.log('SW registered: ', registration);
      }

      // 监听 Service Worker 更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (import.meta.env.DEV) {
                console.log('New SW version available');
              }
              // 发送消息给PWA更新组件
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SW_UPDATE_AVAILABLE' });
              }
            }
          });
        }
      });

    } catch (error) {
      handleError(error, 'Service Worker Registration Failed', {
        scope: '/'
      });
    }
  });

  // 监听来自Service Worker的消息
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
      if (import.meta.env.DEV) {
        console.log('收到SW更新通知');
      }
      // 这里可以触发更新UI显示
    }
  });
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
app.mount('#app')
