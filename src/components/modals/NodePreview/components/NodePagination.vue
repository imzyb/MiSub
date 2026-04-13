<script setup>
import { computed } from 'vue';

const props = defineProps({
  currentPage: {
    type: Number,
    default: 1
  },
  totalPages: {
    type: Number,
    default: 1
  },
  pageSize: {
    type: Number,
    default: 24
  },
  totalItems: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['go-to-page']);

const pageNumbers = computed(() => {
  const pages = [];
  const current = props.currentPage;
  const total = props.totalPages;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 3) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    }
  }

  return pages;
});

const goToPage = (page) => {
  if (page < 1 || page > props.totalPages) return;
  emit('go-to-page', page);
};
</script>

<template>
  <div v-if="totalPages > 1" class="shrink-0 border-t border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40 sm:p-5">
    <!-- 桌面端完整分页 -->
    <div v-if="currentPage > 0" class="hidden sm:flex items-center justify-between">
      <div class="text-sm text-gray-700 dark:text-gray-300">
        显示第 {{ ((currentPage - 1) * pageSize) + 1 }} - {{ Math.min(currentPage * pageSize, totalItems) }} 项，共 {{ totalItems }} 项
      </div>
      <div class="flex items-center space-x-2">
        <!-- 上一页 -->
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage <= 1"
          class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          上一页
        </button>

        <!-- 页码 -->
        <div class="flex space-x-1">
          <button
            v-for="page in pageNumbers"
            :key="page"
            @click="page !== '...' && goToPage(page)"
            :class="{
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors': true,
              'bg-indigo-600 border-indigo-600 text-white': page === currentPage,
              'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600': page !== currentPage && page !== '...',
              'opacity-50 cursor-not-allowed': page === '...'
            }"
            :disabled="page === '...'"
          >
            {{ page }}
          </button>
        </div>

        <!-- 下一页 -->
        <button
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage >= totalPages"
          class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 移动端简化分页 -->
    <div class="sm:hidden">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-sm text-gray-700 dark:text-gray-300">
          {{ currentPage }} / {{ totalPages }} 页
        </div>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          共 {{ totalItems }} 项
        </div>
      </div>
      <div class="flex items-center justify-center space-x-4">
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage <= 1"
          class="max-w-[100px] flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          上一页
        </button>
        <span class="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400">
          {{ currentPage }}
        </span>
        <button
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage >= totalPages"
          class="max-w-[100px] flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>
