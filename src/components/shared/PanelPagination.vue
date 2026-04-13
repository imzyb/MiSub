<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  variant: {
    type: String,
    default: 'simple'
  },
  currentPage: {
    type: Number,
    default: 1
  },
  totalPages: {
    type: Number,
    default: 1
  },
  totalItems: {
    type: Number,
    default: 0
  },
  itemsPerPage: {
    type: Number,
    default: 24
  },
  itemsPerPageOptions: {
    type: Array,
    default: () => [24, 48, 96, -1]
  },
  showItemsPerPage: {
    type: Boolean,
    default: false
  },
  showTotalItems: {
    type: Boolean,
    default: false
  },
  hideWhenSinglePage: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['change-page', 'update:itemsPerPage']);

const isPanelVariant = computed(() => props.variant === 'panel');

const shouldShow = computed(() => {
  if (!props.hideWhenSinglePage) return true;

  if (isPanelVariant.value) {
    return props.totalPages > 1 || (props.showItemsPerPage && props.itemsPerPage !== 24);
  }

  return props.totalPages > 1;
});

const pageInput = ref('');

watch(
  () => props.currentPage,
  (newValue) => {
    pageInput.value = newValue;
  },
  { immediate: true }
);

function emitPageChange(page) {
  const parsed = parseInt(page, 10);
  if (Number.isNaN(parsed)) return;

  const clamped = Math.min(Math.max(parsed, 1), Math.max(props.totalPages, 1));
  pageInput.value = clamped;
  emit('change-page', clamped);
}

function jumpToPage() {
  emitPageChange(pageInput.value);
}

function handleItemsPerPageChange(event) {
  emit('update:itemsPerPage', parseInt(event.target.value, 10));
}
</script>

<template>
  <div
    v-if="shouldShow && isPanelVariant"
    class="panel-pagination-shell mt-4 px-4 py-3 bg-white/90 dark:bg-gray-900/80 backdrop-blur-md shadow-sm border border-gray-100/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all"
  >
    <div class="flex items-center space-x-4 text-xs text-gray-500 whitespace-nowrap">
      <span v-if="showTotalItems">共 {{ totalItems }} 个订阅组</span>
      <div v-if="showItemsPerPage" class="flex items-center space-x-2">
        <span>每页:</span>
        <select
          :value="itemsPerPage"
          @change="handleItemsPerPageChange"
          class="form-select misub-radius-md text-xs py-1 pl-2 pr-6 border-gray-300 bg-gray-50 dark:bg-gray-900 dark:border-gray-600 focus:ring-primary-500/50 focus:border-primary-500"
        >
          <option v-for="option in itemsPerPageOptions" :key="option" :value="option">{{ option === -1 ? '全部' : option }}</option>
        </select>
      </div>
      <slot name="panel-left" />
    </div>

    <div v-if="totalPages > 1" class="flex items-center space-x-2">
      <button
        @click="emitPageChange(1)"
        :disabled="currentPage === 1"
        class="h-8 w-8 flex items-center justify-center misub-radius-md bg-white/70 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200/70 dark:border-white/10"
        title="第一页"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
      </button>
      <button
        @click="emitPageChange(currentPage - 1)"
        :disabled="currentPage === 1"
        class="h-8 w-8 flex items-center justify-center misub-radius-md bg-white/70 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200/70 dark:border-white/10"
        title="上一页"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      </button>

      <div class="flex items-center space-x-1">
        <input
          type="number"
          v-model="pageInput"
          @keydown.enter="jumpToPage"
          @blur="jumpToPage"
          class="w-14 text-center text-sm py-1 border border-gray-300 dark:border-gray-600 misub-radius-md bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 appearance-none remove-arrow"
        />
        <span class="text-sm text-gray-500">/ {{ totalPages }}</span>
      </div>

      <button
        @click="emitPageChange(currentPage + 1)"
        :disabled="currentPage === totalPages"
        class="h-8 w-8 flex items-center justify-center misub-radius-md bg-white/70 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200/70 dark:border-white/10"
        title="下一页"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
      </button>
      <button
        @click="emitPageChange(totalPages)"
        :disabled="currentPage === totalPages"
        class="h-8 w-8 flex items-center justify-center misub-radius-md bg-white/70 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200/70 dark:border-white/10"
        title="最后一页"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
      </button>
    </div>
    <div v-else class="w-[100px]"></div>
  </div>

  <div v-else-if="shouldShow" class="flex flex-wrap justify-center items-center gap-3 mt-6 text-sm font-medium">
    <button
      @click="emitPageChange(currentPage - 1)"
      :disabled="currentPage === 1"
      class="h-8 px-3 misub-radius-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
    >&laquo; 上一页</button>
    <span class="text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-white/5 border border-gray-200/70 dark:border-white/10 px-3 py-1 misub-radius-md">第 {{ currentPage }} / {{ totalPages }} 页</span>
    <button
      @click="emitPageChange(currentPage + 1)"
      :disabled="currentPage === totalPages"
      class="h-8 px-3 misub-radius-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
    >下一页 &raquo;</button>
  </div>
</template>

<style scoped>
.remove-arrow::-webkit-inner-spin-button,
.remove-arrow::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.remove-arrow {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>


