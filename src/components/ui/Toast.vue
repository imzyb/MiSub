<script setup>
import { useToastStore } from '../../stores/toast.js';

const toastStore = useToastStore();

// 🆕 增强的 Toast 配置
const getToastConfig = (type) => {
  const configs = {
    success: {
      bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
      icon: 'M5 13l4 4L19 7',
      ring: 'ring-green-500/20'
    },
    error: {
      bg: 'bg-gradient-to-r from-red-500 to-rose-500',
      icon: 'M6 18L18 6M6 6l12 12',
      ring: 'ring-red-500/20'
    },
    info: {
      bg: 'bg-gradient-to-r from-blue-500 to-indigo-500',
      icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      ring: 'ring-blue-500/20'
    },
    warning: {
      bg: 'bg-gradient-to-r from-yellow-500 to-orange-500',
      icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      ring: 'ring-yellow-500/20'
    }
  };
  return configs[type] || configs.info;
};

const handleClose = (id) => {
  toastStore.removeToast(id);
};
</script>

<template>
  <div class="fixed z-[100] flex flex-col items-end gap-3 pointer-events-none top-20 md:top-4 right-4 left-4 md:left-auto max-h-[calc(100vh-120px)] md:max-h-[100vh] overflow-hidden pr-1 pb-safe">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        class="toast-container pointer-events-auto w-full sm:w-auto sm:min-w-80 max-w-md backdrop-blur-lg border border-white/20 misub-radius-lg shadow-2xl overflow-hidden ring-1 transition-all duration-300 relative"
        :class="[getToastConfig(toast.type).bg, getToastConfig(toast.type).ring]"
      >
        <!-- Toast 内容 -->
        <div class="relative p-4 pl-5">
          <!-- 关闭按钮 -->
          <button
            @click="handleClose(toast.id)"
            class="toast-close-btn absolute top-2 right-2 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 w-7 h-7"
            aria-label="关闭提示"
          >
            <svg class="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- 图标和消息 -->
          <div class="flex items-start gap-3 pr-8">
            <!-- 动态图标 -->
            <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">
              <svg class="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getToastConfig(toast.type).icon" />
              </svg>
            </div>
            
            <!-- 消息内容 -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white leading-relaxed break-words">
                {{ toast.message }}
              </p>
            </div>
          </div>

          <!-- 进度条 -->
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div 
              class="h-full bg-white/60 ease-linear progress-bar"
              :style="{ animationDuration: `${toast.duration}ms` }"
            ></div>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Toast 容器安全区域 */
.pb-safe {
  padding-bottom: max(env(safe-area-inset-bottom, 20px), 80px);
}

@media (min-width: 768px) {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 20px);
  }
}

/* Toast 列表动画 */
.toast-move,
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  width: 100%;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.toast-leave-active {
  position: absolute;
  /* 确保退出时也是绝对定位，以便腾出空间给后续元素上移 */
  right: 0;
  left: 0;
}

@media (min-width: 640px) {
  .toast-leave-active {
    left: auto;
  }
}

/* 进度条动画 */
.progress-bar {
  animation-name: shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes shrink {
  from { width: 100%; }
  to { width: 0%; }
}

/* 微光效果 */
.toast-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shimmer 0.6s ease-out 0.2s;
  pointer-events: none;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* 移动端优化 */
@media (max-width: 640px) {
  .toast-close-btn {
    min-width: 44px;
    min-height: 44px;
    top: 4px;
    right: 4px;
  }
}
</style>