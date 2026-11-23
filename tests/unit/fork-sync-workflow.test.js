/**
 * 回归测试：fork 同步工作流只能合并，不能覆盖。
 *
 * 历史问题：fork-sync.yml 曾每天 `git reset --hard upstream/main` 后强制推送，
 * 把 fork 用户刚推上去的提交静默打回上游状态。现在只允许「合得进就合，合不进就跳过」。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(resolve(rootDir, '.github/workflows/fork-sync.yml'), 'utf8');

describe('fork sync workflow', () => {
    it('以合并上游的方式同步，而不是重置分支', () => {
        expect(workflow).toContain('git merge --no-edit upstream/main');
        expect(workflow).not.toContain('git reset --hard');
    });

    it('绝不强制推送', () => {
        expect(workflow).not.toMatch(/push[^\n]*--force/);
        expect(workflow).not.toContain('force-with-lease');
    });

    it('冲突时回滚本次合并，并在运行摘要中说明', () => {
        expect(workflow).toContain('git merge --abort');
        expect(workflow).toContain('GITHUB_STEP_SUMMARY');
    });

    it('workflow 文件守卫只看上游自上次分叉以来的改动', () => {
        expect(workflow).toContain('git merge-base "$ORIGIN_SHA" "$UPSTREAM_SHA"');
        expect(workflow).toContain('"$MERGE_BASE" "$UPSTREAM_SHA" -- .github/workflows');
    });

    it('只发布普通推送的结果，且仅在 fork 中运行', () => {
        expect(workflow).toContain('git push origin HEAD:main');
        expect(workflow).toContain('github.event.repository.fork');
    });

    it('不再保留第二个重复的同步工作流', () => {
        expect(existsSync(resolve(rootDir, '.github/workflows/sync-upstream.yml'))).toBe(false);
    });

    it('调度与运行日志统一按北京时间', () => {
        // cron 只能是 UTC，所以用注释写清换算关系
        expect(workflow).toContain('UTC 22:00 = 北京时间次日 06:00');
        // 运行时强制 TZ，让 date / git 输出与运行摘要都是北京时间
        expect(workflow).toContain('TZ: Asia/Shanghai');
        // 时间由 UTC+8 小时换算，不依赖 runner 的 tzdata 或 TZ 是否生效
        expect(workflow).toContain("date -u -d '+8 hour' '+%Y-%m-%d %H:%M:%S'");
        expect(workflow).toContain('（北京时间 UTC+8）');
        // 不用含义含糊的时区缩写（CST）
        expect(workflow).not.toContain('%Z');
        expect(workflow).not.toContain('%H:%M:%S %Z');
        expect(workflow).toContain('🕗 同步时间：');
        // 每次运行（含跳过）的运行摘要顶端都要有北京时间
        expect(workflow).toContain('Fork Sync 检查时间（北京时间）');
        // 网页上的 UTC 时间戳改不了，注释里要写清看哪儿
        expect(workflow).toContain('网页上的运行时间戳一律按 UTC 显示');
    });
});
