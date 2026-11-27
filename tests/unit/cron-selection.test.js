import { describe, expect, it } from 'vitest';
import { selectCronSubscriptions } from '../../functions/modules/cron-selection.js';

const sub = (overrides = {}) => ({
    id: 'sub-1',
    name: '机场 A',
    url: 'https://example.com/sub',
    enabled: true,
    ...overrides,
});

describe('selectCronSubscriptions', () => {
    it('禁用自动更新的订阅不进刷新队列，并作为 skipped 单独回报', () => {
        const paused = sub({ id: 'mitce', name: 'Mitce', autoUpdate: false });
        const normal = sub({ id: 'ok', name: '正常机场' });

        const { todo, skipped } = selectCronSubscriptions([paused, normal]);

        expect(todo.map((s) => s.id)).toEqual(['ok']);
        expect(skipped).toEqual([{ id: 'mitce', name: 'Mitce', reason: 'auto-update-disabled' }]);
    });

    it('没有 autoUpdate 字段的历史数据按开启处理', () => {
        const { todo, skipped } = selectCronSubscriptions([sub()]);

        expect(todo).toHaveLength(1);
        expect(skipped).toHaveLength(0);
    });

    it('停用的订阅与手动节点既不刷新也不计入 skipped', () => {
        const { todo, skipped } = selectCronSubscriptions([
            sub({ id: 'disabled', enabled: false }),
            sub({ id: 'manual', url: 'vmess://abc' }),
            sub({ id: 'no-url', url: undefined }),
        ]);

        expect(todo).toHaveLength(0);
        expect(skipped).toHaveLength(0);
    });

    it('容错非数组入参', () => {
        expect(selectCronSubscriptions(undefined)).toEqual({ todo: [], skipped: [] });
        expect(selectCronSubscriptions(null)).toEqual({ todo: [], skipped: [] });
    });
});
