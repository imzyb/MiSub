import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdapter = vi.fn();
const getStorageType = vi.fn();
const fetchSubscriptionNodes = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
  StorageFactory: {
    createAdapter: (...args) => createAdapter(...args),
    getStorageType: (...args) => getStorageType(...args)
  }
}));

vi.mock('../../functions/modules/subscription/node-fetcher.js', () => ({
  fetchSubscriptionNodes: (...args) => fetchSubscriptionNodes(...args)
}));

describe('handleProfileMode preview transforms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStorageType.mockResolvedValue('d1');
  });

  it('applies profile operator-chain renaming in preview results', async () => {
    createAdapter.mockReturnValue({
      getProfileById: vi.fn().mockResolvedValue({
        id: 'profile-1',
        enabled: true,
        subscriptions: ['sub-1'],
        manualNodes: [],
        operators: [
          {
            id: 'rename-1',
            type: 'rename',
            enabled: true,
            params: {
              regex: {
                enabled: true,
                rules: [{ pattern: 'Raw', replacement: 'Renamed' }]
              }
            }
          }
        ]
      }),
      getSubscriptionsByIds: vi.fn().mockResolvedValue([
        {
          id: 'sub-1',
          enabled: true,
          url: 'https://example.com/sub',
          name: 'Test Sub'
        }
      ]),
      get: vi.fn().mockResolvedValue({ defaultOperators: [] })
    });

    fetchSubscriptionNodes.mockResolvedValue({
      success: true,
      nodes: [
        {
          name: 'Raw Node',
          url: 'trojan://password@example.com:443#Raw%20Node',
          protocol: 'trojan',
          region: '其他',
          subscriptionName: 'Test Sub'
        }
      ]
    });

    const { handleProfileMode } = await import('../../functions/modules/subscription/profile-handler.js');
    const result = await handleProfileMode(new Request('https://example.com/api/subscription_nodes'), {}, 'profile-1', 'MiSub-Test/1.0', true, false);

    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].name).toBe('Renamed Node');
    expect(result.nodes[0].url).toContain('#Renamed%20Node');
  });
});
