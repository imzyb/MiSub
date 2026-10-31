import { ref } from 'vue';

// Promise-based confirmation dialog.
//
// Replaces the native window.confirm() so the prompt can be styled, translated
// and driven by the shared Modal component (which already provides focus trap,
// Escape handling and focus restoration).
//
// Only one dialog can be pending at a time. If a second call arrives while a
// dialog is open, the first one resolves to false instead of leaking a promise.
const pending = ref(null);

// Whether a <ConfirmDialog /> host is currently mounted. When no host exists
// (unit tests, or a component mounted outside App.vue) confirmAction falls back
// to the native window.confirm() so callers never hang on an unresolved promise.
let hostMounted = false;

export function setConfirmHost(mounted) {
    hostMounted = Boolean(mounted);
    if (!hostMounted && pending.value) {
        // Host went away while a dialog was open — release the waiter.
        settleConfirm(false);
    }
}

export function confirmAction(options = {}) {
    if (!hostMounted) {
        const accepted =
            typeof window !== 'undefined' && typeof window.confirm === 'function'
                ? window.confirm(options.message || '')
                : false;
        return Promise.resolve(accepted);
    }

    return new Promise((resolve) => {
        if (pending.value) {
            pending.value.resolve(false);
        }
        pending.value = {
            title: options.title || '',
            message: options.message || '',
            confirmText: options.confirmText || '',
            cancelText: options.cancelText || '',
            variant: options.variant || 'primary',
            resolve,
        };
    });
}

export function useConfirmState() {
    return pending;
}

export function settleConfirm(result) {
    const current = pending.value;
    pending.value = null;
    if (current) {
        current.resolve(result);
    }
}
