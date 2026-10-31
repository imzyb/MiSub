<script setup>
    import { ref, onMounted } from 'vue';
    import MigrationModal from './MigrationModal.vue';
    import { useSettingsLogic } from '../../composables/useSettingsLogic.js';
    import SettingsContent from '../settings/SettingsContent.vue';

    const {
        settings,
        disguiseConfig,
        isLoading,
        isSaving,
        showMigrationModal,
        restartCountdown,
        hasWhitespace,
        isStorageTypeValid,
        loadSettings,
        handleSave,
        handleMigrationSuccess,
        handleReset,
        exportBackup,
        importBackup,
    } = useSettingsLogic();

    const activeTab = ref('basic');

    // 组件挂载时加载设置
    onMounted(() => {
        loadSettings();
    });

    const handleSaveAndReturnStatus = async () => {
        return handleSave();
    };

    // 暴露 handleSave 给父组件
    defineExpose({ handleSave: handleSaveAndReturnStatus });
</script>

<template>
    <div
        class="w-full h-full min-h-[520px] overflow-hidden bg-white/50 dark:bg-gray-900/50 misub-radius-lg"
    >
        <SettingsContent
            v-model:activeTab="activeTab"
            :settings="settings"
            :disguise-config="disguiseConfig"
            :is-loading="isLoading"
            :is-saving="isSaving"
            :restart-countdown="restartCountdown"
            :has-whitespace="hasWhitespace"
            :is-storage-type-valid="isStorageTypeValid"
            :export-backup="exportBackup"
            :import-backup="importBackup"
            :handle-reset="handleReset"
            always-show-header
            layout-class="h-full !shadow-none !border-0 !rounded-none !bg-transparent"
            @save="handleSave"
            @reload-now="() => window.location.reload()"
            @migrate="showMigrationModal = true"
        />

        <MigrationModal v-model:show="showMigrationModal" @success="handleMigrationSuccess" />
    </div>
</template>

<style scoped></style>
