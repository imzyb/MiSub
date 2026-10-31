<script setup>
    import { computed, ref } from 'vue';
    import { useI18n } from '@/i18n/index.js';
    import yaml from 'js-yaml';

    const { t } = useI18n();

    const props = defineProps({
        settings: {
            type: Object,
            required: true,
        },
    });

    const inputValue = computed({
        get() {
            return props.settings.customDnsOverride || '';
        },
        set(value) {
            props.settings.customDnsOverride = value;
        },
    });

    const jsonError = ref('');

    function detectFormat(raw) {
        if (/^\s*\{/.test(raw)) return 'json';
        return 'yaml';
    }

    function validateInput() {
        const raw = inputValue.value.trim();
        if (!raw) {
            jsonError.value = '';
            return;
        }
        const format = detectFormat(raw);
        try {
            let parsed;
            if (format === 'json') {
                parsed = JSON.parse(raw);
            } else {
                parsed = yaml.load(raw);
            }
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                jsonError.value = t('settings.dnsOverrideInvalidObject');
            } else {
                jsonError.value = '';
            }
        } catch {
            jsonError.value =
                format === 'json'
                    ? t('settings.dnsOverrideInvalidJson')
                    : t('settings.dnsOverrideInvalidYaml');
        }
    }

    const hasValue = computed(() => inputValue.value.trim().length > 0);
</script>

<template>
    <div
        class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-xs dark:border-white/10 dark:bg-gray-900/70 space-y-4"
    >
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div
                    class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-500/10"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5 text-teal-600 dark:text-teal-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                        />
                    </svg>
                </div>
                <div>
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                        {{ t('settings.dnsOverrideTitle') }}
                    </h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ t('settings.dnsOverrideDesc') }}
                    </p>
                </div>
            </div>
            <span
                v-if="hasValue"
                class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
            >
                {{ t('settings.dnsOverrideActive') }}
            </span>
        </div>

        <div>
            <label
                class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
                {{ t('settings.dnsOverrideLabel') }}
            </label>
            <textarea
                v-model="inputValue"
                rows="20"
                spellcheck="false"
                :placeholder="t('settings.dnsOverridePlaceholder')"
                class="block w-full rounded-lg border bg-white px-4 py-3 font-mono text-xs leading-relaxed text-gray-900 shadow-sm transition-colors duration-200 focus:border-teal-500 focus-visible:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                :class="
                    jsonError
                        ? 'border-red-300 focus:border-red-500 focus-visible:ring-red-500 dark:border-red-500/50'
                        : 'border-gray-200 dark:border-gray-700'
                "
                @blur="validateInput"
            />
            <p v-if="jsonError" class="mt-2 text-xs text-red-600 dark:text-red-400">
                {{ jsonError }}
            </p>
            <p v-else class="mt-2 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                {{ t('settings.dnsOverrideHint') }}
            </p>
        </div>
    </div>
</template>
