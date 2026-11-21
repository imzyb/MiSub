import { describe, it, expect, vi } from 'vitest';
import {
    createDisguiseResponse,
    renderDisguisePage,
} from '../../functions/modules/disguise-page.js';
import { onRequest } from '../../functions/[[path]].js';

/**
 * 伪装页加固测试：
 *  - 未授权订阅请求（token 不匹配）应返回伪装响应，而不是暴露服务存在的裸 403
 *  - 伪装响应不可被缓存
 *  - 404 伪装页的「返回首页」不应指向本站根路径（会造成死循环）
 */
describe('createDisguiseResponse', () => {
    it('redirects when pageType is redirect', () => {
        const res = createDisguiseResponse({
            enabled: true,
            pageType: 'redirect',
            redirectUrl: 'example.com',
        });
        expect(res.status).toBe(302);
        expect(res.headers.get('Location')).toBe('https://example.com/');
    });

    it('does not let disguise responses be cached', () => {
        const res = createDisguiseResponse({
            enabled: true,
            pageType: 'redirect',
            redirectUrl: 'https://example.com/game',
        });
        expect(res.headers.get('Cache-Control')).toContain('no-store');
    });

    it('falls back to a 404 page when redirect is not configured', () => {
        const res = createDisguiseResponse({ enabled: true, pageType: 'page' });
        expect(res.status).toBe(404);
        expect(res.headers.get('Content-Type')).toContain('text/html');
    });

    it('does not let the disguised 404 page be cached by the CDN', async () => {
        // 线上曾出现 /logo.png 持续 404：伪装页只发 no-cache，Cloudflare 仍按自己的
        // TTL 缓存了 4 小时，于是未登录时缓存的 404 会继续发给已登录用户。
        const res = createDisguiseResponse({ enabled: true, pageType: 'page' });
        expect(res.headers.get('Cache-Control')).toContain('no-store');
        expect(res.headers.get('CDN-Cache-Control')).toBe('no-store');
        expect(res.headers.get('Surrogate-Control')).toBe('no-store');
    });

    it('renders a home link pointing off-site when redirectUrl is set', async () => {
        const res = renderDisguisePage({
            enabled: true,
            pageType: 'redirect',
            redirectUrl: 'https://example.com/play',
        });
        const html = await res.text();
        // 不应指向本站根路径（会再次命中伪装逻辑）
        expect(html).not.toContain('href="/"');
        expect(html).toContain('https://example.com/play');
    });

    it('omits the home link when no off-site target is available', async () => {
        const res = renderDisguisePage({
            enabled: true,
            pageType: 'redirect',
            redirectUrl: '/local',
        });
        const html = await res.text();
        expect(html).not.toContain('href="/"');
        // 仅样式表里保留 .home-link 类定义，不应渲染出实际的链接元素
        expect(html).not.toContain('<a href=');
    });

    it('escapes HTML in the configured redirect url', async () => {
        const res = renderDisguisePage({
            enabled: true,
            redirectUrl: 'https://example.com/"><script>alert(1)</script>',
        });
        const html = await res.text();
        expect(html).not.toContain('"><script>');
    });

    it('returns an uncacheable plain 404 for brand assets while disguised', async () => {
        // /logo.png 是图片请求：回伪装 HTML 页会被 CDN 当静态资源缓存，
        // 已登录用户随后也拿到缓存的 404（线上现象）。
        const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        try {
            const response = await onRequest({
                request: new Request('https://example.com/logo.png'),
                env: {
                    MISUB_KV: {
                        async get() {
                            return JSON.stringify({ disguise: { enabled: true, pageType: 'page' } });
                        },
                        async put() {},
                        async delete() {},
                    },
                    ASSETS: { async fetch() { return new Response('asset'); } },
                },
                next: vi.fn(async () => new Response('next')),
            });

            expect(response.status).toBe(404);
            expect(response.headers.get('Content-Type')).toContain('text/plain');
            expect(response.headers.get('Cache-Control')).toContain('no-store');
            expect(response.headers.get('CDN-Cache-Control')).toBe('no-store');
        } finally {
            infoSpy.mockRestore();
        }
    });

    it('keeps the 404 page free of horizontal overflow on mobile', async () => {
        const res = renderDisguisePage({ enabled: true, pageType: 'page' });
        const html = await res.text();
        // body 必须是定位包含块，否则绝对定位的环境光斑会把文档撑宽，移动端整体偏移
        expect(html).toMatch(/body\s*{[^}]*position:\s*relative;/s);
        // 100vw 在移动端含滚动条宽度，容易撑出横向滚动
        expect(html).not.toContain('100vw');
    });
});
