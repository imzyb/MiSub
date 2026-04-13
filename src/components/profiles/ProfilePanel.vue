<script setup>
import { computed } from 'vue';
import ProfileCard from './ProfileCard.vue';
import MoreActionsMenu from '@/components/shared/MoreActionsMenu.vue';
import PanelPagination from '@/components/shared/PanelPagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const props = defineProps({
  profiles: Array,
  paginatedProfiles: {
    type: Array,
    default: () => []
  },
  currentPage: Number,
  totalPages: Number,
  isSorting: {
    type: Boolean,
    default: false,
  },
  compact: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['add', 'edit', 'delete', 'deleteAll', 'toggle', 'openCopy', 'preview', 'reorder', 'changePage', 'viewLogs', 'qrcode', 'toggle-sort']);

const displayProfiles = computed(() => {
  if (props.isSorting) {
    return props.profiles || [];
  }

  if (props.paginatedProfiles && props.paginatedProfiles.length > 0) {
    return props.paginatedProfiles;
  }

  if (props.totalPages !== undefined) {
      return props.paginatedProfiles || [];
  }
  return props.profiles || [];
});

const handleEdit = (profileId) => emit('edit', profileId);
const handleDelete = (profileId) => emit('delete', profileId);
const handleToggle = (event) => emit('toggle', event);
const handleOpenCopy = (profileId) => emit('openCopy', profileId);
const handlePreview = (profileId) => emit('preview', profileId);
const handleAdd = () => emit('add');
const handleChangePage = (page) => emit('changePage', page);
const handleDeleteAll = () => emit('deleteAll');
const handleToggleSort = () => emit('toggle-sort');

const handleQRCode = (profileId) => emit('qrcode', profileId);

// 始终基于真实 profile id 排序，避免分页视图把页内索引用到全量列表上。
const handleMoveUp = (profileId) => {
  const index = props.profiles.findIndex(profile => profile.id === profileId || profile.customId === profileId);
  if (index > 0) {
    emit('reorder', profileId, 'up');
  }
};

const handleMoveDown = (profileId) => {
  const index = props.profiles.findIndex(profile => profile.id === profileId || profile.customId === profileId);
  if (index !== -1 && index < props.profiles.length - 1) {
    emit('reorder', profileId, 'down');
  }
};

</script>

<template>
  <div>
    <div class="list-item-animation mb-4" style="--delay-index: 0">
      <div class="rounded-xl border border-gray-100/80 bg-white/85 shadow-sm dark:border-white/10 dark:bg-gray-900/70" :class="compact ? 'p-3' : 'p-4'">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3 shrink-0">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">我的订阅组</h2>
            <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">{{ profiles.length }}</span>
          </div>
          <div class="flex items-center gap-2 sm:w-auto justify-end sm:justify-start">
            <button @click="handleAdd" class="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700">新增</button>
            <MoreActionsMenu :teleport-to-body="true" menu-width-class="w-36">
              <template #menu="{ close }">
                <button @click="handleToggleSort(); close()" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {{ isSorting ? '完成排序' : '手动排序' }}
                </button>
                <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                <button @click="handleDeleteAll(); close()" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-500/10">清空</button>
              </template>
            </MoreActionsMenu>
          </div>
        </div>
      </div>
    </div>
    <div v-if="profiles.length > 0">
      <div v-if="isSorting" class="mb-4 rounded-xl border border-indigo-200/70 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
        当前为排序模式，已显示全部订阅组。使用卡片右下角的上下箭头调整顺序，完成后点击“完成排序”。
      </div>
      <div class="grid gap-4" :class="compact ? 'grid-cols-1' : (displayProfiles.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')">
        <div 
          v-for="(profile, index) in displayProfiles"
          :key="profile.id"
          class="list-item-animation"
          :style="{ '--delay-index': index + 1 }"
        >
          <ProfileCard
            :profile="profile"
            :is-sorting="isSorting"
            :compact="compact"
            @edit="handleEdit(profile.id)"
            @delete="handleDelete(profile.id)"
            @change="handleToggle($event)"
            @preview="handlePreview(profile.id)"
            @qrcode="handleQRCode(profile.id)"
            @move-up="handleMoveUp(profile.id)"
            @move-down="handleMoveDown(profile.id)"
            @view-logs="emit('viewLogs', profile.id)"
            @open-copy="handleOpenCopy(profile.id)"
          />
        </div>
      </div>
      <PanelPagination
        v-if="!isSorting && totalPages > 1 && paginatedProfiles && paginatedProfiles.length > 0"
        variant="panel"
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="profiles.length"
        :show-total-items="true"
        @change-page="handleChangePage"
      />
    </div>
    <div v-else class="rounded-xl border border-dashed border-gray-300 bg-white/60 py-6 dark:border-gray-700 dark:bg-gray-900/50">
      <EmptyState 
        title="没有订阅组" 
        description="创建一个订阅组来组合你的节点吧！" 
        icon="folder" 
        :total-count="0" 
      />
    </div>
  </div>
</template>
