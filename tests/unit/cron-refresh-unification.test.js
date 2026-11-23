/**
 * 回归测试：Cron 刷新只能有一条链路。
 *
 * 历史问题：/api/cron/trigger 走的是 legacy 同步实现（旧存储绑定），
 * 而 /cron 走的是节点快照刷新，两套口径分叉；api-router 里还留着一份
 * 只在控制台打印、用 setTimeout 假装同步的死代码。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(rootDir, path), 'utf8');

describe('cron refresh unification', () => {
    it('API 手动触发与 /cron 共用同一套节点快照刷新', () => {
        const router = read('functions/modules/api-router.js');
        expect(router).toContain('handleCronTrigger(env)');
        expect(router).not.toContain('_schedule.js');
        expect(router).not.toContain('performSingleSubscriptionSync');
        expect(router).not.toContain('模拟网络请求');
    });

    it('legacy cron 实现文件已移除', () => {
        expect(existsSync(resolve(rootDir, 'functions/_cron.js'))).toBe(false);
        expect(existsSync(resolve(rootDir, 'functions/_schedule.js'))).toBe(false);
    });

    it('cron 仪表盘不再接受未鉴权的手动触发', () => {
        const dashboard = read('functions/cron-dashboard.js');
        expect(dashboard).not.toContain('triggerManualSync');
        expect(dashboard).toContain("error: 'method_not_allowed'");
    });
});
