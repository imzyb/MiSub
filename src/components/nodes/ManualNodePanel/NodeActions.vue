<script setup>
import { computed } from 'vue';
import MoreActionsMenu from '@/components/shared/MoreActionsMenu.vue';

const props = defineProps({
  manualNodesCount: {
    type: Number,
    default: 0
  },
  filteredNodesCount: {
    type: Number,
    default: 0
  },
  searchTerm: {
    type: String,
    default: ''
  },
  activeGroupFilter: {
    type: String,
    default: null
  },
  manualNodeGroups: {
    type: Array,
    default: () => []
  },
  viewMode: {
    type: String,
    default: 'card'
  },
  isSorting: {
    type: Boolean,
    default: false
  },
  isSelectionMode: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:searchTerm',
  'update:viewMode',
  'set-group-filter',
  'add',
  'import',
  'auto-sort',
  'deduplicate',
  'toggle-sort',
  'delete-all',
  'toggle-selection-mode',
  'ping-all'
]);

const searchModel = computed({
  get: () => props.searchTerm,
  set: (val) => emit('update:searchTerm', val)
});
</script>

<template>
  <div class="mb-4 rounded-xl border border-gray-100/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div class="flex items-center gap-3 flex-wrap">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">手动节点</h2>
      <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">{{ manualNodesCount }}</span>
      
      <!-- Mobile Group Filter -->
       <div class="flex md:hidden items-center overflow-x-auto no-scrollbar gap-2 py-1 max-w-full">
         <button 
           @click="emit('set-group-filter', null)"
           class="px-2.5 py-1 text-xs font-medium misub-radius-md transition-all border shrink-0 whitespace-nowrap"
           :class="!activeGroupFilter ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700' : 'bg-white text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'"
         >全部</button>
         <button 
           @click="emit('set-group-filter', '默认')"
           class="px-2.5 py-1 text-xs font-medium misub-radius-md transition-all border shrink-0 whitespace-nowrap"
           :class="activeGroupFilter === '默认' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700' : 'bg-white text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'"
         >未分组</button>
         <button 
           v-for="group in manualNodeGroups" 
           :key="group"
          @click="emit('set-group-filter', activeGroupFilter === group ? null : group)"
          class="px-2.5 py-1 text-xs font-medium misub-radius-md transition-all border shrink-0 whitespace-nowrap"
          :class="activeGroupFilter === group ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700' : 'bg-white text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'"
        >
          {{ group }}
        </button>
      </div>

      <span v-if="searchTerm" class="mt-2 w-full rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 sm:mt-0 sm:w-auto">
        搜索: "{{ searchTerm }}" ({{ filteredNodesCount }}/{{ manualNodesCount }})
      </span>
    </div>
    <div class="flex items-center gap-2 w-full sm:w-auto">


      <div class="relative grow lg:min-w-[240px]">
        <input 
          type="text" 
          v-model="searchModel"
          placeholder="搜索节点..."
          class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5"
        />
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>
      <div class="p-0.5 bg-gray-200 dark:bg-gray-700 misub-radius-md flex items-center shrink-0">
        <button @click="emit('update:viewMode', 'card')" class="view-mode-toggle p-1.5 misub-radius-sm transition-colors flex items-center justify-center" :class="viewMode === 'card' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        </button>
        <button @click="emit('update:viewMode', 'list')" class="view-mode-toggle p-1.5 misub-radius-sm transition-colors flex items-center justify-center" :class="viewMode === 'list' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
        </button>
      </div>
      <button @click="emit('ping-all')" class="shrink-0 rounded-lg bg-green-500/10 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-500/20 dark:text-green-400">全部测速</button>
      <button @click="emit('add')" class="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700">新增</button>
      <MoreActionsMenu menu-width-class="w-36">
        <template #menu="{ close }">
          <button
            @click="emit('toggle-selection-mode'); close()"
            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
            :class="isSelectionMode ? 'text-indigo-600 dark:text-indigo-400' : ''"
          >
            {{ isSelectionMode ? '退出批量' : '批量操作' }}
          </button>
          <div class="border-t border-gray-100 dark:border-gray-700/50 my-1"></div>
          <button @click="emit('import'); close()" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">导入订阅</button>
          <button @click="emit('auto-sort'); close()" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">一键排序</button>
          <button @click="emit('deduplicate'); close()" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">一键去重</button>
          <button
            @click="emit('toggle-sort'); close()"
            class="w-full text-left px-4 py-2 text-sm transition-colors text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {{ isSorting ? '完成排序' : '手动排序' }}
          </button>
          <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
          <button @click="emit('delete-all'); close()" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">清空所有</button>
        </template>
      </MoreActionsMenu>
    </div>
  </div>
  
  <!-- Group Filter Chips (New Line) -->
  <div class="hidden md:flex items-center gap-2 mt-3 pt-3 border-t border-gray-100/80 dark:border-white/10 overflow-x-auto no-scrollbar mask-gradient-r pb-1">
    <button 
      @click="emit('set-group-filter', null)"
      class="px-3 py-1 text-xs font-medium misub-radius-md transition-all border shrink-0"
      :class="!activeGroupFilter ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700/50 dark:text-indigo-300' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'"
    >全部</button>
    <button 
      @click="emit('set-group-filter', '默认')"
      class="px-3 py-1 text-xs font-medium misub-radius-md transition-all border shrink-0"
      :class="activeGroupFilter === '默认' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700/50 dark:text-indigo-300' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'"
    >未分组</button>
    <button 
      v-for="group in manualNodeGroups" 
      :key="group"
      @click="emit('set-group-filter', activeGroupFilter === group ? null : group)"
      class="px-3 py-1 text-xs font-medium misub-radius-md transition-all border shrink-0"
      :class="activeGroupFilter === group ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700/50 dark:text-indigo-300' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'"
    >
      {{ group }}
    </button>
  </div>
  </div>
</template>
