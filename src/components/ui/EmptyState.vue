<script setup>
import { computed } from 'vue';

const props = defineProps({
  filteredCount: {
    type: Number,
    default: 0
  },
  totalCount: {
    type: Number,
    default: 0
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: 'search'
  }
});

const emit = defineEmits(['reset', 'refresh']);

const displayTitle = computed(() => {
  if (props.title) return props.title;
  if (props.totalCount === 0) {
    return '暂无数据';
  } else if (props.filteredCount === 0) {
    return '没有符合条件的结果';
  }
  return '暂无内容';
});

const displayDescription = computed(() => {
  if (props.description) return props.description;
  if (props.totalCount === 0) {
    return '当前还没有可用的数据，尝试添加新的订阅或节点。';
  } else if (props.filteredCount === 0) {
    return '调整筛选条件或重置过滤器以查看全部内容。';
  }
  return '暂无可展示的内容，请稍后重试。';
});

const showResetButton = computed(() => {
  return props.totalCount > 0 && props.filteredCount === 0;
});

const iconPaths = {
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  node: 'M13 10V3L4 14h7v7l9-11h-7z',
  default: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
};
</script>

<template>
  <div
    class="flex flex-col items-center justify-center py-16 px-6 animate-fade-in-up"
    role="status"
    aria-live="polite"
  >
    <div class="relative mb-8">
      <div class="absolute inset-0 bg-primary-500/20 dark:bg-primary-400/10 rounded-full blur-3xl animate-pulse-slow"></div>
      <div class="relative flex items-center justify-center w-32 h-32 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-full shadow-xl border border-gray-200/50 dark:border-white/5 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-tr from-primary-500/5 to-transparent"></div>
        <svg
          class="w-16 h-16 text-gray-400 dark:text-gray-500 relative z-10 transition-transform duration-500 hover:scale-110"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            :d="iconPaths[icon] || iconPaths.default"
          />
        </svg>
      </div>
      <div class="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg animate-bounce-subtle">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
    </div>

    <div class="text-center mb-8 max-w-sm">
      <h3 class="text-xl font-display font-semibold text-gray-900 dark:text-white mb-3 tracking-tight">
        {{ displayTitle }}
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {{ displayDescription }}
      </p>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 items-center">
      <button
        v-if="showResetButton"
        @click="emit('reset')"
        class="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-sm font-medium misub-radius-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm"
        aria-label="重置过滤条件"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        重置过滤
      </button>

      <button
        v-else
        @click="emit('refresh')"
        class="inline-flex items-center px-6 py-3 text-sm font-medium misub-radius-lg text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-primary-500/25"
        aria-label="刷新列表"
      >
        <svg class="w-4 h-4 mr-2 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        刷新列表
      </button>
    </div>

    <div v-if="totalCount > 0" class="mt-8 px-5 py-2.5 bg-gray-100/50 dark:bg-gray-800/50 rounded-full backdrop-blur-sm border border-gray-200/30 dark:border-white/5">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        共 <span class="font-semibold text-gray-700 dark:text-gray-300">{{ totalCount }}</span> 项，
        已过滤 <span class="font-semibold text-gray-700 dark:text-gray-300">{{ filteredCount }}</span> 项
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse-slow {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}

@keyframes bounce-subtle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-pulse-slow {
  animation: pulse-slow 3s ease-in-out infinite;
}

.animate-bounce-subtle {
  animation: bounce-subtle 2s ease-in-out infinite;
}

.animate-spin-slow {
  animation: spin-slow 3s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-pulse-slow,
  .animate-bounce-subtle,
  .animate-spin-slow,
  .animate-fade-in-up {
    animation: none !important;
  }
}
</style>
