import { describe, it, expect } from 'vitest';
import {
    createDisguiseResponse,
    renderDisguisePage,
} from '../../functions/modules/disguise-page.js';

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
});
