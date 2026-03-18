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
});

const emit = defineEmits(['add', 'edit', 'delete', 'deleteAll', 'toggle', 'openCopy', 'preview', 'reorder', 'changePage', 'viewLogs', 'qrcode']);

// [FIX] Compute profiles to display: use paginated if available, else all profiles
const displayProfiles = computed(() => {
  if (props.paginatedProfiles && props.paginatedProfiles.length > 0) {
    return props.paginatedProfiles;
  }
  // If explicitly paginated but empty, check if we have profiles at all.
  // In Dashboard mode, paginatedProfiles is undefined/empty, so we show all profiles.
  // In View mode with pagination, if page is empty it might be a bug or correct empty state.
  // Heuristic: If totalPages is passed, we rely on pagination logic.
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

const handleQRCode = (profileId) => emit('qrcode', profileId);

// [新增] 排序处理函数
const handleMoveUp = (index) => {
  if (index > 0) {
    emit('reorder', index, index - 1);
  }
};

const handleMoveDown = (index) => {
  if (index < props.profiles.length - 1) {
    emit('reorder', index, index + 1);
  }
};

</script>

<template>
  <div>
    <div class="list-item-animation mb-4" style="--delay-index: 0">
      <div class="bg-white/80 dark:bg-gray-900/60 border border-gray-100/80 dark:border-white/10 misub-radius-lg p-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3 shrink-0">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">我的订阅组</h2>
            <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ profiles.length }}</span>
          </div>
          <div class="flex items-center gap-2 sm:w-auto justify-end sm:justify-start">
            <button @click="handleAdd" class="text-sm font-medium px-4 py-2 misub-radius-md bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-sm shadow-primary-500/20 shrink-0">新增</button>
            <MoreActionsMenu :teleport-to-body="true" menu-width-class="w-36">
              <template #menu="{ close }">
                <button @click="handleDeleteAll(); close()" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-500/10">清空</button>
              </template>
            </MoreActionsMenu>
          </div>
        </div>
      </div>
    </div>
    <div v-if="profiles.length > 0">
      <div 
        class="grid gap-4" 
        :class="[paginatedProfiles && paginatedProfiles.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1']"
      >
        <div 
          v-for="(profile, index) in displayProfiles"
          :key="profile.id"
          class="list-item-animation"
          :style="{ '--delay-index': index + 1 }"
        >
          <ProfileCard
            :profile="profile"
            @edit="handleEdit(profile.id)"
            @delete="handleDelete(profile.id)"
            @change="handleToggle($event)"
            @preview="handlePreview(profile.id)"
            @qrcode="handleQRCode(profile.id)"
            @move-up="handleMoveUp(index)"
            @move-down="handleMoveDown(index)"
            @view-logs="emit('viewLogs', profile.id)"
            @open-copy="handleOpenCopy(profile.id)"
          />
        </div>
      </div>
      <PanelPagination
        v-if="totalPages > 1 && paginatedProfiles && paginatedProfiles.length > 0"
        variant="panel"
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="profiles.length"
        :show-total-items="true"
        @change-page="handleChangePage"
      />
    </div>
    <div v-else class="py-6 border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/50 misub-radius-lg">
      <EmptyState 
        title="没有订阅组" 
        description="创建一个订阅组来组合你的节点吧！" 
        icon="folder" 
        :total-count="0" 
      />
    </div>
  </div>
</template>
