import { describe, it, expect } from 'vitest';
import { addFlagEmoji, prependNodeName } from '../../functions/utils/node-utils.js';
import { convertClashProxyToUrl } from '../../functions/utils/clash-to-url.js';
import { urlsToClashProxies } from '../../functions/utils/url-to-clash.js';

function buildSsrUrl(name = '台湾 1') {
    return convertClashProxyToUrl({
        name,
        type: 'ssr',
        server: 'example.com',
        port: 12345,
        protocol: 'auth_aes128_sha1',
        cipher: 'chacha20-ietf',
        obfs: 'http_simple',
        password: 'password',
        'obfs-param': 'microsoft.com',
        'protocol-param': 'user:pass',
        udp: true
    });
}

describe('node-utils', () => {
    it('prependNodeName 应在 hash 非法编码时安全回退而不是抛错', () => {
        const malformed = 'vless://uuid@example.com:443?security=tls#%E0%A4%A';

        expect(() => prependNodeName(malformed, '手动节点')).not.toThrow();

        const renamed = prependNodeName(malformed, '手动节点');
        expect(renamed).toContain('#');
        expect(decodeURIComponent(renamed.split('#')[1])).toContain('手动节点');
    });

    it('prependNodeName 应更新 SSR remarks 而不是追加会破坏解析的 hash', () => {
        const renamed = prependNodeName(buildSsrUrl('台湾 1'), '月兔');
        const proxies = urlsToClashProxies([renamed]);

        expect(renamed).not.toContain('#');
        expect(proxies).toHaveLength(1);
        expect(proxies[0].type).toBe('ssr');
        expect(proxies[0].name).toContain('月兔 - 台湾 1');
    });

    it('addFlagEmoji 应保持 SSR 节点可解析', () => {
        const withFlag = addFlagEmoji(buildSsrUrl('台湾 1'));
        const proxies = urlsToClashProxies([withFlag]);

        expect(withFlag).not.toContain('#');
        expect(proxies).toHaveLength(1);
        expect(proxies[0].type).toBe('ssr');
        expect(proxies[0].name).toContain('台湾 1');
    });

    it('TUIC 节点密码包含 URL 保留字符时应保持可回环解析', () => {
        const proxy = {
            name: 'TUIC Special',
            type: 'tuic',
            server: 'tuic.example.com',
            port: 443,
            uuid: '11111111-1111-1111-1111-111111111111',
            password: 'p@ss:word%23?x',
            sni: 'tuic.example.com',
            alpn: ['h3'],
            'skip-cert-verify': true,
            'congestion-controller': 'bbr',
            'udp-relay-mode': 'native'
        };

        const url = convertClashProxyToUrl(proxy);
        const proxies = urlsToClashProxies([url]);

        expect(url).toContain('p%40ss%3Aword%2523%3Fx');
        expect(proxies).toHaveLength(1);
        expect(proxies[0]).toMatchObject({
            type: 'tuic',
            server: proxy.server,
            port: proxy.port,
            uuid: proxy.uuid,
            password: proxy.password,
            sni: proxy.sni,
            'congestion-controller': 'bbr',
            'udp-relay-mode': 'native'
        });
        expect(proxies[0].alpn).toEqual(['h3']);
    });

    it('SS Clash YAML 节点的 obfs plugin-opts 应在 URL 转换中保留并可回环解析', () => {
        const proxy = {
            name: 'HK-1',
            type: 'ss',
            server: 'example.com',
            port: 2400,
            udp: true,
            'udp-over-tcp': true,
            cipher: 'chacha20-ietf-poly1305',
            password: 'EG1dv6Hw9PCHv40QThZjFZmkHThfsUk9',
            plugin: 'obfs',
            'plugin-opts': {
                mode: 'tls',
                host: 'abcd.apple.com:215275'
            }
        };

        const url = convertClashProxyToUrl(proxy);
        const proxies = urlsToClashProxies([url]);

        expect(url).toContain('plugin=obfs');
        expect(url).toContain('obfs=tls');
        expect(url).toContain('obfs-host=abcd.apple.com%3A215275');
        expect(proxies).toHaveLength(1);
        expect(proxies[0]).toMatchObject({
            type: 'ss',
            server: 'example.com',
            port: 2400,
            cipher: 'chacha20-ietf-poly1305',
            password: 'EG1dv6Hw9PCHv40QThZjFZmkHThfsUk9',
            plugin: 'obfs',
            'plugin-opts': {
                mode: 'tls',
                host: 'abcd.apple.com:215275'
            }
        });
    });
});
