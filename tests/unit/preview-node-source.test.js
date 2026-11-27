import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    profileResult: { success: true, nodes: [], totalCount: 0, stats: {} },
    singleResult: { success: true, nodes: [], totalCount: 0, stats: {} },
    directResult: { success: true, nodes: [], totalCount: 0, stats: {} },
}));

vi.mock('../../functions/modules/subscription/profile-handler.js', () => ({
    handleProfileMode: vi.fn(async () => ({ ...mocks.profileResult })),
}));

vi.mock('../../functions/modules/subscription/single-subscription.js', () => ({
    handleSingleSubscriptionMode: vi.fn(async () => ({ ...mocks.singleResult })),
    handleDirectUrlMode: vi.fn(async () => ({ ...mocks.directResult })),
}));

vi.mock('../../functions/modules/subscription/profile-resolver.js', () => ({
    resolvePublicProfile: vi.fn(() => null),
}));

vi.mock('../../functions/storage-adapter.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        StorageFactory: {
            ...actual.StorageFactory,
            getStorageType: vi.fn(async () => 'kv'),
            createAdapter: vi.fn(() => ({ async get() { return null; }, async getAllProfiles() { return []; } })),
        },
    };
});

function request(body) {
    return new Request('https://misub.internal/api/subscription_nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('节点预览：返回数据来源标记', () => {
    beforeEach(() => {
        mocks.profileResult = { success: true, nodes: [], totalCount: 0, stats: {} };
        mocks.singleResult = { success: true, nodes: [], totalCount: 0, stats: {} };
        mocks.directResult = { success: true, nodes: [], totalCount: 0, stats: {} };
    });

    it('订阅组预览：handler 未标记时按实时拉取处理', async () => {
        const { handleSubscriptionNodesRequest } = await import(
            '../../functions/modules/subscription/preview-handler.js'
        );
        const response = await handleSubscriptionNodesRequest(request({ profileId: 'p1' }), {});
        const body = await response.json();
        expect(body.nodeSource).toBe('live');
    });

    it('订阅组预览：持久化快照标记原样透传', async () => {
        mocks.profileResult = {
            success: true,
            nodes: [],
            totalCount: 0,
            stats: {},
            nodeSource: 'persistence',
        };
        const { handleSubscriptionNodesRequest } = await import(
            '../../functions/modules/subscription/preview-handler.js'
        );
        const response = await handleSubscriptionNodesRequest(request({ profileId: 'p1' }), {});
        const body = await response.json();
        expect(body.nodeSource).toBe('persistence');
    });

    it('单订阅预览同样带出来源标记', async () => {
        mocks.singleResult = {
            success: true,
            nodes: [],
            totalCount: 0,
            stats: {},
            nodeSource: 'persistence',
        };
        const { handleSubscriptionNodesRequest } = await import(
            '../../functions/modules/subscription/preview-handler.js'
        );
        const response = await handleSubscriptionNodesRequest(
            request({ subscriptionId: 's1' }),
            {}
        );
        const body = await response.json();
        expect(body.nodeSource).toBe('persistence');
    });
});
