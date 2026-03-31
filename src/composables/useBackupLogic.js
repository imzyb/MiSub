import { useDataStore } from '../stores/useDataStore.js';
import { useToastStore } from '../stores/toast.js';
import { storeToRefs } from 'pinia';
import { useManualNodes } from './useManualNodes.js';

/**
 * 备份和恢复逻辑 composable
 * 提供统一的数据备份和恢复功能
 * 用于设置模块、Dashboard 等所有需要备份功能的地方
 */
export function useBackupLogic() {
    const dataStore = useDataStore();
    const { showToast } = useToastStore();
    const { subscriptions, profiles } = storeToRefs(dataStore);
    const { manualNodes } = useManualNodes(() => { });

    /**
     * 导出备份
     * 将订阅、手动节点和配置文件导出为 JSON 文件
     */
    const exportBackup = () => {
        try {
            const backupData = {
                subscriptions: (subscriptions.value || []).filter(item => item.url && /^https?:\/\//.test(item.url)),
                manualNodes: (manualNodes.value || []),
                profiles: profiles.value || [],
            };

            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
            a.download = `misub-backup-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('备份已成功导出', 'success');
        } catch (error) {
            console.error('Backup export failed:', error);
            showToast('备份导出失败', 'error');
        }
    };

    /**
     * 导入备份
     * 从 JSON 文件恢复订阅、手动节点和配置文件
     */
    const importBackup = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data || !Array.isArray(data.subscriptions)) {
                        throw new Error('无效的备份文件格式');
                    }

                    if (confirm('确定要从备份中恢复吗？所有当前数据将被覆盖。')) {
                        const merged = [...(data.subscriptions || []), ...(data.manualNodes || [])];
                        dataStore.overwriteSubscriptions(merged);
                        dataStore.overwriteProfiles(data.profiles || []);
                        dataStore.markDirty();
                        showToast('数据已恢复,请保存', 'success');
                    }
                } catch (err) {
                    showToast('导入失败: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    return {
        exportBackup,
        importBackup,
    };
}
