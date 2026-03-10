<script setup>
import { ref, onMounted } from 'vue';
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

// 组件挂载时加载设置
onMounted(() => {
  loadSettings();
});

// 暴露 handleSave 给父组件
defineExpose({ handleSave });
</script>

<template>
  <div class="w-full h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden bg-white/50 dark:bg-gray-900/50 rounded-b-xl -mx-6 mb-[-24px] mt-[-16px]">
    <SettingsLayout class="h-full !shadow-none !border-0 !rounded-none !bg-transparent">
      <template #sidebar>
        <SettingsSidebar v-model:activeTab="activeTab" />
      </template>

      <div v-if="isLoading" class="text-center p-8">
        <p class="text-gray-500">正在加载设置...</p>
      </div>
      <div v-else class="space-y-6 max-w-4xl pt-2">
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
