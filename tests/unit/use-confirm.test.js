import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    confirmAction,
    setConfirmHost,
    settleConfirm,
    useConfirmState,
} from '../../src/composables/useConfirm.js';

// The dialog state is a module-level singleton, so every test must leave it empty
// and the host flag reset.
beforeEach(() => {
    setConfirmHost(true);
});

afterEach(() => {
    settleConfirm(false);
    setConfirmHost(false);
});

describe('confirmAction with a mounted dialog host', () => {
    it('exposes the request through the shared state while pending', async () => {
        const promise = confirmAction({
            title: 'Delete group',
            message: 'Are you sure?',
            confirmText: 'Delete',
            cancelText: 'Keep',
            variant: 'danger',
        });

        expect(useConfirmState().value).toMatchObject({
            title: 'Delete group',
            message: 'Are you sure?',
            confirmText: 'Delete',
            cancelText: 'Keep',
            variant: 'danger',
        });

        settleConfirm(true);
        await expect(promise).resolves.toBe(true);
    });

    it('resolves false when the dialog is dismissed', async () => {
        const promise = confirmAction({ message: 'Continue?' });
        settleConfirm(false);
        await expect(promise).resolves.toBe(false);
    });

    it('defaults the variant to primary and text fields to empty strings', async () => {
        const promise = confirmAction({ message: 'Continue?' });

        expect(useConfirmState().value).toMatchObject({
            title: '',
            confirmText: '',
            cancelText: '',
            variant: 'primary',
        });

        settleConfirm(true);
        await promise;
    });

    it('clears the state once settled', async () => {
        const promise = confirmAction({ message: 'Continue?' });
        settleConfirm(true);
        await promise;

        expect(useConfirmState().value).toBeNull();
    });

    it('resolves the previous dialog to false when a second request arrives', async () => {
        const first = confirmAction({ message: 'First' });
        const second = confirmAction({ message: 'Second' });

        // The orphaned first promise must not hang forever.
        await expect(first).resolves.toBe(false);
        expect(useConfirmState().value).toMatchObject({ message: 'Second' });

        settleConfirm(true);
        await expect(second).resolves.toBe(true);
    });

    it('ignores settle calls when nothing is pending', () => {
        expect(() => settleConfirm(true)).not.toThrow();
        expect(useConfirmState().value).toBeNull();
    });

    it('ignores a repeated settle for the same dialog', async () => {
        const promise = confirmAction({ message: 'Continue?' });

        settleConfirm(true);
        settleConfirm(false);
        settleConfirm(true);

        await expect(promise).resolves.toBe(true);
    });
});

describe('confirmAction without a dialog host', () => {
    it('falls back to window.confirm so the caller never hangs', async () => {
        setConfirmHost(false);
        const original = window.confirm;
        window.confirm = vi.fn(() => true);

        try {
            await expect(confirmAction({ message: 'Continue?' })).resolves.toBe(true);
            expect(window.confirm).toHaveBeenCalledWith('Continue?');
            // The fallback must not touch the shared dialog state.
            expect(useConfirmState().value).toBeNull();
        } finally {
            window.confirm = original;
        }
    });

    it('propagates a rejected native confirm', async () => {
        setConfirmHost(false);
        const original = window.confirm;
        window.confirm = vi.fn(() => false);

        try {
            await expect(confirmAction({ message: 'Continue?' })).resolves.toBe(false);
        } finally {
            window.confirm = original;
        }
    });

    it('releases a pending dialog when the host unmounts', async () => {
        const promise = confirmAction({ message: 'Continue?' });

        setConfirmHost(false);

        await expect(promise).resolves.toBe(false);
        expect(useConfirmState().value).toBeNull();
    });
});
