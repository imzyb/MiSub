import { useToastStore } from '../stores/toast.js';
import { api } from '../lib/http.js';
import { t } from '../i18n/index.js';

/**
 * 备份和恢复逻辑 composable
 *
 * 本地导出/导入与 WebDAV 备份/恢复共用后端统一备份格式：
 * - dataOnly：订阅/手动节点/订阅组/自定义规则模板
 * - dataAndSettings：dataOnly + 设置（后端会排除 WebDAV 配置本身和运行密钥）
 */
export function useBackupLogic() {
    const { showToast } = useToastStore();

    const downloadJson = (data, filename) => {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * 导出本地备份。
     * 默认导出“仅数据”，避免把设置/Token 带入普通本地备份；WebDAV UI 可单独选择范围。
     */
    const exportBackup = async (scope = 'dataOnly') => {
        try {
            const result = await api.post('/api/backup/export', { scope });
            if (!result?.success || !result.exportData) {
                throw new Error(result?.message || t('backup.exportFailed'));
            }
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
            downloadJson(result.exportData, `misub-backup-${result.exportData.scope || scope}-${timestamp}.json`);
            showToast(t('backup.exportSuccess'), 'success');
        } catch (error) {
            console.error('Backup export failed:', error);
            showToast(t('backup.exportFailedWithMessage', { message: error.message }), 'error');
        }
    };

    /**
     * 导入本地备份。
     * 后端执行集合级恢复，不会清空整个 KV/D1；旧版本地备份格式也由后端兼容。
     */
    const importBackup = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const scope = data?.scope || 'dataOnly';
                    const scopeLabel = scope === 'dataAndSettings' ? t('backup.scopeDataAndSettings') : t('backup.scopeDataOnly');
                    const message = t('backup.restoreConfirm', { scope: scopeLabel });
                    if (!confirm(message)) return;

                    const result = await api.post('/api/backup/restore', { payload: data, scope });
                    if (!result?.success) {
                        throw new Error(result?.message || t('backup.restoreFailed'));
                    }
                    showToast(t('backup.restoreSuccess'), 'success');
                    setTimeout(() => window.location.reload(), 800);
                } catch (err) {
                    showToast(t('backup.importFailedWithMessage', { message: err.message }), 'error');
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
