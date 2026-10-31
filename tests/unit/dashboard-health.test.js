import { describe, expect, it } from 'vitest';
import {
    getDashboardHealthItems,
    resolveHealthItemCopy,
    shouldShowFullGuide,
} from '../../src/utils/dashboard-health.js';
import { t } from '../../src/i18n/index.js';

describe('dashboard health helpers', () => {
    it('prompts first-time users to add subscriptions and create profiles', () => {
        const items = getDashboardHealthItems({
            subscriptions: [],
            profiles: [],
            settings: {},
        });

        expect(items.map((item) => item.id)).toEqual([
            'missing-subscriptions',
            'missing-profiles',
            'missing-token',
        ]);
        expect(shouldShowFullGuide({ subscriptions: [], profiles: [] })).toBe(true);
    });

    it('surfaces actionable health issues when data exists', () => {
        const items = getDashboardHealthItems({
            subscriptions: [
                { id: 's1', enabled: true, nodeCount: 0 },
                { id: 's2', enabled: false, nodeCount: 2 },
                { id: 's3', enabled: true, nodeCount: 4, lastError: 'fetch failed' },
            ],
            profiles: [{ id: 'p1', enabled: true }],
            settings: { mytoken: 'auto' },
            totalNodesCount: 4,
        });

        expect(items.map((item) => item.id)).toEqual([
            'auto-token',
            'subscription-errors',
            'disabled-subscriptions',
        ]);
        expect(items.find((item) => item.id === 'subscription-errors').count).toBe(1);
        expect(
            shouldShowFullGuide({ subscriptions: [{ id: 's1' }], profiles: [{ id: 'p1' }] })
        ).toBe(false);
    });

    it('warns when enabled subscriptions have traffic nearly exhausted or expired', () => {
        const now = Math.floor(Date.now() / 1000);
        const items = getDashboardHealthItems({
            subscriptions: [
                {
                    id: 'low-traffic',
                    enabled: true,
                    nodeCount: 3,
                    userInfo: { upload: 90, download: 0, total: 100, expire: now + 86400 },
                },
                {
                    id: 'expired',
                    enabled: true,
                    nodeCount: 3,
                    userInfo: { upload: 1, download: 1, total: 100, expire: now - 60 },
                },
            ],
            profiles: [{ id: 'p1' }],
            settings: { mytoken: 'stable-token' },
            now: now * 1000,
        });

        expect(items.map((item) => item.id)).toContain('low-traffic');
        expect(items.map((item) => item.id)).toContain('expired-subscriptions');
    });

    it('attaches precise dashboard navigation targets for follow-up actions', () => {
        const items = getDashboardHealthItems({
            subscriptions: [
                { id: 'failed', enabled: true, nodeCount: 1, lastError: 'timeout' },
                { id: 'disabled', enabled: false, nodeCount: 2 },
            ],
            profiles: [{ id: 'profile', enabled: true }],
            settings: { mytoken: 'auto' },
            totalNodesCount: 3,
        });

        expect(items.find((item) => item.id === 'auto-token')).toMatchObject({
            actionRoute: '/dashboard/settings',
            actionQuery: { focus: 'mytoken' },
        });
        expect(items.find((item) => item.id === 'subscription-errors')).toMatchObject({
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'error' },
        });
        expect(items.find((item) => item.id === 'disabled-subscriptions')).toMatchObject({
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'disabled' },
        });
    });

    // Regression: the secondary "打开日志" button was dead because the item exposed
    // `secondaryAction` while DashboardView reads `item.action`.
    it('exposes the secondary action under the `action` key the view consumes', () => {
        const items = getDashboardHealthItems({
            subscriptions: [{ id: 'failed', enabled: true, nodeCount: 1, lastError: 'timeout' }],
            profiles: [{ id: 'profile', enabled: true }],
            settings: { mytoken: 'stable-token' },
            totalNodesCount: 1,
        });

        const errorItem = items.find((item) => item.id === 'subscription-errors');
        expect(errorItem.secondaryActionLabelKey).toBe(
            'dashboard.healthItems.subscriptionErrors.secondaryAction'
        );
        expect(errorItem.action).toBe('openLog');
        expect(errorItem.secondaryAction).toBeUndefined();
    });

    // Copy is no longer hardcoded Chinese; it resolves through i18n.
    it('resolves titles and descriptions from i18n keys instead of hardcoded copy', () => {
        const items = getDashboardHealthItems({
            subscriptions: [{ id: 'failed', enabled: true, nodeCount: 1, lastError: 'timeout' }],
            profiles: [{ id: 'profile', enabled: true }],
            settings: { mytoken: 'stable-token' },
            totalNodesCount: 1,
        });

        const errorItem = items.find((item) => item.id === 'subscription-errors');
        expect(errorItem.titleKey).toBe('dashboard.healthItems.subscriptionErrors.title');
        expect(errorItem.titleParams).toEqual({ count: 1 });
        // The raw helper must not leak display copy.
        expect(errorItem.title).toBeUndefined();
        expect(errorItem.description).toBeUndefined();

        const zh = resolveHealthItemCopy(errorItem, (key, params) => t(key, params, 'zh-CN'));
        expect(zh.title).toBe('1 个订阅最近更新失败');
        expect(zh.actionLabel).toBe('查看失败订阅');
        expect(zh.secondaryActionLabel).toBe('打开日志');

        const en = resolveHealthItemCopy(errorItem, (key, params) => t(key, params, 'en-US'));
        expect(en.title).toBe('1 source(s) failed to update');
        expect(en.actionLabel).toBe('View failed sources');
        expect(en.secondaryActionLabel).toBe('Open logs');
    });

    // Regression: `slice(0, 4)` silently dropped items while the header still
    // reported the truncated count, so users never knew items were hidden.
    it('returns every matched item instead of silently truncating to four', () => {
        const now = Math.floor(Date.now() / 1000);
        const expired = [0, 1, 2].map((i) => ({
            id: `expired-${i}`,
            enabled: true,
            nodeCount: 3,
            userInfo: { upload: 1, download: 1, total: 100, expire: now - 60 },
        }));

        const items = getDashboardHealthItems({
            subscriptions: [
                ...expired,
                {
                    id: 'low',
                    enabled: true,
                    nodeCount: 3,
                    userInfo: { upload: 95, download: 0, total: 100, expire: now + 86400 },
                },
                { id: 'failed', enabled: true, nodeCount: 3, lastError: 'boom' },
                { id: 'off', enabled: false, nodeCount: 1 },
            ],
            profiles: [{ id: 'profile' }],
            settings: { mytoken: 'auto' },
            totalNodesCount: 9,
            now: now * 1000,
        });

        expect(items.length).toBeGreaterThan(4);
        expect(items.map((item) => item.id)).toEqual([
            'auto-token',
            'subscription-errors',
            'expired-subscriptions',
            'low-traffic',
            'disabled-subscriptions',
        ]);
        // Nothing is dropped: every generated id survives.
        expect(items.length).toBe(new Set(items.map((item) => item.id)).size);
    });
});
