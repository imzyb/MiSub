<script setup>
import { ref, watch } from 'vue';
import draggable from 'vuedraggable';
import ManualNodeCard from './ManualNodeCard.vue';
import ManualNodeList from './ManualNodeList.vue';

const props = defineProps({
  manualNodes: Array,
  paginatedManualNodes: Array,
  currentPage: Number,
  totalPages: Number,
  isSorting: Boolean,
  searchTerm: String,
  viewMode: String,
});

const emit = defineEmits([
  'add', 'delete', 'edit', 'changePage', 'update:searchTerm', 'update:viewMode',
  'toggleSort', 'markDirty', 'autoSort', 'deduplicate', 'import'
]);

const nodesMoreMenuRef = ref(null);
const showNodesMoreMenu = ref(false);
const localSearchTerm = ref(props.searchTerm);

watch(() => props.searchTerm, (newVal) => {
  localSearchTerm.value = newVal;
});

watch(localSearchTerm, (newVal) => {
  emit('update:searchTerm', newVal);
});

const handleDelete = (id) => emit('delete', id);
const handleEdit = (id) => emit('edit', id);
const handleAdd = () => emit('add');
const handleChangePage = (page) => emit('changePage', page);
const handleSetViewMode = (mode) => emit('update:viewMode', mode);
const handleToggleSort = () => {
  emit('toggleSort');
  showNodesMoreMenu.value = false;
};
const handleSortEnd = () => emit('markDirty');
const handleAutoSort = () => {
  emit('autoSort');
  showNodesMoreMenu.value = false;
};
const handleDeduplicate = () => {
  emit('deduplicate');
  showNodesMoreMenu.value = false;
};
const handleImport = () => {
  emit('import');
  showNodesMoreMenu.value = false;
};
const handleDeleteAll = () => {
  emit('deleteAll');
  showNodesMoreMenu.value = false;
};
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">手动节点</h2>
        <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ manualNodes.length }}</span>
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <div class="relative grow">
          <input 
            type="text" 
            v-model="localSearchTerm"
            placeholder="搜索节点..."
            class="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div class="p-0.5 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center shrink-0">
            <button @click="handleSetViewMode('card')" class="p-1 rounded-md transition-colors" :class="viewMode === 'card' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button @click="handleSetViewMode('list')" class="p-1 rounded-md transition-colors" :class="viewMode === 'list' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
            </button>
        </div>
        <button @click="handleAdd" class="text-sm font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs shrink-0">新增</button>
        <div class="relative shrink-0" ref="nodesMoreMenuRef">
          <button @click="showNodesMoreMenu = !showNodesMoreMenu" class="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
          </button>
           <Transition name="slide-fade-sm">
            <div v-if="showNodesMoreMenu" class="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-10 ring-1 ring-black ring-opacity-5">
              <button @click="handleImport" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">导入订阅</button>
              <button @click="handleAutoSort" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">一键排序</button>
              <button @click="handleDeduplicate" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">一键去重</button>
              <button @click="handleToggleSort" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                {{ isSorting ? '完成排序' : '手动排序' }}
              </button>
              <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button @click="handleDeleteAll" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">清空所有</button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
    <div v-if="manualNodes.length > 0">
      <div v-if="viewMode === 'card'">
         <draggable 
          v-if="isSorting"
          tag="div" 
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3" 
          :list="manualNodes" 
          item-key="id" 
          animation="300" 
          @end="handleSortEnd"
        >
          <template #item="{ element: node }">
             <div class="cursor-move">
                <ManualNodeCard 
                    :node="node" 
                    @edit="handleEdit(node.id)" 
                    @delete="handleDelete(node.id)" />
            </div>
          </template>
        </draggable>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          <div v-for="node in paginatedManualNodes" :key="node.id">
            <ManualNodeCard 
              :node="node" 
              @edit="handleEdit(node.id)" 
              @delete="handleDelete(node.id)" />
          </div>
        </div>
      </div>

      <div v-if="viewMode === 'list'" class="space-y-2">
          <ManualNodeList
              v-for="(node, index) in paginatedManualNodes"
              :key="node.id"
              :node="node"
              :index="(currentPage - 1) * 24 + index + 1"
              @edit="handleEdit(node.id)"
              @delete="handleDelete(node.id)"
          />
      </div>
      
      <div v-if="totalPages > 1 && !isSorting" class="flex justify-center items-center space-x-4 mt-8 text-sm font-medium">
        <button @click="handleChangePage(currentPage - 1)" :disabled="currentPage === 1" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">&laquo; 上一页</button>
        <span class="text-gray-500 dark:text-gray-400">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button @click="handleChangePage(currentPage + 1)" :disabled="currentPage === totalPages" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">下一页 &raquo;</button>
      </div>
    </div>
    <div v-else class="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l-4 4-4-4M6 16l-4-4 4-4" /></svg><h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">没有手动节点</h3><p class="mt-1 text-sm text-gray-500">添加分享链接或单个节点。</p></div>
  </div>
</template>

<style scoped>
.cursor-move {
  cursor: move;
}
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
