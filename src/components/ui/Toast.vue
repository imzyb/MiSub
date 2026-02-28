<script setup>
import { ref, watch, computed } from 'vue';
import { useToastStore } from '../../stores/toast.js';

const { toast } = useToastStore();
const isVisible = ref(false);

// 🆕 增强的 Toast 配置
const toastConfig = computed(() => {
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
  return configs[toast.type] || configs.info;
});

watch(() => toast.id, () => {
  if (toast.message) {
    isVisible.value = true;
    setTimeout(() => {
      isVisible.value = false;
    }, 4000); // 延长到4秒
  }
});
</script>

<template>
  <Transition name="toast">
    <div
      v-if="isVisible"
      class="toast-container"
      :class="[
        'fixed top-4 right-4 z-50 min-w-80 max-w-md',
        'sm:min-w-80 min-w-[calc(100vw-2rem)] sm:max-w-md max-w-[calc(100vw-2rem)]',
        'backdrop-blur-lg border border-white/20',
        'rounded-xl shadow-2xl overflow-hidden',
        'ring-1 transition-all duration-300',
        toastConfig.bg,
        toastConfig.ring
      ]"
    >
      <!-- Toast 内容 -->
      <div class="relative p-4">
<!-- 关闭按钮 -->
<button
@click="isVisible = false"
class="toast-close-btn absolute top-2 right-2 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
aria-label="关闭提示"
>
<svg class="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
</svg>
</button>

        <!-- 图标和消息 -->
        <div class="flex items-center gap-3 pr-6">
          <!-- 动态图标 -->
          <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center">
            <svg class="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="toastConfig.icon" />
            </svg>
          </div>
          
          <!-- 消息内容 -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white leading-5">
              {{ toast.message }}
            </p>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div 
            class="h-full bg-white/60 transition-all duration-75 ease-linear progress-bar"
            :style="{ width: '100%' }"
          ></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Toast 动画 */
.toast-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  transform: translateX(100%) scale(0.95);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%) scale(0.95);
  opacity: 0;
}

/* 进度条动画 */
.progress-bar {
  animation: shrink 4s linear forwards;
}

@keyframes shrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

/* 微光效果 */
.toast-enter-active::before {
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
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* 移动端优化 */
@media (max-width: 640px) {
.toast-container {
/* 确保在移动端Toast不会太宽 */
left: 1rem;
right: 1rem;
top: 1rem;
}

/* 移动端关闭按钮优化 - 确保触击区域至少44px */
.toast-close-btn {
min-width: 44px;
min-height: 44px;
}
}
</style>