<script setup>
import { computed } from 'vue';
import draggable from 'vuedraggable';

const props = defineProps({
  subscriptions: {
    type: Array,
    default: () => []
  },
  filteredSubscriptions: {
    type: Array,
    default: () => []
  },
  searchTerm: {
    type: String,
    default: ''
  },
  selectedIds: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  'update:searchTerm',
  'update:selectedIds',
  'toggle-selection',
  'select-all',
  'deselect-all'
]);

const searchModel = computed({
  get: () => props.searchTerm,
  set: (val) => emit('update:searchTerm', val)
});

// 根据 selectedIds 顺序获取已选订阅对象列表
const orderedSelectedSubs = computed({
  get() {
    const subMap = new Map(props.subscriptions.map(s => [s.id, s]));
    return props.selectedIds
      .map(id => subMap.get(id))
      .filter(Boolean);
  },
  set(newList) {
    // 拖拽排序后更新 ID 顺序
    emit('update:selectedIds', newList.map(s => s.id));
  }
});
</script>

<template>
  <div v-if="subscriptions.length > 0" class="space-y-2">
    <div class="flex justify-between items-center mb-2">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">选择机场订阅</h4>
      <div class="space-x-2">
        <button @click="emit('select-all')" class="text-xs text-indigo-600 hover:underline">全选</button>
        <button @click="emit('deselect-all')" class="text-xs text-indigo-600 hover:underline">全不选</button>
      </div>
    </div>
    <!-- 占位区域，与右侧分组筛选高度一致 -->
    <div class="h-[42px]"></div>
    <div class="relative mb-2">
      <input type="text" v-model="searchModel" placeholder="搜索订阅..."
        class="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg"
        fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <div
      class="overflow-y-auto space-y-2 p-3 bg-gray-50 dark:bg-gray-900/50 misub-radius-md border dark:border-gray-700 h-36 lg:h-64">
      <div v-for="sub in filteredSubscriptions" :key="sub.id">
        <label class="flex items-center space-x-3 cursor-pointer">
          <input type="checkbox" :checked="selectedIds.includes(sub.id)" @change="emit('toggle-selection', sub.id)"
            class="h-4 w-4 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <span class="text-sm text-gray-800 dark:text-gray-200 truncate" :title="sub.name">{{ sub.name || '未命名订阅'
          }}</span>
        </label>
      </div>
      <div v-if="filteredSubscriptions.length === 0" class="text-center text-gray-500 text-sm py-4">
        没有找到匹配的订阅。
      </div>
    </div>

    <!-- 已选订阅拖拽排序区域 -->
    <div v-if="orderedSelectedSubs.length > 0" class="mt-3">
      <div class="flex justify-between items-center mb-1.5">
        <h5 class="text-xs font-medium text-gray-500 dark:text-gray-400">
          已选 ({{ orderedSelectedSubs.length }}) - 拖拽调整顺序
        </h5>
      </div>
      <draggable v-model="orderedSelectedSubs" item-key="id" handle=".drag-handle" ghost-class="opacity-40"
        class="space-y-1 p-2 bg-indigo-50 dark:bg-indigo-900/20 misub-radius-md border border-indigo-200 dark:border-indigo-800 h-32 lg:h-48 overflow-y-auto">
        <template #item="{ element, index }">
          <div
            class="flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 shadow-xs">
            <span
              class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
              </svg>
            </span>
            <span class="text-xs font-medium text-indigo-600 dark:text-indigo-400 w-5">{{ index + 1 }}</span>
            <span class="text-sm text-gray-800 dark:text-gray-200 truncate flex-1" :title="element.name">
              {{ element.name || '未命名订阅' }}
            </span>
            <button @click="emit('toggle-selection', element.id)"
              class="text-gray-400 hover:text-red-500 transition-colors" title="移除">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </template>
      </draggable>
    </div>
  </div>
  <div v-else
    class="text-center text-sm text-gray-500 p-4 bg-gray-50 dark:bg-gray-900/50 misub-radius-md flex items-center justify-center h-full">
    没有可用的机场订阅
  </div>
</template>
