<script setup>
import { computed } from 'vue';
import draggable from 'vuedraggable';
import Card from '../ui/Card.vue';
import MoreActionsMenu from '@/components/shared/MoreActionsMenu.vue';
import PanelPagination from '@/components/shared/PanelPagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { useUIStore } from '@/stores/ui';

const { layoutMode } = useUIStore();

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

const enabledCount = computed(() => props.subscriptions.filter(sub => sub.enabled).length);

const totalNodeCount = computed(() => props.subscriptions.reduce((total, sub) => total + (Number(sub.nodeCount) || 0), 0));

const attentionCount = computed(() => props.subscriptions.filter(sub => {
  if (sub.isUpdating || sub.lastError) return true;
  const expire = sub.userInfo?.expire;
  if (!expire) return false;
  const daysRemaining = Math.ceil(((expire * 1000) - Date.now()) / (24 * 60 * 60 * 1000));
  return daysRemaining <= 7;
}).length);

const statusHint = computed(() => {
  if (props.subscriptions.length === 0) return '添加后可预览节点、刷新流量与生成二维码';
  if (attentionCount.value > 0) return '含到期/异常/刷新中';
  return '状态正常';
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
    <div class="mb-4 rounded-xl border border-gray-100/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <div class="flex items-center gap-3 shrink-0">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">机场订阅</h2>
            <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">{{ subscriptions.length }}</span>
          </div>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">维护少量机场源，优先关注可用性、节点数与到期/异常状态。</p>
          <div v-if="subscriptions.length > 0" class="mt-3 flex flex-wrap gap-2 text-xs">
            <span class="rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">启用 {{ enabledCount }}/{{ subscriptions.length }}</span>
            <span class="rounded-full border border-primary-200/70 bg-primary-50 px-2.5 py-1 font-medium text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300">节点 {{ totalNodeCount }}</span>
            <span class="rounded-full border px-2.5 py-1 font-medium" :class="attentionCount > 0 ? 'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300' : 'border-gray-200/70 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'">待处理 {{ attentionCount }}</span>
            <span class="rounded-full border border-gray-200/70 bg-gray-50 px-2.5 py-1 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">{{ statusHint }}</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:w-auto justify-end sm:justify-start">
          <slot name="actions-prepend"></slot>
          <button @click="handleImport" class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">批量导入</button>
          <button @click="handleAdd" class="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700">新增</button>
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
    <div v-else class="rounded-xl border border-dashed border-gray-300 bg-white/60 py-6 dark:border-gray-700 dark:bg-gray-900/50">
      <EmptyState 
        title="没有机场订阅" 
        description="从单个机场订阅开始；如果手上有多条链接，也可以一次性批量导入。" 
        icon="folder" 
        :total-count="0" 
      />
      <div class="-mt-8 mb-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button data-testid="empty-add-subscription" @click="handleAdd" class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30">添加机场订阅</button>
        <button data-testid="empty-import-subscriptions" @click="handleImport" class="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10">批量导入</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cursor-move {
  cursor: move;
}
</style>
