/**
 * 接线守卫：全局错误处理器必须过滤非本站错误。
 *
 * src/utils/error-source.js 里的判定函数本身有单测，但如果没有被 main.js 真正
 * 接入全局监听器，噪音依然会走到 handleError 弹出「操作失败，请稍后重试」，
 * 并且浏览器控制台仍会打印扩展/跨域脚本的报错。这里锁定接线关系。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(path.resolve(process.cwd(), 'src/main.js'), 'utf-8');

describe('main.js 全局错误处理器接线', () => {
    it('引入来源判定工具', () => {
        expect(mainSource).toMatch(
            /import\s*\{[^}]*isForeignRejection[^}]*\}\s*from\s*'\.\/utils\/error-source\.js'/
        );
        expect(mainSource).toMatch(
            /import\s*\{[^}]*isAppScriptError[^}]*\}\s*from\s*'\.\/utils\/error-source\.js'/
        );
    });

    it('资源错误处理使用已定义的本地环境与同源判断', () => {
        expect(mainSource).toMatch(
            /import\s*\{[^}]*isLocalHost[^}]*isSameOriginUrl[^}]*\}\s*from\s*'\.\/utils\/url-origin\.js'/
        );
        expect(mainSource).toContain('const localHost = isLocalHost(window.location.hostname);');
        expect(mainSource).toContain('isSameOriginResource(resourceUrl)');
        expect(mainSource).not.toContain('if (isLocalHost &&');
    });

    const handlers = [
        ["'unhandledrejection'", 'isForeignRejection'],
        ["'error'", 'isAppScriptError'],
    ];

    it.each(handlers)('%s 处理器中使用 %s 过滤', (eventName, guard) => {
        const start = mainSource.indexOf(`addEventListener(${eventName}`);
        expect(start).toBeGreaterThan(-1);
        // 截取到下一个 addEventListener 之前，确保守卫在该处理器体内
        const next = mainSource.indexOf('addEventListener', start + 10);
        const body = mainSource.slice(start, next === -1 ? undefined : next);
        expect(body).toContain(guard);
        expect(body).toContain('event.preventDefault()');
    });

    it('被过滤的分支在调用 handleError 之前 return（不弹提示）', () => {
        const guard = mainSource.indexOf('isForeignRejection(event.reason)');
        expect(guard).toBeGreaterThan(-1);
        const branch = mainSource.slice(guard, guard + 200);
        expect(branch).toMatch(/return;/);
        expect(branch.indexOf('return;')).toBeLessThan(branch.indexOf('handleError'));
    });

    it('资源错误只在 JS/CSS 打包产物上才上报', () => {
        // 背景：伪装开启时服务端会对未鉴权的品牌资源（/logo.png、/favicon.*）返回伪装页
        // 或 404，这是有意的指纹防护（functions/[[path]].js 的 isBrandAsset 分支）。
        // 若把这类图片失败也当成致命错误，用户会看到「资源加载失败 (logo.png)」的误报，
        // 而刷新永远解决不了它。
        // 判定逻辑放在 utils（可被单测覆盖），main.js 只负责接线。
        expect(mainSource).toMatch(
            /import\s*\{[^}]*isCriticalAssetPath[^}]*\}\s*from\s*'\.\/utils\/url-origin\.js'/
        );
        // 重载判定与上报判定共用同一个谓词，避免两处正则漂移。
        expect(mainSource).toContain('if (!isCriticalAssetPath(resourcePath)) return false;');

        const start = mainSource.indexOf('tryRecoverAssetLoad(resourceUrl).then');
        expect(start).toBeGreaterThan(-1);
        const reportAt = mainSource.indexOf('handleError(', start);
        expect(reportAt).toBeGreaterThan(start);

        const branch = mainSource.slice(start, reportAt);
        const guardAt = branch.indexOf('if (!isCriticalAssetPath(resourcePath))');
        expect(guardAt).toBeGreaterThan(-1);
        // 非关键资源必须在 handleError 之前 return。
        expect(branch.slice(guardAt)).toMatch(/return;/);
    });

    it('写不进「已重载」标记时不得重载（否则无限刷新）', () => {
        // 背景：站点数据被禁用时 sessionStorage 不可用，「已重载过」永远读不到。
        // 此时若仍然放行重载，每次重载都会再次失败 → 无限刷新循环
        // （真实浏览器实测：5 秒内 62 次文档请求）。
        // 必须检查写入结果，失败就放弃自动恢复。
        expect(mainSource).toMatch(/if\s*\(!markAssetReloaded\(\)\)/);
        expect(mainSource).toContain('skip auto recovery');

        const start = mainSource.indexOf('const tryRecoverAssetLoad');
        expect(start).toBeGreaterThan(-1);
        const end = mainSource.indexOf('window.addEventListener(', start);
        const body = mainSource.slice(start, end);

        // 判定顺序：先看「已经重载过」，再写标记，写失败即退出
        const alreadyAt = body.indexOf('if (hasAssetReloaded()) return false;');
        const markAt = body.indexOf('if (!markAssetReloaded())');
        expect(alreadyAt).toBeGreaterThan(-1);
        expect(markAt).toBeGreaterThan(alreadyAt);

        // 写失败的分支必须在真正触发重载（location.replace）之前 return
        const reloadAt = body.indexOf('window.location.replace');
        expect(reloadAt).toBeGreaterThan(markAt);
        expect(body.slice(markAt, reloadAt)).toMatch(/return false;/);
    });
});
