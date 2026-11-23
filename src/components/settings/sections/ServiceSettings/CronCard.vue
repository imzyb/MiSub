<script setup>
    import { ref, computed, onUnmounted } from 'vue';
    import { useI18n } from '../../../../i18n/index.js';
    import { useToastStore } from '../../../../stores/toast.js';
    import { copyTextToClipboard } from '../../../../utils/clipboard.js';

    const { t } = useI18n();
    const { showToast } = useToastStore();

    // 复制成功后的短暂状态：除 toast 外再给按钮一个可见的“已复制”反馈
    const cronCopied = ref(false);
    let cronCopiedTimer = null;

    const props = defineProps({
        settings: {
            type: Object,
            required: true,
        },
    });

    // 折叠状态
    const showCronGuide = ref(false);

    // Cron 只在 D1 + 节点持久化开启时可用；它是独立于自动刷新间隔的强制刷新通道。
    const cronAvailable = computed(() => {
        const config = props.settings || {};
        const capabilities = config.capabilities || {};
        return capabilities.available === true && config.enableNodePersistence === true;
    });
    const cronUnavailableReason = computed(() => {
        if (cronAvailable.value) return '';
        const capabilities = props.settings?.capabilities || {};
        if (!capabilities.hasD1) return t('settings.cronUnavailableNoD1');
        return t('settings.cronUnavailableNoPersistence');
    });

    // Cron URL
    const cronUrl = computed(() => {
        const secret = props.settings.cronSecret;
        if (!secret) {
            return '';
        }
        return `${window.location.origin}/cron?secret=${encodeURIComponent(secret)}`;
    });

    const cronHeaderCommand = computed(() => {
        const secret = props.settings.cronSecret;
        if (!secret) {
            return '';
        }
        return `curl -H "Authorization: Bearer ${secret.replace(/"/g, '\\"')}" ${window.location.origin}/cron`;
    });

    // 复制 Cron URL：必须有明确反馈，否则用户点击后会觉得“按钮没反应”
    async function copyCronUrl() {
        if (!cronUrl.value) {
            showToast(t('settings.cronEmptyHint'), 'error');
            return;
        }

        const success = await copyTextToClipboard(cronUrl.value);
        if (!success) {
            showToast(t('notices.copyFailed'), 'error');
            return;
        }

        showToast(t('notices.copied'), 'success');
        cronCopied.value = true;
        clearTimeout(cronCopiedTimer);
        cronCopiedTimer = setTimeout(() => {
            cronCopied.value = false;
        }, 1600);
    }

    onUnmounted(() => {
        clearTimeout(cronCopiedTimer);
    });
</script>

<template>
    <!-- {{ t('settings.cronTitle') }} 卡片 -->
    <div
        class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300"
    >
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
                <h3
                    class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5 text-amber-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    {{ t('settings.cronTitle') }}
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ t('settings.cronDesc') }}
                </p>
                <p
                    v-if="cronUnavailableReason"
                    class="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                    data-testid="cron-unavailable-reason"
                >
                    {{ cronUnavailableReason }}
                </p>
                <p
                    v-else
                    class="mt-1 text-xs text-emerald-600 dark:text-emerald-400"
                    data-testid="cron-available-hint"
                >
                    {{ t('settings.cronAvailableHint') }}
                </p>
            </div>
            <button
                @click="showCronGuide = !showCronGuide"
                class="shrink-0 whitespace-nowrap pt-1 text-blue-600 hover:text-blue-500 text-xs font-medium"
            >
                {{ showCronGuide ? t('settings.cronHideGuide') : t('settings.cronShowGuide') }}
            </button>
        </div>

        <!-- Cron Secret 输入框 -->
        <div :class="{ 'opacity-60': !cronAvailable }">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >Cron Secret</label
            >
            <input
                type="text"
                v-model="settings.cronSecret"
                :disabled="!cronAvailable"
                :placeholder="t('settings.cronSecretPlaceholder')"
                class="block w-full px-3 py-2.5 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/40 focus:border-blue-500 sm:text-sm dark:text-white transition-colors"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('settings.cronSecretHint') }}
            </p>
        </div>

        <!-- Cron 访问链接（自动生成） -->
        <div v-if="cronUrl && cronAvailable" class="space-y-3">
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('settings.cronCompatibleUrl') }}
                </label>
                <div class="flex misub-radius-lg shadow-xs">
                    <input
                        type="text"
                        :value="cronUrl"
                        readonly
                        class="flex-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-l-xl sm:text-sm dark:text-white font-mono text-xs"
                        :aria-label="t('settings.cronCompatibleUrl')"
                    />
                    <button
                        @click="copyCronUrl"
                        type="button"
                        class="inline-flex items-center gap-1.5 px-4 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus-visible:outline-hidden cursor-pointer"
                        :class="cronCopied ? 'text-emerald-600 dark:text-emerald-400' : ''"
                        :aria-label="t('actions.copy')"
                    >
                        <svg
                            v-if="cronCopied"
                            class="h-4 w-4 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        <svg
                            v-else
                            class="h-4 w-4 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                        </svg>
                        <span class="hidden sm:inline text-xs font-medium">{{
                            cronCopied ? t('settings.copiedShort') : t('actions.copy')
                        }}</span>
                    </button>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t('settings.cronCopyHint') }}
                </p>
            </div>

            <div
                class="bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/60 misub-radius-md p-3 space-y-2"
            >
                <div class="flex items-start gap-2">
                    <span class="text-blue-500 mt-0.5">🔐</span>
                    <div>
                        <p class="text-xs font-medium text-blue-700 dark:text-blue-300">
                            {{ t('settings.cronRecommendedSecurity') }}
                        </p>
                        <p class="text-xs text-blue-600/80 dark:text-blue-200/80 mt-0.5">
                            {{ t('settings.cronBearerHint') }}
                        </p>
                    </div>
                </div>
                <input
                    type="text"
                    :value="cronHeaderCommand"
                    readonly
                    class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-950/40 border border-blue-100 dark:border-blue-800/70 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-200"
                    :aria-label="t('settings.cronCommandLabel')"
                />
            </div>
        </div>
        <div
            v-else
            class="bg-yellow-50/80 dark:bg-yellow-900/20 border border-yellow-200/80 dark:border-yellow-800/70 misub-radius-md p-3"
        >
            <p class="text-xs text-yellow-700 dark:text-yellow-300">
                {{ t('settings.cronEmptyHint') }}
            </p>
        </div>

        <div v-if="showCronGuide" class="text-xs text-gray-600 dark:text-gray-300 space-y-2">
            <p>{{ t('settings.cronGuideExternal') }}</p>
            <p>{{ t('settings.cronGuideBearer') }}</p>
            <p class="text-gray-500">{{ t('settings.cronGuideFrequency') }}</p>
        </div>
    </div>
</template>
