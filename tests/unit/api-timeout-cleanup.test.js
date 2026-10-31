import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
}));

vi.mock('../../src/lib/http.js', () => ({
    api: {
        get: mocks.get,
        post: mocks.post,
    },
    APIError: class APIError extends Error {
        constructor(message, status = 500, data = null) {
            super(message);
            this.name = 'APIError';
            this.status = status;
            this.data = data;
        }
    },
}));

describe('API request timeout cleanup', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        mocks.get.mockReset();
        mocks.post.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([
        ['fetchInitialData', 'get', () => import('../../src/lib/api.js')],
        ['fetchPublicConfig', 'get', () => import('../../src/lib/api.js')],
        ['fetchNodeCount', 'post', () => import('../../src/lib/api.js')],
        ['batchUpdateNodes', 'post', () => import('../../src/lib/api.js')],
        ['testSubconverterBackend', 'post', () => import('../../src/lib/api.js')],
    ])('%s clears its timeout when the request rejects', async (name, method, loadApi) => {
        mocks[method].mockRejectedValue(new Error('network down'));
        const apiModule = await loadApi();

        if (name === 'fetchInitialData') await apiModule.fetchInitialData();
        if (name === 'fetchPublicConfig') await apiModule.fetchPublicConfig();
        if (name === 'fetchNodeCount') await apiModule.fetchNodeCount('https://example.com/sub');
        if (name === 'batchUpdateNodes') await apiModule.batchUpdateNodes(['sub-1']);
        if (name === 'testSubconverterBackend') {
            await apiModule.testSubconverterBackend('https://converter.example');
        }

        expect(vi.getTimerCount()).toBe(0);
    });
});
