<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import draggable from 'vuedraggable';
import Card from './Card.vue';

const props = defineProps({
  subscriptions: Array,
  paginatedSubscriptions: Array,
  currentPage: Number,
  totalPages: Number,
  isSorting: Boolean,
});

const emit = defineEmits(['add', 'delete', 'changePage', 'updateNodeCount', 'edit', 'toggleSort', 'markDirty']);

const subsMoreMenuRef = ref(null);
const showSubsMoreMenu = ref(false);

const handleDelete = (id) => emit('delete', id);
const handleEdit = (id) => emit('edit', id);
const handleUpdate = (id) => emit('updateNodeCount', id);
const handleAdd = () => emit('add');
const handleChangePage = (page) => emit('changePage', page);
const handleToggleSort = () => {
  emit('toggleSort');
  showSubsMoreMenu.value = false;
};
const handleSortEnd = () => emit('markDirty');
const handleDeleteAll = () => {
  emit('deleteAll');
  showSubsMoreMenu.value = false;
}

// 添加点击外部关闭下拉菜单的功能
const handleClickOutside = (event) => {
  if (subsMoreMenuRef.value && !subsMoreMenuRef.value.contains(event.target)) {
    showSubsMoreMenu.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">机场订阅</h2>
        <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ subscriptions.length }}</span>
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
        <button @click="handleAdd" class="text-sm font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs shrink-0">新增</button>
        <div class="relative shrink-0" ref="subsMoreMenuRef">
          <button @click="showSubsMoreMenu = !showSubsMoreMenu" class="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
          </button>
          <Transition name="slide-fade-sm">
            <div v-if="showSubsMoreMenu" class="absolute right-0 mt-2 w-36 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg dark:shadow-2xl z-50 ring-1 ring-black/5">
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
    <div v-if="subscriptions.length > 0">
      <draggable 
        v-if="isSorting" 
        tag="div" 
        class="grid grid-cols-1 md:grid-cols-2 gap-5" 
        :list="subscriptions" 
        item-key="id"
        animation="300" 
        @end="handleSortEnd">
        <template #item="{ element: subscription }">
          <div class="cursor-move">
              <Card 
                  :misub="subscription" 
                  @delete="handleDelete(subscription.id)" 
                  @change="handleSortEnd" 
                  @update="handleUpdate(subscription.id)" 
                  @edit="handleEdit(subscription.id)" />
          </div>
        </template>
      </draggable>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div 
              v-for="(subscription, index) in paginatedSubscriptions"
              :key="subscription.id"
              class="list-item-animation"
              :style="{ '--delay-index': index }"
          >   
              <Card 
                  :misub="subscription" 
                  @delete="handleDelete(subscription.id)" 
                  @change="handleSortEnd" 
                  @update="handleUpdate(subscription.id)" 
                  @edit="handleEdit(subscription.id)" />
          </div>
      </div>
      <div v-if="totalPages > 1 && !isSorting" class="flex justify-center items-center space-x-4 mt-8 text-sm font-medium">
          <button @click="handleChangePage(currentPage - 1)" :disabled="currentPage === 1" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">&laquo; 上一页</button>
          <span class="text-gray-500 dark:text-gray-400">第 {{ currentPage }} / {{ totalPages }} 页</span>
          <button @click="handleChangePage(currentPage + 1)" :disabled="currentPage === totalPages" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">下一页 &raquo;</button>
      </div>
    </div>
    <div v-else class="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg><h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">没有机场订阅</h3><p class="mt-1 text-sm text-gray-500">从添加你的第一个订阅开始。</p></div>
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
