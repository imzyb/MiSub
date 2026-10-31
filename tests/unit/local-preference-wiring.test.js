/**
 * 接线守卫：裸 localStorage / sessionStorage 访问必须收敛到受控助手。
 *
 * 为什么需要这个守卫：
 * 1. 浏览器禁用站点数据（隐私模式 / 站点权限被关）时，光是**读取** Web Storage
 *    就会抛 SecurityError。若在 store / composable / setup 阶段裸读，整个应用
 *    直接白屏起不来。
 * 2. 写入侧更隐蔽：Safari 无痕模式与部分隐私扩展下 setItem 不抛错也不落盘，
 *    只靠 try/catch 无法识别，必须回读校验。
 * 3. sessionStorage 侧还有第三重风险：chunk 重载恢复靠它记「已重载过」，
 *    写不进去时若仍然放行重载，会陷入无限刷新循环。
 *
 * 这三件事都在下面的豁免名单里统一处理，所以这里静态扫描全部源码，禁止绕过。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const BARE_ACCESS =
    /(?:localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem|clear)\s*\(/;

/**
 * 允许直接访问 Web Storage 的文件（每个都是自成一体的存储助手）。
 * 新增文件时必须显式加进来 —— 这个「麻烦」正是守卫的意义。
 */
const STORAGE_OWNERS = [
    'src/utils/local-preference.js', // localStorage：偏好读写 + 回读校验
    'src/utils/session-preference.js', // sessionStorage：会话偏好读写 + 回读校验
    'src/utils/chunk-reload.js', // sessionStorage：chunk 重载循环保护（需原子读写）
    'src/utils/cache-helper.js', // sessionStorage：带 TTL 的会话缓存
];

const allowedFiles = new Set(STORAGE_OWNERS.map((file) => path.resolve(process.cwd(), file)));
const LOCAL_PREFERENCE = path.resolve(process.cwd(), 'src/utils/local-preference.js');
const CHUNK_RELOAD = path.resolve(process.cwd(), 'src/utils/chunk-reload.js');

function collectSourceFiles(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(fullPath));
        } else if (/\.(js|vue)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

/** 去掉注释与字符串里的「假阳性」（如文档注释中举例 localStorage.getItem） */
function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('Web Storage 访问接线守卫', () => {
    const sourceFiles = collectSourceFiles(SRC_ROOT);

    it('扫描范围覆盖到源码目录（防止误删目录后守卫静默失效）', () => {
        expect(sourceFiles.length).toBeGreaterThan(100);
    });

    it('豁免名单里的文件都真实存在（防止改名后守卫悄悄放宽）', () => {
        for (const file of STORAGE_OWNERS) {
            expect(sourceFiles).toContain(path.resolve(process.cwd(), file));
        }
    });

    it('除受控助手外，源码里不存在裸 localStorage / sessionStorage 读写', () => {
        const offenders = [];
        for (const file of sourceFiles) {
            if (allowedFiles.has(file)) continue;
            const code = stripComments(readFileSync(file, 'utf-8'));
            if (BARE_ACCESS.test(code)) {
                offenders.push(path.relative(process.cwd(), file));
            }
        }
        expect(offenders).toEqual([]);
    });

    it('本地偏好助手提供完整的读写/删除能力', () => {
        const helperSource = readFileSync(LOCAL_PREFERENCE, 'utf-8');
        for (const fn of [
            'canUseLocalStorage',
            'readPreference',
            'writePreference',
            'readRawPreference',
            'writeRawPreference',
            'removePreference',
        ]) {
            expect(helperSource).toContain(`export function ${fn}`);
        }
    });

    it('写入路径必须回读校验，才能识别「不抛错也不落盘」的静默丢失', () => {
        const helperSource = readFileSync(LOCAL_PREFERENCE, 'utf-8');
        const writeBody = helperSource.slice(
            helperSource.indexOf('export function writePreference')
        );
        expect(writeBody).toMatch(/localStorage\.getItem\(key\)\s*===\s*serialized/);
    });

    it('chunk 重载助手在写标记失败时不得放行重载（否则无限刷新）', () => {
        const helperSource = readFileSync(CHUNK_RELOAD, 'utf-8');
        const body = helperSource.slice(
            helperSource.indexOf('export function shouldReloadForChunkError')
        );
        // getItem / setItem 必须在同一个 try 里，且 catch 分支返回 false
        expect(body).toMatch(/try\s*\{[\s\S]*sessionStorage\.setItem[\s\S]*\}\s*catch/);
        expect(body).toMatch(/catch[\s\S]*return false/);
    });
});
