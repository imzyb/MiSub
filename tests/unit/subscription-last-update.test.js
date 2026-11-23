import { describe, expect, it } from 'vitest';
import { latestSubscriptionUpdate } from '../../src/utils/subscription-last-update.js';

describe('latestSubscriptionUpdate', () => {
    it('取所有订阅里最后的一个更新时间', () => {
        const latest = latestSubscriptionUpdate([
            { lastUpdate: '2026-11-20T01:15:00.000Z' },
            { lastUpdate: '2026-11-23T14:40:00.000Z' },
            { lastUpdate: '2026-11-21T08:00:00.000Z' },
        ]);

        expect(new Date(latest).toISOString()).toBe('2026-11-23T14:40:00.000Z');
    });

    it('忽略没有时间戳或时间非法的订阅', () => {
        const latest = latestSubscriptionUpdate([
            {},
            { lastUpdate: null },
            { lastUpdate: 'not-a-date' },
            { lastUpdate: '2026-11-22T00:00:00.000Z' },
        ]);

        expect(new Date(latest).toISOString()).toBe('2026-11-22T00:00:00.000Z');
    });

    it('没有任何有效时间时返回 null（界面显示「从未」而不是当前时间）', () => {
        expect(latestSubscriptionUpdate([])).toBeNull();
        expect(latestSubscriptionUpdate([{ lastUpdate: '' }, {}])).toBeNull();
        expect(latestSubscriptionUpdate(undefined)).toBeNull();
    });
});
