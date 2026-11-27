import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    refreshSubscriptionSnapshot: vi.fn(),
    isNodePersistenceEnabled: vi.fn(),
}));

vi.mock('../../functions/services/node-persistence-service.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        isNodePersistenceEnabled: (...args) => mocks.isNodePersistenceEnabled(...args),
        refreshSubscriptionSnapshot: (...args) => mocks.refreshSubscriptionSnapshot(...args),
    };
});

const adapter = {
    type: 'd1',
    async get(key) {
        if (key === 'worker_settings_v1') {
            return { storageType: 'd1', enableNodePersistence: true, autoUpdateInterval: 5 };
        }
        return null;
    },
    async getAllSubscriptions() {
        return [
            { id: 'sub-1', name: 'A', url: 'https://a.example/sub', enabled: true },
            { id: 'sub-2', name: 'B', url: 'https://b.example/sub', enabled: true, autoUpdate: false },
        ];
    },
    updateSubscriptionById: vi.fn(async (id, apply) => ({ id, ...apply({ id }) })),
};

vi.mock('../../functions/storage-adapter.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        StorageFactory: {
            ...actual.StorageFactory,
            getStorageType: vi.fn(async () => 'd1'),
            createAdapter: vi.fn(() => adapter),
            createNodeStore: vi.fn(() => ({})),
        },
    };
});

describe('D1 节点持久化：刷新入口不应该重复请求机场', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isNodePersistenceEnabled.mockReturnValue(true);
        mocks.refreshSubscriptionSnapshot.mockImplementation(async (env, sub) => ({
            success: true,
            subscriptionId: sub.id,
            nodeCount: 12,
            userInfo: { upload: 1, download: 2, total: 100 },
        }));
        globalThis.fetch = vi.fn(async () => {
            throw new Error('持久化模式下不应该直接请求机场');
        });
    });

    it('批量刷新走快照，尊重 autoUpdate=false，且不回写 subscriptions', async () => {
        const { handleBatchUpdateNodesRequest } = await import(
            '../../functions/modules/handlers/node-handler.js'
        );
        const request = new Request('https://misub.internal/api/batch_update_nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionIds: ['sub-1', 'sub-2'] }),
        });
        const response = await handleBatchUpdateNodesRequest(request, { MISUB_DB: {} });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.refreshSubscriptionSnapshot).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch).not.toHaveBeenCalled();
        // 唯一事实源是快照：不再写 subscriptions.nodeCount
        expect(adapter.updateSubscriptionById).not.toHaveBeenCalled();
        expect(body.summary.successfulUpdates).toBe(1);
        expect(body.summary.totalNodes).toBe(12);
        expect(body.skipped).toEqual([
            expect.objectContaining({ subscriptionId: 'sub-2', reason: 'auto_update_paused' }),
        ]);
    });

    it('单机场手动刷新走快照，只请求一次，且不回写 subscriptions', async () => {
        const { handleNodeCountRequest } = await import(
            '../../functions/modules/handlers/node-handler.js'
        );
        const request = new Request('https://misub.internal/api/node_count', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://a.example/sub' }),
        });
        const response = await handleNodeCountRequest(request, { MISUB_DB: {} });
        const body = await response.json();

        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({ count: 12, fromPersistence: true });
        expect(mocks.refreshSubscriptionSnapshot).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch).not.toHaveBeenCalled();
        expect(adapter.updateSubscriptionById).not.toHaveBeenCalled();
    });
});
