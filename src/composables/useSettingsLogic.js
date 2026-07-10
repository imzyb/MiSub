import { ref, computed } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { DEFAULT_SETTINGS } from '../constants/default-settings.js';
import { fetchSettings, saveSettings, resetSettings } from '../lib/api.js';
import { useBackupLogic } from './useBackupLogic.js';
import { t } from '../i18n/index.js';

function normalizeExternalApiConfig(value) {
    const defaults = DEFAULT_SETTINGS.externalApi;
    const externalApi = value && typeof value === 'object' ? value : {};
    const tokens = Array.isArray(externalApi.tokens)
        ? externalApi.tokens
            .map((item, index) => ({
                name: String(item?.name || `token-${index + 1}`).trim() || `token-${index + 1}`,
                token: String(item?.token || '').trim()
            }))
            .filter((item) => item.token || item.name)
        : [];

    return {
        ...defaults,
        ...externalApi,
        tokens: tokens.length > 0 ? tokens : defaults.tokens.map((item) => ({ ...item }))
    };
}

function normalizeSettingsObject(source = {}) {
    const merged = { ...DEFAULT_SETTINGS, ...source };
    merged.externalApi = normalizeExternalApiConfig(source.externalApi ?? merged.externalApi);
    return merged;
}

/**
 * 设置页面的核心逻辑 composable
 * 用于 SettingsView.vue 和 SettingsPanel.vue 的代码复用
 */
export function useSettingsLogic() {
    const { showToast } = useToastStore();

    // 使用备份 composable
    const { exportBackup, importBackup } = useBackupLogic();

    // ========== 状态定义 ==========
    const settings = ref(normalizeSettingsObject(DEFAULT_SETTINGS));
    const isLoading = ref(false);
    const isSaving = ref(false);
    const showMigrationModal = ref(false);

    // 嵌套配置对象
    const disguiseConfig = ref({
        enabled: false,
        pageType: 'default',
        redirectUrl: ''
    });


    // ========== 计算属性 ==========
    const hasWhitespace = computed(() => {
        const fieldsCheck = ['FileName', 'mytoken', 'profileToken', 'transformConfig', 'BotToken', 'ChatID'];
        for (const key of fieldsCheck) {
            if (settings.value[key] && /\s/.test(settings.value[key])) return true;
        }
        return false;
    });

    const isStorageTypeValid = computed(() => ['kv', 'd1'].includes(settings.value.storageType));

    // ========== 核心函数 ==========

    /**
     * 从 API 加载设置
     */
    const loadSettings = async () => {
        isLoading.value = true;
        try {
            const result = await fetchSettings();
            if (result.success) {
                const incoming = result.data && typeof result.data === 'object' ? result.data : {};
                settings.value = normalizeSettingsObject(incoming);

                if (settings.value.disguise) {
                    disguiseConfig.value = {
                        enabled: settings.value.disguise.enabled ?? false,
                        pageType: settings.value.disguise.pageType ?? 'default',
                        redirectUrl: settings.value.disguise.redirectUrl ?? ''
                    };
                }

                if (!settings.value.storageType) {
                    settings.value.storageType = 'kv';
                }
            } else {
                showToast(t('settings.loadFailedWithMessage', { message: result.error }), 'error');
                settings.value = normalizeSettingsObject(DEFAULT_SETTINGS);
            }
        } catch (error) {
            showToast(t('settings.loadFailed'), 'error');
            settings.value = normalizeSettingsObject(DEFAULT_SETTINGS);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * 保存设置到 API
     */
    const handleSave = async () => {
        if (hasWhitespace.value) {
            showToast(t('settings.noWhitespace'), 'error');
            return false;
        }
        if (!isStorageTypeValid.value) {
            showToast(t('settings.invalidStorageType'), 'error');
            return false;
        }

        isSaving.value = true;
        try {
            if (!settings.value.storageType) settings.value.storageType = 'kv';
            settings.value.externalApi = normalizeExternalApiConfig(settings.value.externalApi);

            const settingsToSave = {
                ...settings.value,
                externalApi: normalizeExternalApiConfig(settings.value.externalApi),
                disguise: disguiseConfig.value
            };

            settingsToSave.ruleLevel = settingsToSave.ruleLevel || settingsToSave.clashRuleLevel || 'std';

            delete settingsToSave.prefixConfig;
            delete settingsToSave.prependSubName;
            delete settingsToSave.nodeTransform;
            delete settingsToSave.clashRuleLevel;

            const result = await saveSettings(settingsToSave);
            if (result.success) {
                showToast(t('settings.savedReloading'), 'success');
                setTimeout(() => window.location.reload(), 1500);
                return true;
            } else {
                throw new Error(result.error || t('settings.saveFailed'));
            }
        } catch (error) {
            showToast(error.message, 'error');
            return false;
        } finally {
            isSaving.value = false;
        }
    };

    /**
     * 处理 D1 迁移成功
     */
    const handleMigrationSuccess = () => {
        showMigrationModal.value = false;
        settings.value.storageType = 'd1';
        showToast(t('settings.migrationSuccess'), 'success');
    };

    /**
     * 处理恢复出厂设置
     */
    const handleReset = async () => {
        if (!confirm(t('settings.resetConfirm'))) {
            return;
        }
        
        if (!confirm(t('settings.resetConfirmAgain'))) {
            return;
        }

        isLoading.value = true;
        try {
            const result = await resetSettings();
            if (result.success) {
                showToast(t('settings.resetSuccess'), 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast(t('settings.resetFailedWithMessage', { message: result.error }), 'error');
            }
        } catch (error) {
            showToast(t('settings.resetRequestFailed'), 'error');
        } finally {
            isLoading.value = false;
        }
    };

    return {
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
        handleReset,
        exportBackup,
        importBackup,
    };
}
