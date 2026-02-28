<script setup>
import { useThemeStore } from '../../stores/theme.js';
import { useUIStore } from '../../stores/ui.js';
import { useSessionStore } from '../../stores/session.js';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ThemeToggle from '../features/ThemeToggle.vue';


const { theme, toggleTheme } = useThemeStore();
const uiStore = useUIStore();
const sessionStore = useSessionStore();
const route = useRoute();

const shouldHideLoginButton = computed(() => {
    // If a custom login path is set, HIDE the button unless we are ON that path.
    // The path matching logic in Entrance.vue handles the view, but this handles the nav button.
    const rawPath = sessionStore.publicConfig?.customLoginPath;
    
    if (!rawPath || typeof rawPath !== 'string') {
        return false;
    }

    // Normalize path: remove leading slash and trim whitespace
    const normalizedPath = rawPath.trim().replace(/^\/+/, '');

    // If path is empty after trim, or is explicitly 'login', tread it as default behavior (show button)
    if (!normalizedPath || normalizedPath === 'login') {
        return false;
    }

    // If we have a VALID custom path, hide the button.
    // Users on the custom path will see the LOGIN FORM, not this button.
    // Users NOT on the custom path (e.g. Home) should NOT see a way to login easily.
    return true; 
});

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
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 mr-2">
             <svg width="20" height="20" viewBox="0 0 128 128" fill="currentColor">
                <path d="M64 128a64 64 0 1 1 64-64a64.07 64.07 0 0 1-64 64Zm0-122a58 58 0 1 0 58 58A58.07 58.07 0 0 0 64 6Z"/>
                <path d="M64 100a36 36 0 1 1 36-36a36 36 0 0 1-36 36Zm0-66a30 30 0 1 0 30 30a30 30 0 0 0-30-30Z"/>
             </svg>
          </div>
          <span class="text-lg font-bold font-display tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            MiSub
          </span>
        </div>
        
        <div class="flex items-center space-x-2 sm:space-x-3">
            <ThemeToggle :theme="theme" @toggle="toggleTheme" />

<div v-if="isLoggedIn" class="flex items-center space-x-2 sm:space-x-3">

<button @click="uiStore.show()" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white smooth-all hover:scale-110 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="设置" aria-label="打开设置">
<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
</button>

<button @click="uiStore.toggleLayout()" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white smooth-all hover:scale-110 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="切换新版布局" aria-label="切换布局">
<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
</svg>
</button>
<button @click="emit('logout')" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white smooth-all hover:scale-110 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="登出" aria-label="退出登录">
<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
</button>
</div>

<template v-else>
<a href="https://github.com/imzyb/MiSub" target="_blank" rel="noopener noreferrer" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white smooth-all hover:scale-110 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="GitHub" aria-label="访问 GitHub 仓库">
<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
</svg>
</a>
                 <router-link 
                    v-if="!shouldHideLoginButton"
                    to="/login" 
                    class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                    登录
                 </router-link>
            </template>
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