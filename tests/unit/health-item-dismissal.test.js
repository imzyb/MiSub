/**
 * 忽略列表的纯函数层 + 旧数据迁移。
 *
 * 这份列表现在随 `settings.dismissedHealthItems` 同步到服务端（跨设备生效），
 * 所以本模块**不再自己读写存储**，只负责「数组怎么算」。
 * 存储与同步在 DashboardView → useDataStore.saveSettings 那一层，
 * 相关接线由 tests/unit/dashboard-health-view.test.js 覆盖。
 *
 * 底部两个 legacy helper 是给老用户做一次性迁移用的，仍然走 local-preference。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    LEGACY_DISMISSED_HEALTH_ITEMS_KEY,
    MAX_DISMISSED_HEALTH_ITEMS,
    addDismissedHealthItem,
    clearLegacyDismissedHealthItemIds,
    filterDismissedHealthItems,
    isHealthItemDismissed,
    normalizeDismissedHealthItemIds,
    readLegacyDismissedHealthItemIds,
} from '../../src/utils/health-item-dismissal.js';

describe('health-item-dismissal（纯函数）', () => {
    it('未忽略任何项时为空', () => {
        expect(normalizeDismissedHealthItemIds(undefined)).toEqual([]);
        expect(isHealthItemDismissed([], 'auto-token')).toBe(false);
    });

    it('记录并识别已忽略的 id', () => {
        const ids = addDismissedHealthItem([], 'auto-token');

        expect(ids).toEqual(['auto-token']);
        expect(isHealthItemDismissed(ids, 'auto-token')).toBe(true);
        expect(isHealthItemDismissed(ids, 'expired-subscriptions')).toBe(false);
    });

    it('重复忽略不会产生重复项', () => {
        const once = addDismissedHealthItem([], 'auto-token');
        const twice = addDismissedHealthItem(once, 'auto-token');

        expect(twice).toEqual(['auto-token']);
    });

    it('不改动传入的数组（纯函数）', () => {
        const original = ['auto-token'];
        const next = addDismissedHealthItem(original, 'low-traffic');

        expect(original).toEqual(['auto-token']);
        expect(next).toEqual(['auto-token', 'low-traffic']);
    });

    it('忽略空白 id，避免污染设置', () => {
        for (const blank of ['', '   ', null, undefined, 42, {}]) {
            expect(addDismissedHealthItem(['auto-token'], blank)).toEqual(['auto-token']);
        }
    });

    it('比较前会 trim', () => {
        const ids = addDismissedHealthItem([], '  auto-token  ');

        expect(ids).toEqual(['auto-token']);
        expect(isHealthItemDismissed(ids, 'auto-token')).toBe(true);
        expect(isHealthItemDismissed(['auto-token'], '  auto-token  ')).toBe(true);
    });

    it('丢弃非数组 / 非字符串项，并去重', () => {
        // 设置是同步过来的，可能被旧版本写坏或被其它工具污染
        expect(normalizeDismissedHealthItemIds({ a: 1 })).toEqual([]);
        expect(normalizeDismissedHealthItemIds('auto-token')).toEqual([]);
        expect(normalizeDismissedHealthItemIds(['ok', 42, null, '', 'ok'])).toEqual(['ok']);
    });

    it('上限之外丢弃最早的条目', () => {
        let ids = [];
        for (let i = 0; i < MAX_DISMISSED_HEALTH_ITEMS + 50; i += 1) {
            ids = addDismissedHealthItem(ids, `item-${i}`);
        }

        expect(ids.length).toBe(MAX_DISMISSED_HEALTH_ITEMS);
        expect(ids[ids.length - 1]).toBe(`item-${MAX_DISMISSED_HEALTH_ITEMS + 49}`);
        expect(ids).not.toContain('item-0');
    });

    it('从列表里过滤掉已忽略的条目', () => {
        const items = [{ id: 'auto-token' }, { id: 'low-traffic' }, { id: 'zero-nodes' }];

        expect(filterDismissedHealthItems(items, ['low-traffic']).map((i) => i.id)).toEqual([
            'auto-token',
            'zero-nodes',
        ]);
    });

    it('过滤时容忍畸形输入', () => {
        expect(filterDismissedHealthItems(null, ['x'])).toEqual([]);
        expect(filterDismissedHealthItems([{ id: 'a' }, null, {}], ['b'])).toEqual([
            { id: 'a' },
            null,
            {},
        ]);
    });

    it('纯函数不碰任何存储（存储全坏也照样算）', () => {
        // 这是本模块的核心约定：算数组与存不存得下无关。
        // 如果哪天有人把读写塞回这里，这条会失败。
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {
                throw new Error('SecurityError');
            },
            removeItem: () => {
                throw new Error('SecurityError');
            },
        });

        const ids = addDismissedHealthItem([], 'auto-token');
        expect(ids).toEqual(['auto-token']);
        expect(isHealthItemDismissed(ids, 'auto-token')).toBe(true);
        expect(filterDismissedHealthItems([{ id: 'auto-token' }], ids)).toEqual([]);
        vi.unstubAllGlobals();
    });
});

describe('旧数据一次性迁移', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('迁移用的 key 必须与历史一致，否则老用户的记录读不出来', () => {
        expect(LEGACY_DISMISSED_HEALTH_ITEMS_KEY).toBe('misub:dismissedHealthItems');
    });

    it('没有旧记录时返回空数组', () => {
        expect(readLegacyDismissedHealthItemIds()).toEqual([]);
    });

    it('读出旧记录并规范化', () => {
        localStorage.setItem(
            LEGACY_DISMISSED_HEALTH_ITEMS_KEY,
            JSON.stringify(['auto-token', 42, '', 'auto-token', 'low-traffic'])
        );

        expect(readLegacyDismissedHealthItemIds()).toEqual(['auto-token', 'low-traffic']);
    });

    it('旧记录损坏时退化为空数组而不是抛错', () => {
        localStorage.setItem(LEGACY_DISMISSED_HEALTH_ITEMS_KEY, 'not-json{{');
        expect(readLegacyDismissedHealthItemIds()).toEqual([]);

        localStorage.setItem(LEGACY_DISMISSED_HEALTH_ITEMS_KEY, JSON.stringify({ a: 1 }));
        expect(readLegacyDismissedHealthItemIds()).toEqual([]);
    });

    it('能清除旧记录', () => {
        localStorage.setItem(LEGACY_DISMISSED_HEALTH_ITEMS_KEY, JSON.stringify(['auto-token']));

        expect(clearLegacyDismissedHealthItemIds()).toBe(true);
        expect(readLegacyDismissedHealthItemIds()).toEqual([]);
    });

    it('清除失败时返回 false，调用方据此保留旧键下次再试', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => JSON.stringify(['auto-token']),
            setItem: () => {},
            removeItem: () => {
                throw new Error('SecurityError');
            },
        });

        expect(clearLegacyDismissedHealthItemIds()).toBe(false);
    });
});
