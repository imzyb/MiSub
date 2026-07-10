<script setup>
import { ref } from 'vue';
import { api } from '../../../lib/http.js';
import { useToastStore } from '../../../stores/toast.js';
import { useI18n } from '../../../i18n/index.js';
import Input from '../../ui/Input.vue';

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
});

const { showToast } = useToastStore();
const { t } = useI18n();
const isTesting = ref(false);
const isBackingUp = ref(false);
const isRestoring = ref(false);
const isLoadingRemoteFiles = ref(false);
const remoteFiles = ref([]);

const ensureConfig = () => {
  if (!props.settings.webdavBackup) {
    props.settings.webdavBackup = {
      enabled: false,
      endpoint: '',
      username: '',
      password: '',
      remotePath: '/MiSub',
      filenameTemplate: 'misub-backup-{datetime}.json',
      backupScope: 'dataOnly',
      autoBackup: false,
      interval: 'daily',
      retentionCount: 7,
      lastCheckedAt: null,
      lastBackupAt: null,
      lastBackupStatus: null,
      lastBackupMessage: '',
      lastBackupFile: ''
    };
  }
  return props.settings.webdavBackup;
};

const testConnection = async () => {
  const config = ensureConfig();
  isTesting.value = true;
  try {
    const result = await api.post('/api/backup/webdav/test', { webdavBackup: config });
    if (!result.success) throw new Error(result.message || t('settings.webdavTestFailed'));
    showToast(result.message || t('settings.webdavTestSuccess'), 'success');
  } catch (error) {
    showToast(t('settings.webdavTestFailedWithMessage', { message: error.message }), 'error');
  } finally {
    isTesting.value = false;
  }
};

const runBackup = async () => {
  const config = ensureConfig();
  if (!confirm(t('settings.webdavRunBackupConfirm'))) return;
  isBackingUp.value = true;
  try {
    const result = await api.post('/api/backup/webdav/run', { scope: config.backupScope });
    if (!result.success) throw new Error(result.message || t('settings.webdavBackupFailed'));
    config.lastBackupAt = result.timestamp;
    config.lastBackupStatus = 'success';
    config.lastBackupMessage = result.message;
    config.lastBackupFile = result.file;
    showToast(t('settings.webdavBackupSuccess'), 'success');
  } catch (error) {
    showToast(t('settings.webdavBackupFailedWithMessage', { message: error.message }), 'error');
  } finally {
    isBackingUp.value = false;
  }
};

