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
    class="flex flex-col items-center justify-center py-12 px-4"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
      <svg
        class="w-8 h-8 text-gray-400 dark:text-gray-500"
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

    <div class="text-center mb-6">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ displayTitle }}
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md">
        {{ displayDescription }}
      </p>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 items-center">
      <button
        v-if="showResetButton"
        @click="emit('reset')"
        class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
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
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        aria-label="刷新列表"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        刷新列表
      </button>
    </div>

    <div v-if="totalCount > 0" class="mt-6 text-xs text-gray-400 dark:text-gray-500">
      共 {{ totalCount }} 项，已过滤 {{ filteredCount }} 项
    </div>
  </div>
</template>
