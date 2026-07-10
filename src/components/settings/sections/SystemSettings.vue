<script setup>
import { ref } from 'vue';
import { useToastStore } from '../../../stores/toast.js';
import Input from '../../ui/Input.vue';
import Switch from '../../ui/Switch.vue';
import { useI18n } from '../../../i18n/index.js';

const props = defineProps({
    settings: {
        type: Object,
        required: true
    },
    exportBackup: Function,
    importBackup: Function,
    handleReset: Function
});

const { showToast } = useToastStore();
const { t } = useI18n();

const passwordForm = ref({
  newPassword: '',
  confirmPassword: ''
});
const isUpdatingPassword = ref(false);

const ensureExternalApiDefaults = (settings) => {
  if (!settings.externalApi || typeof settings.externalApi !== 'object') {
    settings.externalApi = { enabled: false, tokens: [{ name: 'default', token: '' }] };
    return;
  }

  if (!Array.isArray(settings.externalApi.tokens) || settings.externalApi.tokens.length === 0) {
    settings.externalApi.tokens = [{ name: 'default', token: '' }];
    return;
  }

  settings.externalApi.tokens = settings.externalApi.tokens.map((item, index) => ({
    name: String(item?.name || `token-${index + 1}`).trim() || `token-${index + 1}`,
    token: String(item?.token || '').trim()
  }));
};

const buildExternalApiToken = () => {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(18);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
};

ensureExternalApiDefaults(props.settings);

const handleGenerateExternalApiToken = (settings) => {
  ensureExternalApiDefaults(settings);
  settings.externalApi.tokens[0].token = buildExternalApiToken();
  showToast(t('systemSettings.externalApiTokenGenerated'), 'success');
};

const handleCopyExternalApiToken = async (settings) => {
  ensureExternalApiDefaults(settings);
  const token = settings.externalApi.tokens[0]?.token || '';
  if (!token) {
    showToast(t('systemSettings.externalApiTokenEmpty'), 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(token);
    showToast(t('systemSettings.externalApiTokenCopied'), 'success');
  } catch (error) {
    showToast(t('systemSettings.copyFailedManual'), 'error');
  }
};

const handleUpdatePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    showToast(t('systemSettings.passwordMismatch'), 'error');
    return;
  }
  if (passwordForm.value.newPassword.length < 6) {
    showToast(t('systemSettings.passwordTooShort'), 'error');
    return;
  }

  isUpdatingPassword.value = true;
  try {
    const res = await fetch('/api/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordForm.value.newPassword })
    });
    const data = await res.json();
    if (data.success) {
      showToast(t('systemSettings.passwordUpdated'), 'success');
      passwordForm.value.newPassword = '';
      passwordForm.value.confirmPassword = '';
    } else {
      showToast(data.error || t('systemSettings.updateFailed'), 'error');
    }
  } catch (e) {
    showToast(t('systemSettings.requestFailed', { message: e.message }), 'error');
  } finally {
    isUpdatingPassword.value = false;
  }
};

