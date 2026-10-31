<script setup>
    import { computed } from 'vue';
    import { useI18n } from '../../i18n/index.js';
    import SettingsLayout from '../layout/SettingsLayout.vue';
    import SettingsSidebar from './SettingsSidebar.vue';
    import BasicSettings from './sections/BasicSettings.vue';
    import HomeSettings from './sections/HomeSettings.vue';
    import GlobalSettings from './sections/GlobalSettings.vue';
    import ServiceSettings from './sections/ServiceSettings.vue';
    import ClientSettings from './sections/ClientSettings.vue';
    import CustomPageSettings from './sections/CustomPageSettings.vue';
    import WebdavBackupSettings from './sections/WebdavBackupSettings.vue';
    import SystemSettings from './sections/SystemSettings.vue';

    /**
     * 设置界面的共享内容区。
     *
     * 此前 SettingsView.vue（独立页面）与 SettingsPanel.vue（弹窗）各自实现了一份，
     * 约 90% 逐行相同，导致「弹窗漏渲染 custom-page」「弹窗漏传 handleReset」两个缺陷
     * —— 改了一边忘了另一边。现在两者的 section 列表、头部信息卡、加载态与保存按钮
     * 都收敛到这里，各自只保留外壳差异。
     *
     * 注意：useSettingsLogic() 是工厂函数（每次调用创建独立的 ref 状态），
     * 所以数据一律由父组件通过 props 传入，本组件不再自行调用，避免出现两份状态。
     */
    const { t } = useI18n();

    const props = defineProps({
        activeTab: {
            type: String,
            required: true,
        },
        settings: {
            type: Object,
            required: true,
        },
        disguiseConfig: {
            type: Object,
            default: () => ({}),
        },
        isLoading: {
            type: Boolean,
            default: false,
        },
        isSaving: {
            type: Boolean,
            default: false,
        },
        restartCountdown: {
            type: Number,
            default: null,
        },
        hasWhitespace: {
            type: Boolean,
            default: false,
        },
        isStorageTypeValid: {
            type: Boolean,
            default: true,
        },
        /** 独立页面用 ?focus= 深链定位字段时高亮；弹窗不使用 */
        highlightedFocusId: {
            type: String,
            default: '',
        },
        /** 弹窗内空间有限、没有页面级标题，头部信息卡需要常显；独立页面在移动端隐藏它 */
        alwaysShowHeader: {
            type: Boolean,
            default: false,
        },
        layoutClass: {
            type: String,
            default: 'h-full',
        },
        exportBackup: {
            type: Function,
            default: null,
        },
        importBackup: {
            type: Function,
            default: null,
        },
        handleReset: {
            type: Function,
            default: null,
        },
    });

    const emit = defineEmits(['update:activeTab', 'save', 'migrate', 'reload-now']);

    const activeTabModel = computed({
        get: () => props.activeTab,
        set: (value) => emit('update:activeTab', value),
    });

    const currentTabLabel = computed(() => {
        switch (props.activeTab) {
            case 'basic':
                return t('settings.tabs.basic');
            case 'home':
                return t('settings.tabs.home');
            case 'global':
                return t('settings.tabs.global');
            case 'service':
                return t('settings.tabs.service');
            case 'client':
                return t('settings.tabs.client');
            case 'custom-page':
                return t('settings.tabs.customPage');
            case 'system':
                return t('settings.tabs.system');
            default:
                return t('settings.title');
        }
    });

    const saveDisabled = computed(
        () => props.isSaving || props.hasWhitespace || !props.isStorageTypeValid
    );
</script>

<template>
    <SettingsLayout :class="layoutClass">
        <template #sidebar>
            <SettingsSidebar v-model:activeTab="activeTabModel" />
        </template>

        <div v-if="isLoading" class="text-center p-12">
            <svg
                class="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                ></circle>
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
            </svg>
            <p class="text-gray-500">{{ t('settings.loading') }}</p>
        </div>

        <div v-else class="space-y-6 max-w-6xl w-full mx-auto">
            <div
                class="flex-wrap items-center justify-between gap-3 p-4 bg-white/70 dark:bg-gray-900/60 border border-gray-100/80 dark:border-white/10 misub-radius-lg shadow-sm"
                :class="alwaysShowHeader ? 'flex' : 'hidden md:flex'"
            >
                <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ t('settings.currentModule') }}
                    </p>
                    <p class="text-lg font-semibold text-gray-900 dark:text-white">
                        {{ currentTabLabel }}
                    </p>
                </div>
                <div
                    class="text-xs text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 px-3 py-1.5 misub-radius-pill"
                >
                    {{ t('settings.saveHint') }}
                </div>
            </div>

            <div
                v-if="restartCountdown !== null"
                class="flex items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
                role="status"
                aria-live="polite"
            >
                <span>{{ t('settings.reloadCountdown', { seconds: restartCountdown }) }}</span>
                <button
                    type="button"
                    class="shrink-0 rounded-lg px-3 py-1.5 font-medium hover:bg-amber-100 dark:hover:bg-white/10"
                    @click="$emit('reload-now')"
                >
                    {{ t('settings.reloadNow') }}
                </button>
            </div>

            <BasicSettings
                v-show="activeTab === 'basic'"
                :settings="settings"
                :disguiseConfig="disguiseConfig"
                :highlighted-focus-id="highlightedFocusId"
            />
            <HomeSettings v-show="activeTab === 'home'" :settings="settings" />
            <GlobalSettings v-show="activeTab === 'global'" :settings="settings" />
            <ServiceSettings v-show="activeTab === 'service'" :settings="settings" />
            <ClientSettings v-show="activeTab === 'client'" />
            <CustomPageSettings v-show="activeTab === 'custom-page'" :settings="settings" />
            <div v-show="activeTab === 'system'" class="space-y-6">
                <WebdavBackupSettings :settings="settings" />
                <SystemSettings
                    :settings="settings"
                    :exportBackup="exportBackup"
                    :importBackup="importBackup"
                    :handleReset="handleReset"
                    @migrate="emit('migrate')"
                />
            </div>
        </div>

        <template #footer>
            <button
                @click="emit('save')"
                :disabled="saveDisabled"
                class="px-6 py-2.5 misub-radius-lg text-white text-sm font-medium shadow-sm transition-all flex items-center gap-2"
                :class="
                    isSaving
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 hover:shadow-md active:scale-95'
                "
            >
                <svg
                    v-if="isSaving"
                    class="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    ></circle>
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
                <span>{{ isSaving ? t('settings.saving') : t('settings.saveChanges') }}</span>
            </button>
        </template>
    </SettingsLayout>
</template>
