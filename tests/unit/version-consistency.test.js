/**
 * 回归测试：版本号必须只有单一口径。
 *
 * 历史问题：发版时只改 package.json，functions/modules/config.js、
 * src/components/public/CustomPublicRenderer.vue 与 README 徽章仍停留在旧版本，
 * 用户看到的「当前版本」与实际代码对不上。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(rootDir, path), 'utf8');

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const config = read('functions/modules/config.js');
const renderer = read('src/components/public/CustomPublicRenderer.vue');
const readme = read('README.md');
const readmeZh = read('README-zh.md');

describe('version consistency', () => {
    it('package.json 与 lockfile 的版本一致', () => {
        expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(lock.version).toBe(pkg.version);
        expect(lock.packages[''].version).toBe(pkg.version);
    });

    it('后端 SYSTEM_CONSTANTS.VERSION 与 package.json 一致', () => {
        expect(config).toContain("VERSION: '" + pkg.version + "',");
    });

    it('公开页渲染器的模板变量版本与 package.json 一致', () => {
        expect(renderer).toContain("version: '" + pkg.version + "',");
    });

    it('README 徽章、版本文案与更新日志版本与 package.json 一致', () => {
        expect(readme).toContain('badge/version-v' + pkg.version + '-indigo.svg');
        expect(readme).toContain('Current version: `v' + pkg.version + '`');
        expect(readmeZh).toContain('badge/version-v' + pkg.version + '-indigo.svg');
        expect(readmeZh).toContain('### v' + pkg.version + ' (');
    });
});
