<script setup>
    /**
     * 统一的「复制」按钮。
     *
     * 背景：项目里复制按钮至少有三代实现——
     * 1. 直接 navigator.clipboard.writeText，非安全上下文（http 局域网）直接抛错，点了没反应；
     * 2. 复制成功只把文字换成「已复制」，没有图标、没有 toast，用户经常以为没生效；
     * 3. 图标 + 状态 + toast（本组件的形态）。
     *
     * 这里收敛成一份实现，尺寸/圆角/图标/成功态全部一致：
     * - variant=outline：独立描边按钮
     * - variant=soft：浅底按钮
     * - variant=icon：图标按钮（表格/卡片行内）
     */
    import { computed, onUnmounted, ref } from 'vue';
    import { useI18n } from '../../i18n/index.js';
    import { useToastStore } from '../../stores/toast.js';
    import { copyTextToClipboard } from '../../utils/clipboard.js';

    const { t } = useI18n();
    const { showToast } = useToastStore();

    const props = defineProps({
        /** 需要复制的文本 */
        value: { type: String, default: '' },
        /** 复制成功后的提示文案，缺省用「已复制」 */
        label: { type: String, default: '' },
        /** 图标按钮的 tooltip / 无障碍标签 */
        title: { type: String, default: '' },
        variant: {
            type: String,
            default: 'outline',
            validator: (v) => ['outline', 'soft', 'icon'].includes(v),
        },
        size: { type: String, default: 'md', validator: (v) => ['sm', 'md'].includes(v) },
        disabled: { type: Boolean, default: false },
        /** 是否额外弹 toast（行内图标按钮通常也弹，保持反馈一致） */
        showToastOnCopy: { type: Boolean, default: true },
    });

    const emit = defineEmits(['copied', 'error']);

    const copied = ref(false);
    let resetTimer = null;

    const isIconOnly = computed(() => props.variant === 'icon');

    const accessibleLabel = computed(() => {
        if (copied.value) return t('settings.copiedShort');
        return props.title || props.label || t('actions.copy');
    });

    const displayLabel = computed(() => {
        if (copied.value) return t('settings.copiedShort');
        return props.label || t('actions.copy');
    });

    const sizeClass = computed(() => {
        if (isIconOnly.value) return props.size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
        const pad = props.size === 'sm' ? 'px-3 text-xs' : 'px-3.5 text-sm';
        const height = props.size === 'sm' ? 'h-9' : 'h-10';
        return `${height} ${pad}`;
    });

    const variantClass = computed(() => {
        if (isIconOnly.value) {
            return 'rounded-lg border border-transparent text-gray-500 dark:text-gray-400 hover:bg-primary-500/10 hover:text-primary-600 dark:hover:text-primary-400';
        }
        if (props.variant === 'soft') {
            return 'rounded-lg border border-transparent bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/15';
        }
        return 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700';
    });

    const stateClass = computed(() => {
        if (!copied.value) return '';
        return isIconOnly.value
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
    });

    async function handleCopy() {
        if (props.disabled || !props.value) return;

        const success = await copyTextToClipboard(props.value);
        if (!success) {
            if (props.showToastOnCopy) showToast(t('notices.copyFailed'), 'error');
            emit('error');
            return;
        }

        if (props.showToastOnCopy) showToast(t('notices.copied'), 'success');
        emit('copied');
        copied.value = true;
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            copied.value = false;
        }, 1800);
    }

    onUnmounted(() => {
        clearTimeout(resetTimer);
    });
</script>

<template>
    <button
        type="button"
        :disabled="disabled || !value"
        :title="accessibleLabel"
        :aria-label="accessibleLabel"
        class="inline-flex shrink-0 items-center justify-center gap-1.5 font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500/40"
        :class="[sizeClass, variantClass, stateClass]"
        @click="handleCopy"
    >
        <svg
            v-if="copied"
            class="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg
            v-else
            class="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
        </svg>
        <span v-if="!isIconOnly" class="whitespace-nowrap">{{ displayLabel }}</span>
        <span class="sr-only" aria-live="polite">{{ copied ? t('settings.copiedShort') : '' }}</span>
    </button>
</template>
