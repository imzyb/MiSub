import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    subscriptionsRef: { value: [] },
    dataStore: {
        settings: { autoUpdateInterval: 0 },
        saveData: vi.fn(),
    },
}));

vi.mock('pinia', () => ({
    storeToRefs: () => ({
        subscriptions: mocks.subscriptionsRef,
    }),
}));

vi.mock('../../src/stores/useDataStore', () => ({
    useDataStore: () => mocks.dataStore,
}));

vi.mock('../../src/stores/toast.js', () => ({
    useToastStore: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../src/lib/api.js', () => ({
    fetchNodeCount: vi.fn(),
    batchUpdateNodes: vi.fn(),
}));

vi.mock('../../src/utils/errorHandler.js', () => ({
    handleError: vi.fn(),
}));

describe('subscription auto-update scheduling', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        mocks.subscriptionsRef.value = [];
        mocks.dataStore.settings = { autoUpdateInterval: 0 };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not create a timer when the setting is zero', async () => {
        const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
        const { useSubscriptions } = await import('../../src/composables/useSubscriptions.js');
        const { startAutoUpdate } = useSubscriptions(vi.fn());

        startAutoUpdate();

        expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('creates a timer for a positive setting', async () => {
        const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
        const { useSubscriptions } = await import('../../src/composables/useSubscriptions.js');
        const { startAutoUpdate, stopAutoUpdate } = useSubscriptions(vi.fn());

        mocks.dataStore.settings = { autoUpdateInterval: 5 };
        startAutoUpdate();

        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
        stopAutoUpdate();
    });
});
