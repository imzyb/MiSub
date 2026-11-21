<script setup>
    import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import { computePopoverPosition } from '../../utils/popover.js';

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
    const placement = ref('bottom-end');
    const panelStyle = ref({
        top: '0px',
        left: '0px',
        width: `${props.width}px`,
        transformOrigin: 'top right',
    });

    const updatePosition = () => {
        const anchor = props.anchor;
        const panel = panelRef.value;
        if (!anchor || !panel) return;
        const rect = anchor.getBoundingClientRect();
        const result = computePopoverPosition({
            anchorRect: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
            },
            panelWidth: panel.offsetWidth || props.width,
            panelHeight: panel.offsetHeight,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        });
        placement.value = result.placement;
        panelStyle.value = {
            top: `${Math.round(result.top)}px`,
            left: `${Math.round(result.left)}px`,
            width: `${props.width}px`,
            transformOrigin: result.origin,
        };
    };

    // 弹窗自身有 200ms 左右的入场动画，锚点位置会变；开启动画期间持续跟随测量
    let settleFrame = 0;
    const settlePosition = () => {
        cancelAnimationFrame(settleFrame);
        const startedAt = performance.now();
        const tick = () => {
            updatePosition();
            if (performance.now() - startedAt < 450) {
                settleFrame = requestAnimationFrame(tick);
            }
        };
        settleFrame = requestAnimationFrame(tick);
    };

    watch(
        () => props.open,
        async (open) => {
            if (!open) return;
            await nextTick();
            settlePosition();
        }
    );

    const reposition = () => {
        if (props.open) updatePosition();
    };

    const onDocumentPointerDown = (event) => {
        if (!props.open) return;
        const target = event.target;
        if (panelRef.value?.contains(target)) return;
        if (props.anchor?.contains?.(target)) return;
        emit('cancel');
    };

    onMounted(() => {
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        document.addEventListener('pointerdown', onDocumentPointerDown, true);
    });

    onBeforeUnmount(() => {
        cancelAnimationFrame(settleFrame);
        window.removeEventListener('resize', reposition);
        window.removeEventListener('scroll', reposition, true);
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
