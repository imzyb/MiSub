import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard, isClipboardApiWritable } from '../../src/utils/clipboard.js';

describe('clipboard util', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });

    it('writes through the async Clipboard API when available', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        await expect(copyTextToClipboard('hello')).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('returns false for empty values instead of touching the clipboard', async () => {
        const writeText = vi.fn();
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        await expect(copyTextToClipboard('')).resolves.toBe(false);
        expect(writeText).not.toHaveBeenCalled();
    });

    it('falls back to execCommand when the Clipboard API is unavailable', async () => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        const execCommand = vi.fn().mockReturnValue(true);
        document.execCommand = execCommand;

        await expect(copyTextToClipboard('fallback-value')).resolves.toBe(true);
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(document.querySelectorAll('textarea')).toHaveLength(0);
    });

    it('reports failure when both clipboard paths are unavailable', async () => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        document.execCommand = vi.fn().mockReturnValue(false);

        await expect(copyTextToClipboard('nope')).resolves.toBe(false);
    });

    it('skips the async Clipboard API in insecure contexts', () => {
        const original = window.isSecureContext;
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn() },
        });

        expect(isClipboardApiWritable()).toBe(false);

        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: original });
    });
});
