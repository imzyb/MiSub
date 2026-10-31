import { describe, it, expect } from 'vitest';
import { inferAirportRootDomain } from '../../functions/services/subscription-service.js';
import { inferAirportRootDomain as inferFrontend } from '../../src/utils/airport-domain.js';

describe('inferAirportRootDomain', () => {
    it('去掉常见子域前缀取主域名', () => {
        expect(inferAirportRootDomain('https://sub1.gsafevpn.com/957baaca8fc/abc')).toBe(
            'gsafevpn.com'
        );
        expect(inferAirportRootDomain('https://dy11.baipiaoyes.com/api/v1/client/subscribe')).toBe(
            'baipiaoyes.com'
        );
        expect(inferAirportRootDomain('https://api.5ufclub.com/vclash/xxx')).toBe('5ufclub.com');
        expect(inferAirportRootDomain('https://jms.937745389.xyz/')).toBe('937745389.xyz');
    });

    it('数字后缀前缀（dy11 / sub12 / node3）也能识别', () => {
        expect(inferAirportRootDomain('https://sub12.example.com/x')).toBe('example.com');
        expect(inferAirportRootDomain('https://node3.example.com/x')).toBe('example.com');
    });

    it('CDN / 托管平台域名不视为机场自有域名', () => {
        expect(inferAirportRootDomain('https://edg-2oo.pages.dev/sub')).toBe('');
        expect(inferAirportRootDomain('https://foo.workers.dev/x')).toBe('');
        expect(
            inferAirportRootDomain('https://gist.githubusercontent.com/raw/abc/sub_b64.txt')
        ).toBe('');
        expect(inferAirportRootDomain('https://debian12.trafficmanager.net/x')).toBe('');
    });

    it('裸域名与两段域名原样保留', () => {
        expect(inferAirportRootDomain('https://example.com/sub')).toBe('example.com');
        expect(inferAirportRootDomain('https://www.example.com/sub')).toBe('example.com');
    });

    it('非 http 链接/非法输入返回空', () => {
        expect(inferAirportRootDomain('vless://uuid@1.2.3.4:443')).toBe('');
        expect(inferAirportRootDomain('')).toBe('');
        expect(inferAirportRootDomain(null)).toBe('');
        expect(inferAirportRootDomain('not-a-url')).toBe('');
    });

    it('正确保留多段公共后缀及其注册域名', () => {
        const samples = [
            ['https://abc.com.cn/sub', 'abc.com.cn'],
            ['https://foo.co.uk/sub', 'foo.co.uk'],
            ['https://sub.api.abc.com.cn/sub', 'abc.com.cn'],
            ['https://sub.api.foo.co.uk/sub', 'foo.co.uk'],
            ['https://sub.api.foo.com.cn/sub', 'foo.com.cn'],
            ['https://sub.foo.appspot.com/sub', 'foo.appspot.com'],
            ['https://example.org/sub', 'example.org'],
        ];
        for (const [url, expected] of samples) {
            expect(inferAirportRootDomain(url)).toBe(expected);
            expect(inferFrontend(url)).toBe(expected);
        }
    });

    it('多级子域归并至机场根域，但不把普通多级后缀误当成机场子域', () => {
        expect(inferAirportRootDomain('https://sub.api.foo.com/x')).toBe('foo.com');
        expect(inferFrontend('https://sub.api.foo.com/x')).toBe('foo.com');
    });

    it('前后端实现保持一致', () => {
        const samples = [
            'https://sub1.gsafevpn.com/a/b',
            'https://dy11.baipiaoyes.com/x',
            'https://edg-2oo.pages.dev/sub',
            'https://example.com/',
            'https://jms.937745389.xyz/',
            'https://abc.com.cn/sub',
            'https://foo.co.uk/sub',
            'https://sub.api.abc.com.cn/sub',
            'https://sub.api.foo.co.uk/sub',
            'https://example.org/sub',
        ];
        for (const url of samples) {
            expect(inferFrontend(url)).toBe(inferAirportRootDomain(url));
        }
    });
});
