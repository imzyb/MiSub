<script setup>
import { useThemeStore } from '../stores/theme.js';
import { useUIStore } from '../stores/ui.js';
import ThemeToggle from './ThemeToggle.vue';

const { theme, toggleTheme } = useThemeStore();
const uiStore = useUIStore();

// 【核心修正】接收一个 isLoggedIn 属性
const props = defineProps({
  isLoggedIn: Boolean
});

const emit = defineEmits(['logout']);
</script>

<template>
  <header class="bg-gradient-to-b from-white/95 via-white/90 to-white/95 dark:from-gray-950/95 dark:via-gray-950/90 dark:to-gray-950/95 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/30 dark:border-white/5 supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-gray-950/80 transition-all duration-300">
    <!-- iOS状态栏背景遮罩层 -->
    <div class="ios-status-bar-overlay"></div>
    
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- 添加iOS适配层 -->
      <div class="pt-safe-top">
        <div class="flex justify-between items-center h-16 md:h-20">
        <div class="flex items-center">
          <svg width="32" height="32" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" class="text-indigo-600 dark:text-indigo-400">
            <path fill="currentColor" d="M64 128a64 64 0 1 1 64-64a64.07 64.07 0 0 1-64 64Zm0-122a58 58 0 1 0 58 58A58.07 58.07 0 0 0 64 6Z"/>
            <path fill="currentColor" d="M64 100a36 36 0 1 1 36-36a36 36 0 0 1-36 36Zm0-66a30 30 0 1 0 30 30a30 30 0 0 0-30-30Z"/>
            <path fill="currentColor" d="M64 78a14 14 0 1 1 14-14a14 14 0 0 1-14 14Zm0-22a8 8 0 1 0 8 8a8 8 0 0 0-8-8Z"/>
          </svg>
          <span class="ml-3 text-xl font-bold text-gray-800 dark:text-white">MISUB</span>
        </div>
        
        <div v-if="isLoggedIn" class="flex items-center space-x-2 sm:space-x-3">
          
          <button @click="uiStore.show()" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white smooth-all hover:scale-110 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="设置">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <ThemeToggle :theme="theme" @toggle="toggleTheme" />
          <button @click="emit('logout')" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white smooth-all hover:scale-110 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="登出">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>

        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* iOS状态栏适配 */
.pt-safe-top {
  padding-top: env(safe-area-inset-top, 0px);
}

/* iOS状态栏背景遮罩层 */
.ios-status-bar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: calc(env(safe-area-inset-top, 0px) + 2px); /* 增加到2像素确保完全遮盖 */
  background: inherit;
  z-index: 10;
  pointer-events: none; /* 不阻断点击事件 */
}

/* iOS Safari专用优化 */
@supports (-webkit-touch-callout: none) {
  header {
    /* iOS上使用fixed定位和加强背景，确保完全遮盖状态栏 */
    position: fixed !important;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 1) 0%,
      rgba(255, 255, 255, 0.98) 70%,
      rgba(255, 255, 255, 0.95) 100%
    ) !important;
    backdrop-filter: blur(20px) saturate(1.8);
    -webkit-backdrop-filter: blur(20px) saturate(1.8);
    /* 平滑过渡 */
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    /* 确保完全不透明 */
    min-height: calc(env(safe-area-inset-top, 0px) + 80px);
  }
  
  .dark header {
    background: linear-gradient(
      to bottom,
      rgba(15, 23, 42, 1) 0%,
      rgba(15, 23, 42, 0.98) 70%,
      rgba(15, 23, 42, 0.95) 100%
    ) !important;
  }
  
  /* iOS状态栏遮罩层与header同步 */
  .ios-status-bar-overlay {
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 1) 0%,
      rgba(255, 255, 255, 0.98) 100%
    );
    backdrop-filter: blur(20px) saturate(1.8);
    -webkit-backdrop-filter: blur(20px) saturate(1.8);
  }
  
  .dark .ios-status-bar-overlay {
    background: linear-gradient(
      to bottom,
      rgba(15, 23, 42, 1) 0%,
      rgba(15, 23, 42, 0.98) 100%
    );
  }
}

/* 滚动时的动态效果 */
@media (max-width: 768px) {
  header {
    transform: translateZ(0); /* 启用硬件加速 */
    will-change: transform;
  }
}
</style>