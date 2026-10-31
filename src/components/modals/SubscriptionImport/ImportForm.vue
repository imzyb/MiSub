<script setup>
    import { useI18n } from '../../../i18n/index.js';

    const { t } = useI18n();
    import { computed } from 'vue';

    const props = defineProps({
        subscriptionUrl: {
            type: String,
            default: '',
        },
        isLoading: {
            type: Boolean,
            default: false,
        },
    });

    const emit = defineEmits(['update:subscriptionUrl', 'submit']);

    const urlModel = computed({
        get: () => props.subscriptionUrl,
        set: (val) => emit('update:subscriptionUrl', val),
    });
</script>

<template>
    <div>
        <label
            for="subscription-url"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
            {{ t('importNodes.subscriptionUrl') }}
        </label>
        <input
            id="subscription-url"
            v-model="urlModel"
            type="url"
            placeholder="https://example.com/subscription-link"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 misub-radius-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            @keyup.enter="emit('submit')"
            :disabled="isLoading"
        />
    </div>

    <div class="text-xs text-gray-500 dark:text-gray-400">
        <p>{{ t('importNodes.importHint') }}</p>
    </div>
</template>
