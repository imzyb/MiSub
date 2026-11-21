import { describe, expect, it } from 'vitest';
import { computePopoverPosition } from '../../src/utils/popover.js';

const base = { panelWidth: 264, panelHeight: 120, viewportWidth: 1440, viewportHeight: 900 };

describe('computePopoverPosition', () => {
    it('prefers the bottom-right placement when there is room', () => {
        const result = computePopoverPosition({
            ...base,
            anchorRect: { top: 200, bottom: 220, left: 1000, right: 1100 },
        });
        expect(result.placement).toBe('bottom-end');
        expect(result.top).toBe(228);
        expect(result.left).toBe(836);
        expect(result.origin).toBe('top right');
    });

    it('flips above the anchor when the space below is insufficient', () => {
        const result = computePopoverPosition({
            ...base,
            anchorRect: { top: 800, bottom: 820, left: 1000, right: 1100 },
        });
        expect(result.placement).toBe('top-end');
        expect(result.top).toBe(672);
        expect(result.origin).toBe('bottom right');
    });

    it('switches to left alignment when the right side would overflow', () => {
        const result = computePopoverPosition({
            ...base,
            anchorRect: { top: 200, bottom: 220, left: 20, right: 120 },
        });
        expect(result.placement).toBe('bottom-start');
        expect(result.left).toBe(20);
        expect(result.origin).toBe('top left');
    });

    it('clamps the panel inside the viewport when no candidate fits', () => {
        const result = computePopoverPosition({
            panelWidth: 420,
            panelHeight: 160,
            viewportWidth: 360,
            viewportHeight: 220,
            anchorRect: { top: 100, bottom: 120, left: 10, right: 110 },
        });
        expect(result.left).toBe(8);
        expect(result.top).toBe(52);
    });
});
