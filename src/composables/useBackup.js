import { useSessionStore } from '../stores/session';
import { useToastStore } from '../stores/toast';

export function useBackup() {
  const sessionStore = useSessionStore();
  const { showToast } = useToastStore();

  const exportBackup = () => {
    try {
      const backupData = {
        subscriptions: sessionStore.subscriptions,
        manualNodes: sessionStore.manualNodes,
        profiles: sessionStore.profiles,
        // 可以选择性地添加其他需要备份的设置
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

  const importBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const backupData = JSON.parse(e.target.result);

          // 数据验证
          if (!backupData || !Array.isArray(backupData.subscriptions) || !Array.isArray(backupData.manualNodes) || !Array.isArray(backupData.profiles)) {
            throw new Error('无效的备份文件格式');
          }

          if (confirm('这将覆盖您当前的所有数据，确定要从备份中恢复吗？')) {
            sessionStore.$patch({
              subscriptions: backupData.subscriptions,
              manualNodes: backupData.manualNodes,
              profiles: backupData.profiles,
            });
            // 可能需要触发一个动作来保存这些数据到后端
            sessionStore.markAllDirty(); 
            showToast('数据恢复成功，正在保存...', 'success');
            // 可以在这里添加一个保存到后端的调用
          }
        } catch (error) {
          console.error('Backup import failed:', error);
          showToast(`备份导入失败: ${error.message}`, 'error');
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
