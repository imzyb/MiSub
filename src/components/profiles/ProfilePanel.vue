<script setup>
import { computed } from 'vue';
import ProfileCard from './ProfileCard.vue';
import MoreActionsMenu from '@/components/shared/MoreActionsMenu.vue';
import PanelHeader from '@/components/shared/PanelHeader.vue';
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
    <div class="list-item-animation" style="--delay-index: 0">
      <PanelHeader title="我的订阅组" :count="profiles.length">
        <template #actions>
          <button @click="handleAdd" class="text-sm font-medium px-4 py-2 misub-radius-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-sm shadow-primary-500/20 shrink-0">新增</button>
          <MoreActionsMenu :teleport-to-body="true" menu-width-class="w-36">
            <template #menu="{ close }">
              <button @click="handleDeleteAll(); close()" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-500/10">清空</button>
            </template>
          </MoreActionsMenu>
        </template>
      </PanelHeader>
    </div>
    <div v-if="profiles.length > 0">
      <div 
        class="grid gap-5" 
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
        :current-page="currentPage"
        :total-pages="totalPages"
        @change-page="handleChangePage"
      />
    </div>
    <div v-else class="py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 misub-radius-lg">
      <EmptyState 
        title="没有订阅组" 
        description="创建一个订阅组来组合你的节点吧！" 
        icon="folder" 
        :total-count="0" 
      />
    </div>
  </div>
</template>
