<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import ProfileCard from './ProfileCard.vue';

const props = defineProps({
  profiles: Array,
});

const emit = defineEmits(['add', 'edit', 'delete', 'deleteAll', 'toggle', 'copyLink']);

const showProfilesMoreMenu = ref(false);
const profilesMoreMenuRef = ref(null);
const menuRef = ref(null);

const handleEdit = (profileId) => emit('edit', profileId);
const handleDelete = (profileId) => emit('delete', profileId);
const handleToggle = (event) => emit('toggle', event);
const handleCopyLink = (profileId) => emit('copyLink', profileId);
const handleAdd = () => emit('add');
const handleDeleteAll = () => {
  emit('deleteAll');
  showProfilesMoreMenu.value = false;
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
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4 list-item-animation" style="--delay-index: 0">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">我的订阅组</h2>
        <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ profiles.length }}</span>
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
        <button @click="handleAdd" class="text-sm font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs shrink-0">新增</button>
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
    <div v-if="profiles.length > 0" class="space-y-4" style="z-index: 1; position: relative;">
      <ProfileCard
        v-for="(profile, index) in profiles"
        :key="profile.id"
        :profile="profile"
        class="list-item-animation"
        :style="{ '--delay-index': index + 1 }"
        @edit="handleEdit(profile.id)"
        @delete="handleDelete(profile.id)"
        @change="handleToggle($event)"
        @copy-link="handleCopyLink(profile.id)"
      />
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