<script setup>
import { ref, onMounted, computed } from 'vue';
import MigrationModal from './MigrationModal.vue';
import { useSettingsLogic } from '../../composables/useSettingsLogic.js';
import SettingsLayout from '../layout/SettingsLayout.vue';

// 导入侧边栏和设置组件
import SettingsSidebar from '../settings/SettingsSidebar.vue';
import BasicSettings from '../settings/sections/BasicSettings.vue';
import HomeSettings from '../settings/sections/HomeSettings.vue';
import ServiceSettings from '../settings/sections/ServiceSettings.vue';
import GlobalSettings from '../settings/sections/GlobalSettings.vue';


import ClientSettings from '../settings/sections/ClientSettings.vue';
import SystemSettings from '../settings/sections/SystemSettings.vue';

const {
  settings,
  disguiseConfig,
  isLoading,
  isSaving,
  showMigrationModal,
  hasWhitespace,
  isStorageTypeValid,
  loadSettings,
  handleSave,
  handleMigrationSuccess,
  exportBackup,
  importBackup,
} = useSettingsLogic();

// 添加标签页状态 (与新布局一致)
const activeTab = ref('basic');

const currentTabLabel = computed(() => {
  switch (activeTab.value) {
    case 'basic': return '基础设置';
    case 'home': return '首页设置';
    case 'global': return '全局设置';
    case 'service': return '服务集成';
    case 'client': return '客户端管理';
    case 'system': return '系统设置';
    default: return '设置';
  }
});

// 组件挂载时加载设置
onMounted(() => {
  loadSettings();
});

// 暴露 handleSave 给父组件
defineExpose({ handleSave });
</script>

<template>
  <div class="w-full h-full min-h-[520px] overflow-hidden bg-white/50 dark:bg-gray-900/50 misub-radius-lg">
    <SettingsLayout class="h-full !shadow-none !border-0 !rounded-none !bg-transparent">
      <template #sidebar>
        <SettingsSidebar v-model:activeTab="activeTab" />
      </template>

      <div v-if="isLoading" class="text-center p-8">
        <p class="text-gray-500">正在加载设置...</p>
      </div>
      <div v-else class="space-y-6 max-w-6xl w-full mx-auto pt-2">
        <div class="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/70 dark:bg-gray-900/60 border border-gray-100/80 dark:border-white/10 misub-radius-lg shadow-sm">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">当前模块</p>
            <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ currentTabLabel }}</p>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 px-3 py-1.5 misub-radius-pill">
            修改后记得点击右下角保存
          </div>
        </div>
        <BasicSettings v-show="activeTab === 'basic'" :settings="settings" :disguiseConfig="disguiseConfig" />
        <HomeSettings v-show="activeTab === 'home'" :settings="settings" />
        <GlobalSettings v-show="activeTab === 'global'" :settings="settings" />
        <ServiceSettings v-show="activeTab === 'service'" :settings="settings" />
        <ClientSettings v-show="activeTab === 'client'" />
        <div v-show="activeTab === 'system'" class="space-y-6">
          <SystemSettings 
            :settings="settings" 
            :exportBackup="exportBackup" 
            :importBackup="importBackup" 
            @migrate="showMigrationModal = true" 
          />
        </div>
      </div>

      <template #footer>
        <button @click="handleSave" :disabled="isSaving || hasWhitespace || !isStorageTypeValid"
          class="px-6 py-2.5 misub-radius-lg text-white text-sm font-medium shadow-sm transition-all flex items-center gap-2"
          :class="isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 hover:shadow-md active:scale-95'">
          <svg v-if="isSaving" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ isSaving ? '保存中...' : '保存修改' }}</span>
        </button>
      </template>
    </SettingsLayout>

    <MigrationModal v-model:show="showMigrationModal" @success="handleMigrationSuccess" />
  </div>
</template>

<style scoped>

</style>



