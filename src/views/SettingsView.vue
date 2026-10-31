<script setup>
    import { ref, onMounted, onActivated, onUnmounted, watch, nextTick } from 'vue';
    import { useRoute } from 'vue-router';
    import { useI18n } from '../i18n/index.js';
    import MigrationModal from '../components/modals/MigrationModal.vue';
    import { useSettingsLogic } from '../composables/useSettingsLogic.js';
    import SettingsContent from '../components/settings/SettingsContent.vue';
    import {
        resolveSettingsFocusTab,
        resolveSettingsFocusAnchor,
    } from '../utils/dashboard-deeplink.js';

    // 使用 composable 获取所有设置相关的状态和函数
    const { t } = useI18n();

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
    const route = useRoute();

    // --- Dashboard deep-link focus (?focus=mytoken / profileToken) ---
    // The dashboard's "去设置 Token" buttons land here with `?focus=`. Without
    // this the query was ignored and the user had to hunt for the field.
    const highlightedFocusId = ref('');
    let highlightTimer = null;

    function applyFocusFromQuery() {
        const focus = route.query?.focus;
        const tab = resolveSettingsFocusTab(focus);
        if (!tab) return;

        activeTab.value = tab;

        const anchorId = resolveSettingsFocusAnchor(focus);
        if (!anchorId) return;

        // Highlight immediately so the state is authoritative; scrolling needs
        // the tab's DOM to exist, so that part waits for the next tick.
        highlightedFocusId.value = anchorId;
        clearTimeout(highlightTimer);
        highlightTimer = setTimeout(() => {
            highlightedFocusId.value = '';
        }, 2400);

        nextTick(() => {
            const target =
                typeof document !== 'undefined' ? document.getElementById(anchorId) : null;
            target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        });
    }

    const handleOpenMigrationModal = () => {
        showMigrationModal.value = true;
    };

    onMounted(() => {
        loadSettings();
        applyFocusFromQuery();
    });

    onActivated(() => {
        loadSettings();
        applyFocusFromQuery();
    });

    // A deep link can arrive while the view is already mounted (e.g. navigating
    // from the dashboard twice), so react to query changes too.
    watch(
        () => route.query.focus,
        () => applyFocusFromQuery()
    );

    watch(
        () => route.path,
        (path) => {
            if (path === '/settings' && !resolveSettingsFocusTab(route.query?.focus)) {
                activeTab.value = 'basic';
                loadSettings();
            }
        }
    );

    onUnmounted(() => {
        clearTimeout(highlightTimer);
    });
</script>

<template>
    <div class="pt-0 pb-6 min-h-[calc(100vh-80px)]">
        <div
            class="mb-4 bg-white/80 dark:bg-gray-900/60 border border-gray-100/80 dark:border-white/10 misub-radius-lg p-4"
        >
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ t('settings.title') }}
            </h1>
        </div>

        <SettingsContent
            v-model:activeTab="activeTab"
            :settings="settings"
            :disguise-config="disguiseConfig"
            :is-loading="isLoading"
            :is-saving="isSaving"
            :restart-countdown="restartCountdown"
            :has-whitespace="hasWhitespace"
            :is-storage-type-valid="isStorageTypeValid"
            :highlighted-focus-id="highlightedFocusId"
            :export-backup="exportBackup"
            :import-backup="importBackup"
            :handle-reset="handleReset"
            layout-class="h-full"
            @save="handleSave"
            @reload-now="() => window.location.reload()"
            @migrate="handleOpenMigrationModal"
        />

        <MigrationModal v-model:show="showMigrationModal" @success="handleMigrationSuccess" />
    </div>
</template>
