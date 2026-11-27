<script setup>
    import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
    import { usePopoverPosition } from '../../composables/usePopoverPosition.js';

    const props = defineProps({
        open: { type: Boolean, default: false },
        anchor: { type: Object, default: null },
        message: { type: String, default: '' },
        confirmText: { type: String, default: '' },
        cancelText: { type: String, default: '' },
        width: { type: Number, default: 264 },
    });

    const emit = defineEmits(['confirm', 'cancel']);

    const panelRef = ref(null);
    const anchorRef = computed(() => props.anchor);
    const openRef = computed(() => props.open);

    // 「锚点 + fixed + 视口翻转」的定位逻辑集中在这里，避免被容器 overflow 裁切
    const { placement, panelStyle } = usePopoverPosition({
        open: openRef,
        anchorRef,
        panelRef,
        width: props.width,
        zIndex: 'var(--z-modal-popover)',
    });

    const onDocumentPointerDown = (event) => {
        if (!props.open) return;
        const target = event.target;
        if (panelRef.value?.contains(target)) return;
        if (props.anchor?.contains?.(target)) return;
        emit('cancel');
    };

    onMounted(() => {
        document.addEventListener('pointerdown', onDocumentPointerDown, true);
    });

    onBeforeUnmount(() => {
        document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    });
</script>

<template>
    <Teleport to="body">
        <Transition name="popover">
        <div
            v-if="open"
            ref="panelRef"
            class="fixed rounded-xl border border-gray-200 bg-white p-3 text-left shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800 dark:ring-white/10"
            :style="{ ...panelStyle, zIndex: 'var(--z-modal-popover)' }"
            role="dialog"
            :data-placement="placement"
            @click.stop
        >
            <p class="text-xs leading-5 text-gray-600 dark:text-gray-300">{{ message }}</p>
            <div class="mt-3 flex items-center justify-end gap-2">
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                    @click="emit('cancel')"
                >
                    {{ cancelText }}
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                    @click="emit('confirm')"
                >
                    {{ confirmText }}
                </button>
            </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
    .popover-enter-active,
    .popover-leave-active {
        transition:
            opacity 0.16s ease,
            transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .popover-enter-from,
    .popover-leave-to {
        opacity: 0;
        transform: scale(0.96) translateY(-3px);
    }

    .popover-enter-to,
    .popover-leave-from {
        opacity: 1;
        transform: scale(1) translateY(0);
    }

    /* 向上弹出时，从下方轻微滑入，动势与落点一致 */
    .popover-enter-from[data-placement^='top'],
    .popover-leave-to[data-placement^='top'] {
        transform: scale(0.96) translateY(3px);
    }
</style>
