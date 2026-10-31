import { describe, expect, it } from 'vitest';
import { isCriticalAssetPath, isLocalHost, isSameOriginUrl } from '../../src/utils/url-origin.js';

describe('URL origin helpers', () => {
    const origin = 'https://example.com';
    const baseUrl = `${origin}/dashboard`;

    it('accepts same-origin absolute and relative URLs', () => {
        expect(isSameOriginUrl(`${origin}/assets/app.js`, origin, baseUrl)).toBe(true);
        expect(isSameOriginUrl('/assets/app.js?v=1', origin, baseUrl)).toBe(true);
    });

    it('rejects lookalike and third-party origins', () => {
        expect(isSameOriginUrl('https://example.com.evil.test/assets/app.js', origin)).toBe(false);
        expect(isSameOriginUrl('https://third-party.test/assets/app.js', origin)).toBe(false);
    });

    it('rejects malformed and empty values', () => {
        expect(isSameOriginUrl('', origin)).toBe(false);
        expect(isSameOriginUrl('javascript:alert(1)', origin)).toBe(false);
        expect(isSameOriginUrl('https://[invalid-host', origin)).toBe(false);
    });

    it.each(['localhost', '127.0.0.1', '::1', '[::1]'])('recognizes local host %s', (host) => {
        expect(isLocalHost(host)).toBe(true);
    });

    it('does not classify public hosts as local', () => {
        expect(isLocalHost('example.com')).toBe(false);
    });

    describe('isCriticalAssetPath', () => {
        it('accepts bundled JS/CSS', () => {
            expect(isCriticalAssetPath('/assets/index-DX_rRdMB.js')).toBe(true);
            expect(isCriticalAssetPath('/assets/js/DashboardView-ClkcgaNI.js')).toBe(true);
            expect(isCriticalAssetPath('/assets/main-Bd1Nq0.css')).toBe(true);
            // 大小写不敏感，hash 后可能带查询串以外的扩展名写法
            expect(isCriticalAssetPath('/assets/main.CSS')).toBe(true);
        });

        it('rejects non-critical resources', () => {
            // 伪装开启时服务端会**有意**对未鉴权的品牌资源返回伪装页或 404，
            // 这些失败不能当成致命错误（见 functions/[[path]].js 的 isBrandAsset 分支）。
            expect(isCriticalAssetPath('/logo.png')).toBe(false);
            expect(isCriticalAssetPath('/favicon.ico')).toBe(false);
            expect(isCriticalAssetPath('/favicon.png')).toBe(false);
            expect(isCriticalAssetPath('/assets/logo.png')).toBe(false);
            expect(isCriticalAssetPath('/assets/font.woff2')).toBe(false);
            expect(isCriticalAssetPath('/manifest.webmanifest')).toBe(false);
            // 不在 assets/ 目录下的 JS 也不算打包产物
            expect(isCriticalAssetPath('/sw.js')).toBe(false);
        });

        it('tolerates empty and malformed input', () => {
            expect(isCriticalAssetPath('')).toBe(false);
            expect(isCriticalAssetPath(undefined)).toBe(false);
            expect(isCriticalAssetPath(null)).toBe(false);
        });
    });
});
