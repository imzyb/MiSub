<script setup>
import { computed } from 'vue';
import draggable from 'vuedraggable';
import Card from '../ui/Card.vue';
import MoreActionsMenu from '@/components/shared/MoreActionsMenu.vue';
import PanelPagination from '@/components/shared/PanelPagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const props = defineProps({
  subscriptions: { type: Array, default: () => [] },
  paginatedSubscriptions: Array,
  currentPage: Number,
  totalPages: Number,
  isSorting: Boolean,
});

const emit = defineEmits(['add', 'delete', 'changePage', 'updateNodeCount', 'edit', 'toggleSort', 'markDirty', 'preview', 'deleteAll', 'refreshAll', 'reorder', 'import', 'qrcode']);

const draggableSubscriptions = computed({
    get: () => [...props.subscriptions],
    set: (val) => emit('reorder', val)
});

const handleDelete = (id) => emit('delete', id);
const handleEdit = (id) => emit('edit', id);
const handleUpdate = (id) => emit('updateNodeCount', id);
const handlePreview = (id) => emit('preview', id);
const handleQRCode = (id) => emit('qrcode', id);
const handleAdd = () => emit('add');
const handleChangePage = (page) => emit('changePage', page);
const handleToggleSort = () => emit('toggleSort');
const handleSortEnd = () => emit('markDirty');
const handleDeleteAll = () => emit('deleteAll');
const handleRefreshAll = () => emit('refreshAll');
const handleImport = () => emit('import');
</script>

<template>
  <div>
    <div class="mb-4 bg-white/80 dark:bg-gray-900/60 border border-gray-100/80 dark:border-white/10 misub-radius-lg p-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-3 shrink-0">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">机场订阅</h2>
          <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ subscriptions.length }}</span>
        </div>
        <div class="flex items-center gap-2 sm:w-auto justify-end sm:justify-start">
          <slot name="actions-prepend"></slot>
          <button @click="handleImport" class="text-sm font-medium px-3 py-2 misub-radius-md border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-colors shadow-xs shrink-0">批量导入</button>
          <button @click="handleAdd" class="text-sm font-medium px-4 py-2 misub-radius-md bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-sm shadow-primary-500/20 shrink-0">新增</button>
          <MoreActionsMenu menu-width-class="w-36">
            <template #menu="{ close }">
              <button @click="handleRefreshAll(); close()" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                全部刷新
              </button>
              <button @click="handleToggleSort(); close()" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                {{ isSorting ? '完成排序' : '手动排序' }}
              </button>
              <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button @click="handleDeleteAll(); close()" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-500/10">清空所有</button>
            </template>
          </MoreActionsMenu>
        </div>
      </div>
    </div>
    <div v-if="subscriptions.length > 0">
      <draggable 
        v-if="isSorting" 
        tag="div" 
        class="grid grid-cols-1 md:grid-cols-2 gap-4" 
        v-model="draggableSubscriptions" 
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
                  @edit="handleEdit(subscription.id)"
                  @preview="handlePreview(subscription.id)"
                  @qrcode="handleQRCode(subscription.id)" />
          </div>
        </template>
      </draggable>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  @edit="handleEdit(subscription.id)"
                  @preview="handlePreview(subscription.id)"
                  @qrcode="handleQRCode(subscription.id)" />
          </div>
      </div>
      <PanelPagination
        v-if="totalPages > 1 && !isSorting"
        variant="panel"
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="subscriptions.length"
        :show-total-items="true"
        @change-page="handleChangePage"
      />
    </div>
    <div v-else class="py-6 border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/50 misub-radius-lg">
      <EmptyState 
        title="没有机场订阅" 
        description="从添加你的第一个订阅开始。" 
        icon="folder" 
        :total-count="0" 
      />
    </div>
  </div>
</template>

<style scoped>
.cursor-move {
  cursor: move;
}
</style>
