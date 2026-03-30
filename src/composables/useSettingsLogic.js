import { ref, computed } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { DEFAULT_SETTINGS } from '../constants/default-settings.js';
import { fetchSettings, saveSettings } from '../lib/api.js';
import { useBackupLogic } from './useBackupLogic.js';

/**
 * 设置页面的核心逻辑 composable
 * 用于 SettingsView.vue 和 SettingsPanel.vue 的代码复用
 */
export function useSettingsLogic() {
    const { showToast } = useToastStore();

    // 使用备份 composable
    const { exportBackup, importBackup } = useBackupLogic();

    // ========== 状态定义 ==========
    const settings = ref({ ...DEFAULT_SETTINGS });
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
        const fieldsCheck = ['FileName', 'mytoken', 'profileToken', 'subConverter', 'subConfig', 'BotToken', 'ChatID'];
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
                settings.value = { ...DEFAULT_SETTINGS, ...incoming };

                // 初始化前缀配置
                // 初始化伪装配置
                if (settings.value.disguise) {
                    disguiseConfig.value = {
                        enabled: settings.value.disguise.enabled ?? false,
                        pageType: settings.value.disguise.pageType ?? 'default',
                        redirectUrl: settings.value.disguise.redirectUrl ?? ''
                    };
                }

                // 确保 storageType 有默认值
                if (!settings.value.storageType) {
                    settings.value.storageType = 'kv';
                }
            } else {
                showToast(`加载设置失败: ${result.error}`, 'error');
                settings.value = { ...DEFAULT_SETTINGS };
            }
        } catch (error) {
            showToast('加载设置失败', 'error');
            settings.value = { ...DEFAULT_SETTINGS };
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * 保存设置到 API
     */
    const handleSave = async () => {
        if (hasWhitespace.value) {
            showToast('输入项中不能包含空格', 'error');
            return;
        }
        if (!isStorageTypeValid.value) {
            showToast('存储类型设置无效', 'error');
            return;
        }

        isSaving.value = true;
        try {
            if (!settings.value.storageType) settings.value.storageType = 'kv';

            const settingsToSave = {
                ...settings.value,
                disguise: disguiseConfig.value
            };

            delete settingsToSave.prefixConfig;
            delete settingsToSave.prependSubName;
            delete settingsToSave.nodeTransform;

            const result = await saveSettings(settingsToSave);
            if (result.success) {
                showToast('设置已保存，页面将自动刷新...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(result.error || '保存失败');
            }
        } catch (error) {
            showToast(error.message, 'error');
            isSaving.value = false;
        }
    };

    /**
     * 处理 D1 迁移成功
     */
    const handleMigrationSuccess = () => {
        showMigrationModal.value = false;
        settings.value.storageType = 'd1';
        showToast('数据迁移成功！系统已切换为 D1 存储', 'success');
    };

    // 备份函数由 useBackupLogic 提供

    // ========== 返回值 ==========
    return {
        // 状态
        settings,
        disguiseConfig,
        isLoading,
        isSaving,
        showMigrationModal,
        // 计算属性
        hasWhitespace,
        isStorageTypeValid,
        // 函数
        loadSettings,
        handleSave,
        handleMigrationSuccess,
        exportBackup,
        importBackup,
    };
}
