<script setup>
const props = defineProps({
  isSelectionMode: {
    type: Boolean,
    default: false
  },
  isAllSelected: {
    type: Boolean,
    default: false
  },
  selectedCount: {
    type: Number,
    default: 0
  },
  groups: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['toggle-select-all', 'batch-group', 'batch-delete', 'exit']);

const handleMoveToGroup = () => {
  emit('batch-group');
};
</script>

<template>
  <Transition name="slide-fade-sm">
    <div
      v-if="isSelectionMode"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] sm:w-auto max-w-xl bg-white dark:bg-gray-900/70 shadow-xl misub-radius-lg px-4 py-3 sm:px-6 sm:py-3 flex flex-col sm:flex-row items-center justify-between sm:justify-center gap-3 sm:gap-4 z-50 border border-gray-200 dark:border-white/10"
    >
      <div class="flex items-center justify-between w-full sm:w-auto gap-4">
        <button
          @click="emit('toggle-select-all')"
          class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 whitespace-nowrap"
        >
          {{ isAllSelected ? '取消全选' : '全选本页' }}
        </button>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">已选 {{ selectedCount }}</span>
      </div>

      <div class="h-px w-full sm:w-px sm:h-4 bg-gray-200 dark:bg-gray-600 flex-shrink-0 hidden sm:block"></div>

      <div class="grid grid-cols-2 sm:flex sm:items-center w-full sm:w-auto gap-3 sm:gap-2">
        <div class="col-span-2 sm:col-span-1 flex items-center justify-center w-full sm:w-auto gap-2 sm:gap-3 overflow-x-auto no-scrollbar mask-gradient">
          <span class="text-xs text-gray-500 hidden sm:inline">批量操作:</span>
          <div class="flex items-center gap-3 sm:gap-2 w-full sm:w-auto">
            <button
               @click="handleMoveToGroup"
               class="flex-1 sm:flex-none text-xs font-medium px-3 py-2 sm:py-1 bg-indigo-50 text-indigo-600 misub-radius-md border border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800 transition-colors whitespace-nowrap"
            >
              移动所属分组...
            </button>
          </div>
        </div>
        
        <div class="col-span-2 sm:col-span-1 flex items-center justify-center w-full sm:w-auto gap-3 sm:gap-2 shrink-0 sm:ml-1 sm:pl-2 sm:border-l border-gray-200 dark:border-gray-600 pt-1 sm:pt-0 border-t sm:border-t-0 border-dashed sm:border-solid">
          <button @click="emit('batch-delete')" class="flex-1 sm:flex-none justify-center text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap flex items-center gap-1 px-3 py-2 sm:py-1 bg-red-50 sm:bg-transparent misub-radius-md sm:misub-radius-md">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
            删除
          </button>
          <button @click="emit('exit')" class="flex-1 sm:flex-none justify-center text-xs sm:text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white whitespace-nowrap px-3 py-2 sm:py-1 bg-gray-100 sm:bg-transparent misub-radius-md sm:misub-radius-md">退出</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-fade-sm-enter-active,
.slide-fade-sm-leave-active {
  transition: all 0.2s ease-out;
}
.slide-fade-sm-enter-from,
.slide-fade-sm-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
