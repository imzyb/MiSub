<script setup>
    import { ref, computed } from 'vue';
    import Modal from '../forms/Modal.vue';
    import { migrateToD1 } from '../../lib/api.js';
    import { useToastStore } from '../../stores/toast.js';
    import { useI18n } from '../../i18n/index.js';

    const props = defineProps({
        show: Boolean,
    });

    const emit = defineEmits(['update:show', 'success']);
    const { showToast } = useToastStore();
    const { t } = useI18n();

    const isMigrating = ref(false);
    const logs = ref([]);
    const step = ref('check'); // check, migrating, done, error

    const addLog = (message, type = 'info') => {
        const time = new Date().toLocaleTimeString();
        logs.value.unshift({ time, message, type });
    };

    const handleMigrate = async () => {
        step.value = 'migrating';
        isMigrating.value = true;
        logs.value = [];

        addLog(t('d1Migration.logStart'));
        addLog(t('d1Migration.logConnecting'));

        try {
            const result = await migrateToD1();

            if (result.success) {
                addLog(t('d1Migration.logConnected'), 'success');

                if (result.details) {
                    if (result.details.subscriptions)
                        addLog(t('d1Migration.logSubscriptionsOk'), 'success');
                    else addLog(t('d1Migration.logSubscriptionsSkipped'), 'warning');

                    if (result.details.profiles) addLog(t('d1Migration.logProfilesOk'), 'success');
                    else addLog(t('d1Migration.logProfilesSkipped'), 'warning');

                    if (result.details.settings) addLog(t('d1Migration.logSettingsOk'), 'success');
                    else addLog(t('d1Migration.logSettingsSkipped'), 'warning');
                }

                addLog(t('d1Migration.logAllDone'), 'success');
                step.value = 'done';
                emit('success');
            } else {
                addLog(t('d1Migration.logMigrateFailed', { message: result.message }), 'error');
                if (result.details && Array.isArray(result.details)) {
                    result.details.forEach((err) =>
                        addLog(t('d1Migration.logErrorDetail', { detail: err }), 'error')
                    );
                }
                throw new Error(result.message || t('d1Migration.migrateFailed'));
            }
        } catch (err) {
            step.value = 'error';
            addLog(t('d1Migration.logException', { message: err.message }), 'error');
            addLog(t('d1Migration.hintCheckSchema'), 'warning');
            addLog(t('d1Migration.hintRunSchema'), 'warning');
            addLog(t('d1Migration.hintCheckBinding'), 'warning');
            showToast(t('d1Migration.toastMigrateFailed', { message: err.message }), 'error');
        } finally {
            isMigrating.value = false;
            addLog(t('d1Migration.logFinished'), 'info');
        }
    };

    const handleClose = () => {
        emit('update:show', false);
        // Reset state after close
        setTimeout(() => {
            step.value = 'check';
            logs.value = [];
            isMigrating.value = false;
        }, 300);
    };

    const confirmText = computed(() => {
        if (step.value === 'check') return t('systemSettings.startMigration');
        if (step.value === 'migrating') return t('d1Migration.migrating');
        return t('d1Migration.done');
    });

    const handleConfirm = () => {
        if (step.value === 'check') {
            handleMigrate();
        } else if (step.value === 'done' || step.value === 'error') {
            handleClose();
        }
    };

    const getLogClass = (type) => {
        switch (type) {
            case 'success':
                return 'text-green-400';
            case 'error':
                return 'text-red-400';
            case 'warning':
                return 'text-yellow-400';
            default:
                return 'text-gray-500 dark:text-gray-400';
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
            showToast(t('d1Migration.copyFailed'), 'error');
        }
    };
</script>

