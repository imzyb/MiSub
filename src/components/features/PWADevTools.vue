<script setup>
import { ref, onMounted } from 'vue';

const showDevTools = ref(false);
const isDev = ref(false);

// 手动触发beforeinstallprompt事件（仅用于测试）
const triggerInstallPrompt = () => {
  const event = new Event('beforeinstallprompt');
  event.prompt = () => Promise.resolve();
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  if (isDev.value) {
    console.debug('手动触发了beforeinstallprompt事件');
  }
};

// 检查PWA状态
const checkPWAStatus = () => {
  const status = {
    serviceWorker: 'serviceWorker' in navigator,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    installed: window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches,
    https: location.protocol === 'https:' || location.hostname === 'localhost',
    manifest: document.querySelector('link[rel="manifest"]') !== null
  };
  
  if (isDev.value) {
    console.table(status);
  }
  return status;
};

// 强制触发Service Worker更新
const forceUpdate = async () => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      registration.update();
      if (isDev.value) {
        console.debug('强制检查Service Worker更新');
      }
    }
  }
};

onMounted(() => {
  // 检查是否在开发环境
  isDev.value = import.meta.env.DEV || location.hostname === 'localhost';
  
  // 添加快捷键 Ctrl+Shift+P 显示开发工具
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      showDevTools.value = !showDevTools.value;
    }
  });
});
</script>

<template>
  <!-- 开发者工具面板 -->
  <Transition name="dev-tools">
    <div
      v-if="showDevTools && isDev"
      class="fixed bottom-4 left-4 z-50 bg-gray-900/95 backdrop-blur-lg text-white misub-radius-md shadow-2xl border border-gray-700 p-4 max-w-sm"
    >
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold">PWA 开发工具</h3>
        <button
          @click="showDevTools = false"
          class="text-gray-400 hover:text-white"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div class="space-y-2">
        <button
          @click="triggerInstallPrompt"
          class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-sm misub-radius-md transition-colors"
        >
          触发安装提示
        </button>
        
        <button
          @click="checkPWAStatus"
          class="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-sm misub-radius-md transition-colors"
        >
          检查PWA状态
        </button>
        
        <button
          @click="forceUpdate"
          class="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 text-sm misub-radius-md transition-colors"
        >
          强制更新SW
        </button>
      </div>
      
      <div class="mt-3 pt-2 border-t border-gray-700">
        <p class="text-xs text-gray-400">
          快捷键: Ctrl+Shift+P
        </p>
      </div>
    </div>
  </Transition>
  
  <!-- 开发环境提示按钮 -->
  <button
    v-if="isDev && !showDevTools"
    @click="showDevTools = true"
    class="fixed bottom-4 left-4 z-40 w-12 h-12 bg-gray-900/80 hover:bg-gray-800 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110"
    title="PWA开发工具 (Ctrl+Shift+P)"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  </button>
</template>

<style scoped>
.dev-tools-enter-active,
.dev-tools-leave-active {
  transition: all 0.3s ease;
}

.dev-tools-enter-from,
.dev-tools-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
</style>