const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_at ON subscriptions(updated_at);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);`;

const copySchema = async () => {
    try {
        await navigator.clipboard.writeText(SCHEMA_SQL);
        showToast(t('systemSettings.schemaCopied'), 'success');
    } catch (err) {
        showToast(t('systemSettings.copyFailedManual'), 'error');
    }
};

const emit = defineEmits(['migrate']);
</script>

<template>
    <div class="space-y-8">
        <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
            <div class="mb-5 flex items-start gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('systemSettings.storageTypeTitle') }}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('systemSettings.storageTypeDesc') }}</p>
                </div>
            </div>
            <div class="space-y-3">
                <div class="flex items-center">
                    <input type="radio" value="kv" v-model="settings.storageType" class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800">
                    <span class="ml-3 text-sm dark:text-gray-300">{{ t('systemSettings.kvStorage') }}</span>
                </div>
                <div class="flex items-center">
                    <input type="radio" value="d1" v-model="settings.storageType" class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800">
                    <span class="ml-3 text-sm dark:text-gray-300">{{ t('systemSettings.d1DatabaseRecommended') }}</span>
                </div>

                <div v-if="settings.storageType === 'kv'" class="mt-4 p-4 bg-blue-50/80 dark:bg-blue-900/20 misub-radius-lg border border-blue-100/80 dark:border-blue-800/60">
                    <h4 class="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{{ t('systemSettings.migrateToD1') }}</h4>
                    <p class="text-xs text-blue-600 dark:text-blue-400 mb-3">{{ t('systemSettings.d1MigrationDesc') }}</p>
                    <ol class="list-decimal list-inside text-xs text-blue-600 dark:text-blue-400 mb-3 space-y-1">
                        <li><span v-html="t('systemSettings.d1StepCreate')"></span></li>
                        <li><span v-html="t('systemSettings.d1StepSchema')"></span></li>
                        <li>{{ t('systemSettings.d1StepMigrate') }}</li>
                    </ol>
                    <div class="flex flex-col sm:flex-row gap-3">
                        <button @click="emit('migrate')" class="px-4 py-2 text-sm font-medium text-white misub-radius-lg transition-colors duration-200 bg-blue-600 hover:bg-blue-700 flex items-center justify-center min-w-[120px] shadow-sm">
                            {{ t('systemSettings.startMigration') }}
                        </button>
                        <button @click="copySchema" class="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white/80 dark:bg-gray-900/60 border border-blue-200 dark:border-blue-700/70 misub-radius-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2 shadow-sm">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            {{ t('systemSettings.copySchemaSql') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
            <div class="mb-5 flex items-start gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1V7a5 5 0 00-10 0v4H6a2 2 0 00-2 2v6a2 2 0 002 2h6z" />
                    </svg>
                </div>
                <div class="space-y-1 flex-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('systemSettings.externalApiTitle') }}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('systemSettings.externalApiDesc') }}</p>
                </div>
                <Switch v-model="settings.externalApi.enabled" @update:modelValue="ensureExternalApiDefaults(settings)" />
            </div>

            <div class="space-y-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-900/30 dark:bg-violet-900/10">
                <p class="text-xs leading-5 text-violet-700 dark:text-violet-300">{{ t('systemSettings.externalApiHint') }}</p>
                <p class="text-xs leading-5 text-gray-500 dark:text-gray-400">{{ t('systemSettings.externalApiPathHint') }}</p>

                <div class="grid gap-4 md:grid-cols-2">
                    <Input
                      :label="t('systemSettings.externalApiTokenName')"
                      v-model="settings.externalApi.tokens[0].name"
                      :placeholder="t('systemSettings.externalApiTokenNamePlaceholder')"
                    />
                    <Input
                      :label="t('systemSettings.externalApiTokenValue')"
                      v-model="settings.externalApi.tokens[0].token"
                      :placeholder="t('systemSettings.externalApiTokenValuePlaceholder')"
                    />
                </div>

                <div class="flex flex-wrap gap-3">
                    <button @click="handleGenerateExternalApiToken(settings)" class="px-4 py-2 text-sm font-medium text-white rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors">
                        {{ t('systemSettings.externalApiGenerateToken') }}
                    </button>
                    <button @click="handleCopyExternalApiToken(settings)" class="px-4 py-2 text-sm font-medium rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/30 transition-colors">
                        {{ t('systemSettings.externalApiCopyToken') }}
                    </button>
                </div>
            </div>
        </div>

        <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
            <div class="mb-5 flex items-start gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('systemSettings.backupRestoreTitle') }}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('systemSettings.backupRestoreDesc') }}</p>
                </div>
            </div>
            <div class="flex gap-4">
                <button @click="exportBackup" class="px-4 py-2 text-sm font-medium text-white misub-radius-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700">{{ t('systemSettings.exportBackup') }}</button>
                <button @click="importBackup" class="px-4 py-2 text-sm font-medium text-white misub-radius-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-600">{{ t('systemSettings.importBackup') }}</button>
            </div>
        </div>

        <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
            <div class="mb-5 flex items-start gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('systemSettings.adminSecurityTitle') }}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('systemSettings.adminSecurityDesc') }}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/70 dark:bg-gray-900/50 p-6 misub-radius-lg border border-gray-200/70 dark:border-white/10">
                <div class="space-y-4">
                <div>
                    <Input :label="t('systemSettings.newPassword')" v-model="passwordForm.newPassword" type="password" :placeholder="t('systemSettings.newPasswordPlaceholder')" class="misub-radius-lg" />
                </div>
                <div>
                    <Input :label="t('systemSettings.confirmPassword')" v-model="passwordForm.confirmPassword" type="password" :placeholder="t('systemSettings.confirmPasswordPlaceholder')" class="misub-radius-lg" />
                </div>
                </div>
                <div class="flex items-end">
                <button @click="handleUpdatePassword" :disabled="isUpdatingPassword || !passwordForm.newPassword" class="px-6 py-2.5 misub-radius-lg text-white text-sm font-medium shadow-sm transition-all flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    <svg v-if="isUpdatingPassword" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{{ isUpdatingPassword ? t('systemSettings.updating') : t('systemSettings.updatePassword') }}</span>
                </button>
                </div>
            </div>
        </div>

        <div class="rounded-xl border border-red-200/60 bg-red-50/30 p-6 shadow-sm dark:border-red-900/30 dark:bg-red-900/10">
            <div class="mb-5 flex items-start gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-base font-semibold text-red-900 dark:text-red-300">{{ t('systemSettings.dangerZoneTitle') }}</h3>
                    <p class="text-sm text-red-600/80 dark:text-red-400/80">{{ t('systemSettings.dangerZoneDesc') }}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/50 dark:bg-gray-900/40 p-6 misub-radius-lg border border-red-100 dark:border-red-900/20">
                <div class="space-y-2">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">{{ t('systemSettings.factoryResetTitle') }}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400"><span v-html="t('systemSettings.factoryResetDesc')"></span></p>
                </div>
                <div class="flex items-center sm:justify-end">
                    <button @click="handleReset" class="px-5 py-2.5 misub-radius-lg text-red-600 dark:text-red-400 text-sm font-medium border border-red-200 dark:border-red-900/50 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white transition-all active:scale-95">
                        {{ t('systemSettings.factoryResetTitle') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
