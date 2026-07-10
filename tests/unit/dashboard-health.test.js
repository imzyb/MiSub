import { describe, expect, it } from 'vitest';
import { getDashboardHealthItems, shouldShowFullGuide } from '../../src/utils/dashboard-health.js';

describe('dashboard health helpers', () => {
  it('prompts first-time users to add subscriptions and create profiles', () => {
    const items = getDashboardHealthItems({
      subscriptions: [],
      profiles: [],
      settings: {}
    });

    expect(items.map(item => item.id)).toEqual([
      'missing-subscriptions',
      'missing-profiles',
      'missing-token'
    ]);
    expect(shouldShowFullGuide({ subscriptions: [], profiles: [] })).toBe(true);
  });

  it('surfaces actionable health issues when data exists', () => {
    const items = getDashboardHealthItems({
      subscriptions: [
        { id: 's1', enabled: true, nodeCount: 0 },
        { id: 's2', enabled: false, nodeCount: 2 },
        { id: 's3', enabled: true, nodeCount: 4, lastError: 'fetch failed' }
      ],
      profiles: [{ id: 'p1', enabled: true }],
      settings: { mytoken: 'auto' },
      totalNodesCount: 4
    });

    expect(items.map(item => item.id)).toEqual([
      'auto-token',
      'subscription-errors',
      'disabled-subscriptions'
    ]);
    expect(items.find(item => item.id === 'subscription-errors').count).toBe(1);
    expect(shouldShowFullGuide({ subscriptions: [{ id: 's1' }], profiles: [{ id: 'p1' }] })).toBe(false);
  });

  it('warns when enabled subscriptions have traffic nearly exhausted or expired', () => {
    const now = Math.floor(Date.now() / 1000);
    const items = getDashboardHealthItems({
      subscriptions: [
        {
          id: 'low-traffic',
          enabled: true,
          nodeCount: 3,
          userInfo: { upload: 90, download: 0, total: 100, expire: now + 86400 }
        },
        {
          id: 'expired',
          enabled: true,
          nodeCount: 3,
          userInfo: { upload: 1, download: 1, total: 100, expire: now - 60 }
        }
      ],
      profiles: [{ id: 'p1' }],
      settings: { mytoken: 'stable-token' },
      now: now * 1000
    });

    expect(items.map(item => item.id)).toContain('low-traffic');
    expect(items.map(item => item.id)).toContain('expired-subscriptions');
  });

  it('attaches precise dashboard navigation targets for follow-up actions', () => {
    const items = getDashboardHealthItems({
      subscriptions: [
        { id: 'failed', enabled: true, nodeCount: 1, lastError: 'timeout' },
        { id: 'disabled', enabled: false, nodeCount: 2 }
      ],
      profiles: [{ id: 'profile', enabled: true }],
      settings: { mytoken: 'auto' },
      totalNodesCount: 3
    });

    expect(items.find(item => item.id === 'auto-token')).toMatchObject({
      actionRoute: '/dashboard/settings',
      actionQuery: { focus: 'mytoken' }
    });
    expect(items.find(item => item.id === 'subscription-errors')).toMatchObject({
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'error' }
    });
    expect(items.find(item => item.id === 'disabled-subscriptions')).toMatchObject({
      actionRoute: '/dashboard/subscriptions',
      actionQuery: { status: 'disabled' }
    });
  });
});
