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

describe('subscription auto refresh scheduling', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        mocks.subscriptionsRef.value = [];
        mocks.dataStore.settings = { autoUpdateInterval: 0 };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('不再暴露浏览器端定时器：自动刷新已改由服务端请求触发', async () => {
        const { useSubscriptions } = await import('../../src/composables/useSubscriptions.js');
        const api = useSubscriptions(vi.fn());

        expect(api.startAutoUpdate).toBeUndefined();
        expect(api.stopAutoUpdate).toBeUndefined();
        expect(api.restartAutoUpdate).toBeUndefined();
    });

    it('初始化不会创建 setInterval', async () => {
        const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
        const { useSubscriptions } = await import('../../src/composables/useSubscriptions.js');

        mocks.dataStore.settings = { autoUpdateInterval: 5 };
        useSubscriptions(vi.fn());

        expect(setIntervalSpy).not.toHaveBeenCalled();
    });
});