const restoreFromLocalFile = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      isRestoring.value = true;
      try {
        const payload = JSON.parse(e.target.result);
        const scope = payload?.scope || 'dataOnly';
        const label = scope === 'dataAndSettings' ? t('settings.webdavScopeDataAndSettings') : t('settings.webdavScopeDataOnly');
        if (!confirm(t('settings.webdavRestoreLocalConfirm', { scope: label }))) return;
        const result = await api.post('/api/backup/restore', { payload, scope });
        if (!result.success) throw new Error(result.message || t('settings.webdavRestoreFailed'));
        showToast(t('settings.webdavRestoreSuccessReload'), 'success');
        setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        showToast(t('settings.webdavRestoreFailedWithMessage', { message: error.message }), 'error');
      } finally {
        isRestoring.value = false;
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

const loadRemoteFiles = async () => {
  isLoadingRemoteFiles.value = true;
  try {
    const result = await api.get('/api/backup/webdav/list');
    if (!result.success) throw new Error(result.message || t('settings.webdavLoadRemoteFailed'));
    remoteFiles.value = Array.isArray(result.data) ? result.data : [];
    showToast(t('settings.webdavLoadRemoteSuccess', { count: remoteFiles.value.length }), 'success');
  } catch (error) {
    showToast(t('settings.webdavLoadRemoteFailedWithMessage', { message: error.message }), 'error');
  } finally {
    isLoadingRemoteFiles.value = false;
  }
};

const restoreRemoteFile = async (file) => {
  if (!file?.path) return;
  if (!confirm(t('settings.webdavRestoreRemoteConfirm', { name: file.name }))) return;
  isRestoring.value = true;
  try {
    const result = await api.post('/api/backup/webdav/restore', { file: file.path });
    if (!result.success) throw new Error(result.message || t('settings.webdavRestoreFailed'));
    showToast(t('settings.webdavRestoreRemoteSuccessReload'), 'success');
    setTimeout(() => window.location.reload(), 800);
  } catch (error) {
    showToast(t('settings.webdavRestoreRemoteFailedWithMessage', { message: error.message }), 'error');
  } finally {
    isRestoring.value = false;
  }
};

const copyCronHint = async () => {
  try {
    const text = `${window.location.origin}/cron`;
    await navigator.clipboard.writeText(text);
    showToast(t('settings.webdavCronCopied'), 'success');
  } catch {
    showToast(t('settings.webdavCronCopyFailed'), 'error');
  }
};

ensureConfig();
</script>

<template>
  <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
    <div class="mb-5 flex items-start gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0 0l-3-3m3 3l3-3" />
        </svg>
      </div>
      <div class="space-y-1">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.webdavTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.webdavDesc') }}</p>
      </div>
    </div>

    <div class="space-y-5">
      <label class="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
        <input type="checkbox" v-model="settings.webdavBackup.enabled" class="h-4 w-4 text-sky-600 rounded border-gray-300">
        {{ t('settings.webdavEnable') }}
      </label>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input :label="t('settings.webdavEndpoint')" v-model="settings.webdavBackup.endpoint" placeholder="https://dav.example.com/remote.php/dav/files/user" />
        <Input :label="t('settings.webdavRemotePath')" v-model="settings.webdavBackup.remotePath" placeholder="/MiSub" />
        <Input :label="t('settings.webdavUsername')" v-model="settings.webdavBackup.username" :placeholder="t('settings.webdavUsernamePlaceholder')" />
        <Input :label="t('settings.webdavPassword')" v-model="settings.webdavBackup.password" type="password" :placeholder="t('settings.webdavPasswordPlaceholder')" />
        <Input :label="t('settings.webdavFilenameTemplate')" v-model="settings.webdavBackup.filenameTemplate" placeholder="misub-backup-{datetime}.json" />
        <Input :label="t('settings.webdavRetentionCount')" v-model.number="settings.webdavBackup.retentionCount" type="number" min="1" max="100" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-lg border border-gray-200/70 dark:border-white/10 p-4 bg-white/60 dark:bg-white/5">
          <p class="text-sm font-medium text-gray-900 dark:text-white mb-3">{{ t('settings.webdavBackupScope') }}</p>
          <label class="flex items-start gap-3 mb-3 text-sm text-gray-700 dark:text-gray-200">
            <input type="radio" value="dataOnly" v-model="settings.webdavBackup.backupScope" class="mt-0.5">
            <span><strong>{{ t('settings.webdavScopeDataOnly') }}</strong><br><span class="text-xs text-gray-500">{{ t('settings.webdavScopeDataOnlyDesc') }}</span></span>
          </label>
          <label class="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
            <input type="radio" value="dataAndSettings" v-model="settings.webdavBackup.backupScope" class="mt-0.5">
            <span><strong>{{ t('settings.webdavScopeDataAndSettings') }}</strong><br><span class="text-xs text-gray-500">{{ t('settings.webdavScopeDataAndSettingsDesc') }}</span></span>
          </label>
        </div>

        <div class="rounded-lg border border-gray-200/70 dark:border-white/10 p-4 bg-white/60 dark:bg-white/5">
          <p class="text-sm font-medium text-gray-900 dark:text-white mb-3">{{ t('settings.webdavRequestAutoBackup') }}</p>
          <label class="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 mb-3">
            <input type="checkbox" v-model="settings.webdavBackup.autoBackup" class="h-4 w-4 text-sky-600 rounded border-gray-300">
            {{ t('settings.webdavEnableAutoBackup') }}
          </label>
          <select v-model="settings.webdavBackup.interval" class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 text-sm">
            <option value="hourly">{{ t('settings.webdavIntervalHourly') }}</option>
            <option value="daily">{{ t('settings.webdavIntervalDaily') }}</option>
            <option value="weekly">{{ t('settings.webdavIntervalWeekly') }}</option>
            <option value="monthly">{{ t('settings.webdavIntervalMonthly') }}</option>
          </select>
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.webdavAutoBackupHint') }}</p>
        </div>
      </div>

      <div class="rounded-lg bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/60 p-4 text-xs text-amber-800 dark:text-amber-200 leading-6">
        {{ t('settings.webdavSecurityHint') }}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div class="rounded-lg border border-gray-200/70 dark:border-white/10 p-4 bg-white/60 dark:bg-white/5">
          <p class="font-medium text-gray-900 dark:text-white mb-2">{{ t('settings.webdavRecentStatus') }}</p>
          <p class="text-gray-500 dark:text-gray-400">{{ t('settings.webdavLastChecked') }}：{{ settings.webdavBackup.lastCheckedAt || t('settings.webdavNotChecked') }}</p>
          <p class="text-gray-500 dark:text-gray-400">{{ t('settings.webdavLastBackup') }}：{{ settings.webdavBackup.lastBackupAt || t('settings.webdavNotBackedUp') }}</p>
          <p class="text-gray-500 dark:text-gray-400">{{ t('settings.webdavLastResult') }}：{{ settings.webdavBackup.lastBackupStatus || t('settings.webdavNone') }}</p>
          <p class="text-gray-500 dark:text-gray-400 break-all">{{ t('settings.webdavLastFile') }}：{{ settings.webdavBackup.lastBackupFile || t('settings.webdavNone') }}</p>
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <button @click="testConnection" :disabled="isTesting" class="px-4 py-2 text-sm font-medium text-white rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50">{{ isTesting ? t('settings.webdavTesting') : t('settings.webdavTestConnection') }}</button>
          <button @click="runBackup" :disabled="isBackingUp" class="px-4 py-2 text-sm font-medium text-white rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50">{{ isBackingUp ? t('settings.webdavBackingUp') : t('settings.webdavRunBackup') }}</button>
          <button @click="restoreFromLocalFile" :disabled="isRestoring" class="px-4 py-2 text-sm font-medium text-white rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50">{{ isRestoring ? t('settings.webdavRestoring') : t('settings.webdavRestoreFromFile') }}</button>
          <button @click="loadRemoteFiles" :disabled="isLoadingRemoteFiles" class="px-4 py-2 text-sm font-medium text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{{ isLoadingRemoteFiles ? t('settings.webdavLoadingRemote') : t('settings.webdavLoadRemote') }}</button>
          <button @click="copyCronHint" class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10">{{ t('settings.webdavCopyCron') }}</button>
        </div>
      </div>

      <div v-if="remoteFiles.length" class="rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4">
        <p class="text-sm font-medium text-gray-900 dark:text-white mb-3">{{ t('settings.webdavRemoteFiles') }}</p>
        <div class="space-y-2 max-h-56 overflow-y-auto">
          <div v-for="file in remoteFiles" :key="file.path" class="flex items-center justify-between gap-3 rounded-lg border border-gray-100 dark:border-white/10 px-3 py-2">
            <span class="text-xs text-gray-600 dark:text-gray-300 break-all">{{ file.name }}</span>
            <button @click="restoreRemoteFile(file)" :disabled="isRestoring" class="shrink-0 px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50">{{ t('settings.webdavRestore') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