<template>
    <Modal
        :show="show"
        @update:show="handleClose"
        @confirm="handleConfirm"
        size="2xl"
        :confirm-disabled="isMigrating"
        :confirm-text="confirmText"
        :cancel-text="t('common.close')"
    >
        <template #title>
            <div class="flex items-center gap-2">
                <span class="text-lg font-bold text-gray-900 dark:text-white">{{
                    t('d1Migration.title')
                }}</span>
                <span v-if="step === 'migrating'" class="flex h-3 w-3 relative">
                    <span
                        class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"
                    ></span>
                    <span class="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
            </div>
        </template>

        <template #body>
            <div class="h-[400px] flex flex-col">
                <!-- Step 1: Checklist -->
                <div v-if="step === 'check'" class="flex-1 space-y-4">
                    <div
                        class="bg-blue-50 dark:bg-blue-900/20 p-4 misub-radius-md border border-blue-100 dark:border-blue-800"
                    >
                        <h4 class="font-medium text-blue-800 dark:text-blue-300 mb-2">
                            {{ t('d1Migration.precheckHeading') }}
                        </h4>
                        <p class="text-sm text-blue-600 dark:text-blue-400 mb-4 leading-relaxed">
                            {{ t('d1Migration.introText') }}<br />
                            {{ t('d1Migration.confirmChecklist') }}
                        </p>
                        <ul class="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                            <li class="flex items-start gap-2">
                                <input
                                    type="checkbox"
                                    checked
                                    disabled
                                    class="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                    aria-hidden="true"
                                />
                                <span>{{ t('d1Migration.stepCreateDb') }}</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <input
                                    type="checkbox"
                                    checked
                                    disabled
                                    class="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                    aria-hidden="true"
                                />
                                <span
                                    >{{ t('d1Migration.stepBindDbPrefix') }}
                                    <code>MISUB_DB</code>
                                    {{ t('d1Migration.stepBindDbSuffix') }}</span
                                >
                            </li>
                            <li class="flex items-start gap-2">
                                <input
                                    type="checkbox"
                                    class="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus-visible:ring-indigo-500"
                                    aria-hidden="true"
                                />
                                <div class="flex flex-col gap-1">
                                    <span
                                        class="font-medium text-orange-600 dark:text-orange-400"
                                        >{{ t('d1Migration.stepRunSchema') }}</span
                                    >
                                    <button
                                        @click="copySchema"
                                        class="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors w-fit"
                                    >
                                        <svg
                                            class="w-3 h-3"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                                            />
                                        </svg>
                                        {{ t('d1Migration.copySchemaButton') }}
                                    </button>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div class="text-xs text-gray-500 text-center">
                        {{ t('d1Migration.confirmNotice') }}
                    </div>
                </div>

                <!-- Step 2 & 3: Logs -->
                <div v-else class="flex-1 flex flex-col min-h-0">
                    <div
                        class="bg-gray-900 misub-radius-md p-4 font-mono text-xs overflow-y-auto flex-1 custom-scrollbar shadow-inner border border-gray-700"
                    >
                        <div v-if="logs.length === 0" class="text-gray-500 text-center mt-10">
                            {{ t('d1Migration.waiting') }}
                        </div>
                        <div v-for="(log, idx) in logs" :key="idx" class="mb-1.5 break-all">
                            <span class="opacity-50 text-gray-500 mr-2">[{{ log.time }}]</span>
                            <span :class="getLogClass(log.type)">{{ log.message }}</span>
                        </div>
                    </div>

                    <div
                        v-if="step === 'done'"
                        class="mt-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded border border-green-200 dark:border-green-800 text-sm flex items-center gap-2"
                    >
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        <span>{{ t('d1Migration.successNotice') }}</span>
                    </div>

                    <div
                        v-if="step === 'error'"
                        class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800 text-sm flex items-center gap-2"
                    >
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <span>{{ t('d1Migration.errorNotice') }}</span>
                    </div>
                </div>
            </div>
        </template>
    </Modal>
</template>

<style scoped>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: var(--color-slate-800);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: var(--color-slate-600);
        border-radius: 3px;
    }
</style>
