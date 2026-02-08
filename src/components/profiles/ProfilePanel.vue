<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import ProfileCard from './ProfileCard.vue';

const props = defineProps({
  profiles: Array,
  paginatedProfiles: {
    type: Array,
    default: () => []
  },
  currentPage: Number,
  totalPages: Number,
});

const emit = defineEmits(['add', 'edit', 'delete', 'deleteAll', 'toggle', 'copyLink', 'copyClashLink', 'preview', 'reorder', 'changePage', 'viewLogs', 'qrcode']);

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

const showProfilesMoreMenu = ref(false);
const profilesMoreMenuRef = ref(null);
const menuRef = ref(null);

const handleEdit = (profileId) => emit('edit', profileId);
const handleDelete = (profileId) => emit('delete', profileId);
const handleToggle = (event) => emit('toggle', event);
const handleCopyLink = (profileId) => emit('copyLink', profileId);
const handleCopyClashLink = (profileId) => emit('copyClashLink', profileId);
const handlePreview = (profileId) => emit('preview', profileId);
const handleAdd = () => emit('add');
const handleChangePage = (page) => emit('changePage', page);
const handleDeleteAll = () => {
  emit('deleteAll');
  showProfilesMoreMenu.value = false;
};

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

// 计算菜单位置
const getMenuPosition = () => {
  if (profilesMoreMenuRef.value) {
    const buttonRect = profilesMoreMenuRef.value.getBoundingClientRect();
    return {
      top: `${buttonRect.bottom}px`,
      right: `${window.innerWidth - buttonRect.right}px`
    };
  }
  return {};
};

// 添加点击外部关闭下拉菜单的功能
const handleClickOutside = (event) => {
  // 检查是否点击在菜单容器内
  const isClickInContainer = profilesMoreMenuRef.value && profilesMoreMenuRef.value.contains(event.target);
  // 检查是否点击在菜单内
  const isClickInMenu = menuRef.value && menuRef.value.contains(event.target);
  
  if (!isClickInContainer && !isClickInMenu) {
    showProfilesMoreMenu.value = false;
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
    <div class="flex flex-row items-center justify-between mb-4 gap-4 list-item-animation" style="--delay-index: 0">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">我的订阅组</h2>
        <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ profiles.length }}</span>
      </div>
      <div class="flex items-center gap-2 sm:w-auto justify-end sm:justify-start">
        <button @click="handleAdd" class="text-sm font-medium px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-sm shadow-primary-500/20 shrink-0">新增</button>
        <div class="relative shrink-0" ref="profilesMoreMenuRef">
          <button @click="showProfilesMoreMenu = !showProfilesMoreMenu" class="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
          </button>
          <!-- 使用Teleport渲染到body，完全避免层级冲突 -->
          <Teleport to="body">
            <Transition name="slide-fade-sm">
              <div 
                v-if="showProfilesMoreMenu" 
                ref="menuRef"
                class="fixed w-36 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg dark:shadow-2xl ring-1 ring-black/5"
                style="z-index: 999999;"
                :style="getMenuPosition()"
                @click.stop
              >
                <button @click="handleDeleteAll" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">清空</button>
              </div>
            </Transition>
          </Teleport>
        </div>
      </div>
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
            @copy-link="handleCopyLink(profile.id)"
            @copy-clash-link="handleCopyClashLink(profile.id)"
          />
        </div>
      </div>
      <div v-if="totalPages > 1 && paginatedProfiles && paginatedProfiles.length > 0" class="flex justify-center items-center space-x-4 mt-8 text-sm font-medium">
          <button @click="handleChangePage(currentPage - 1)" :disabled="currentPage === 1" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">&laquo; 上一页</button>
          <span class="text-gray-500 dark:text-gray-400">第 {{ currentPage }} / {{ totalPages }} 页</span>
          <button @click="handleChangePage(currentPage + 1)" :disabled="currentPage === totalPages" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">下一页 &raquo;</button>
      </div>
    </div>
    <div v-else class="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
      <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">没有订阅组</h3>
      <p class="mt-1 text-sm text-gray-500">创建一个订阅组来组合你的节点吧！</p>
    </div>
  </div>
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
