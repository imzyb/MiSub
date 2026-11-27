/**
 * 浮层定位：锚点 + 固定定位（fixed）+ 视口内翻转/钳制。
 *
 * 为什么必须 fixed + Teleport：
 * 卡片、弹窗容器常有 overflow: hidden / 滚动裁剪，absolute 定位的 tooltip
 * 会被直接截断。这里统一用 fixed，并按可用空间自动翻到上方/下方。
 *
 * 目前由 ConfirmPopover（订阅组编辑的重置确认）使用。
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { computePopoverPosition } from '../utils/popover.js';

const SETTLE_DURATION_MS = 320;

export function usePopoverPosition({
    open,
    anchorRef,
    panelRef,
    width = 256,
    zIndex = 'var(--z-popover)',
    prefer = 'end',
}) {
    const placement = ref('bottom-end');
    const panelStyle = ref({
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: `${width}px`,
        transformOrigin: 'top right',
        zIndex,
    });

    const update = () => {
        const anchor = anchorRef?.value;
        const panel = panelRef?.value;
        if (!anchor || !panel) return;
        const rect = anchor.getBoundingClientRect();
        const result = computePopoverPosition({
            anchorRect: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
            },
            panelWidth: panel.offsetWidth || width,
            panelHeight: panel.offsetHeight,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            prefer,
        });
        placement.value = result.placement;
        panelStyle.value = {
            position: 'fixed',
            top: `${Math.round(result.top)}px`,
            left: `${Math.round(result.left)}px`,
            width: `${width}px`,
            transformOrigin: result.origin,
            zIndex,
        };
    };

    // 弹窗/卡片有入场动画或异步渲染，位置会持续变化一小段时间
    let settleFrame = 0;
    const settle = () => {
        cancelAnimationFrame(settleFrame);
        const startedAt = performance.now();
        const tick = () => {
            update();
            if (performance.now() - startedAt < SETTLE_DURATION_MS) {
                settleFrame = requestAnimationFrame(tick);
            }
        };
        settleFrame = requestAnimationFrame(tick);
    };

    watch(
        () => open?.value,
        async (value) => {
            if (!value) return;
            await nextTick();
            settle();
        },
        { immediate: true }
    );

    const reposition = () => {
        if (open?.value) update();
    };

    onMounted(() => {
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
    });

    onBeforeUnmount(() => {
        cancelAnimationFrame(settleFrame);
        window.removeEventListener('resize', reposition);
        window.removeEventListener('scroll', reposition, true);
    });

    return { placement, panelStyle, update, settle };
}
