/**
 * 计算浮层的落点：优先下方右对齐，空间不足时自动翻到上方 / 左对齐，
 * 并最终钳制在视口内，避免被裁切。
 */
const DEFAULT_GAP = 8;
const DEFAULT_MARGIN = 8;

export function computePopoverPosition({
    anchorRect,
    panelWidth,
    panelHeight,
    viewportWidth,
    viewportHeight,
    gap = DEFAULT_GAP,
    margin = DEFAULT_MARGIN,
}) {
    const candidates = [
        {
            placement: 'bottom-end',
            top: anchorRect.bottom + gap,
            left: anchorRect.right - panelWidth,
            origin: 'top right',
        },
        {
            placement: 'bottom-start',
            top: anchorRect.bottom + gap,
            left: anchorRect.left,
            origin: 'top left',
        },
        {
            placement: 'top-end',
            top: anchorRect.top - gap - panelHeight,
            left: anchorRect.right - panelWidth,
            origin: 'bottom right',
        },
        {
            placement: 'top-start',
            top: anchorRect.top - gap - panelHeight,
            left: anchorRect.left,
            origin: 'bottom left',
        },
    ];

    const fits = (candidate) =>
        candidate.top >= margin &&
        candidate.top + panelHeight <= viewportHeight - margin &&
        candidate.left >= margin &&
        candidate.left + panelWidth <= viewportWidth - margin;

    const chosen = candidates.find(fits) || candidates[0];
    const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

    return {
        placement: chosen.placement,
        origin: chosen.origin,
        top: clamp(chosen.top, margin, viewportHeight - panelHeight - margin),
        left: clamp(chosen.left, margin, viewportWidth - panelWidth - margin),
    };
}
