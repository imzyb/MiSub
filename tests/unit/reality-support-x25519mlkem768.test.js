import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { urlToClashProxy, urlsToClashProxies } from '../../functions/utils/url-to-clash.js';
import { convertClashProxyToUrl } from '../../functions/utils/clash-to-url.js';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { extractValidNodes } from '../../functions/modules/utils/node-parser.js';

describe('VLESS / Reality support-x25519mlkem768 特性支持', () => {
    it('标准 VLESS Reality 节点不带开关参数时不自动启用 x25519mlkem768', () => {
        const url =
            'vless://uuid-1234@reality.example.com:443?security=reality&pbk=pubkey123&sid=sid123&fp=chrome#RealityNode';
        const proxy = urlToClashProxy(url);

        expect(proxy).toBeTruthy();
        expect(proxy.tls).toBe(true);
        expect(proxy['reality-opts']).toBeDefined();
        expect(proxy['reality-opts']['public-key']).toBe('pubkey123');
        expect(proxy['reality-opts']['short-id']).toBe('sid123');
        expect(proxy['reality-opts']['support-x25519mlkem768']).toBeUndefined();
    });

    it('当 URL 显式指定 support-x25519mlkem768=false 或 0 时不应启用', () => {
        const urlFalse =
            'vless://uuid-1234@reality.example.com:443?security=reality&pbk=pubkey123&sid=sid123&support-x25519mlkem768=false#Disabled';
        const proxyFalse = urlToClashProxy(urlFalse);
        expect(proxyFalse['reality-opts']['support-x25519mlkem768']).toBeUndefined();

        const urlZero =
            'vless://uuid-1234@reality.example.com:443?security=reality&pbk=pubkey123&sid=sid123&sxm=0#DisabledZero';
        const proxyZero = urlToClashProxy(urlZero);
        expect(proxyZero['reality-opts']['support-x25519mlkem768']).toBeUndefined();
    });

    it('当 URL 显式包含 sxm=1 时应正确启用', () => {
        const url =
            'vless://uuid-1234@reality.example.com:443?security=reality&pbk=pubkey123&sid=sid123&sxm=1#SxmNode';
        const proxy = urlToClashProxy(url);
        expect(proxy['reality-opts']['support-x25519mlkem768']).toBe(true);
    });

    it('非 Reality 节点（如普通 VLESS+TLS 或直连）绝不能附加 reality-opts', () => {
        const normalTls =
            'vless://uuid-1234@tls.example.com:443?security=tls&sni=tls.example.com#NormalTLS';
        const proxyTls = urlToClashProxy(normalTls);
        expect(proxyTls.tls).toBe(true);
        expect(proxyTls['reality-opts']).toBeUndefined();

        const plain = 'vless://uuid-1234@plain.example.com:80?type=ws#Plain';
        const proxyPlain = urlToClashProxy(plain);
        expect(proxyPlain.tls).toBeUndefined();
        expect(proxyPlain['reality-opts']).toBeUndefined();
    });

    it('convertClashProxyToUrl 应能保留 reality-opts 中的 support-x25519mlkem768', () => {
        const proxy = {
            name: 'Test-Reality',
            type: 'vless',
            server: 'reality.example.com',
            port: 443,
            uuid: 'uuid-1234',
            tls: true,
            'reality-opts': {
                'public-key': 'pubkey123',
                'short-id': 'sid123',
                'support-x25519mlkem768': true,
            },
        };

        const url = convertClashProxyToUrl(proxy);
        expect(url).toContain('security=reality');
        expect(url).toContain('support-x25519mlkem768=true');
    });

    it('generateBuiltinClashConfig 生成的 YAML 中应正确包含 support-x25519mlkem768: true', () => {
        const url =
            'vless://uuid-1234@reality.example.com:443?security=reality&pbk=pubkey123&sid=sid123&support-x25519mlkem768=true#MyReality';
        const yamlConfig = generateBuiltinClashConfig(url);
        const parsed = yaml.load(yamlConfig);

        expect(parsed.proxies).toHaveLength(1);
        expect(parsed.proxies[0]['reality-opts']).toEqual({
            'public-key': 'pubkey123',
            'short-id': 'sid123',
            'support-x25519mlkem768': true,
        });
    });

    it('urlsToClashProxies 应支持 options.supportX25519mlkem768 选项显式关闭', () => {
        const url =
            'vless://uuid-1234@reality.example.com:443?security=reality&pbk=pubkey123&sid=sid123#MyReality';
        const [proxy] = urlsToClashProxies([url], { supportX25519mlkem768: false });

        expect(proxy['reality-opts']).toEqual({
            'public-key': 'pubkey123',
            'short-id': 'sid123',
        });
    });

    it('Trojan Reality 不带开关参数时不应自动启用 support-x25519mlkem768', () => {
        const trojanUrl =
            'trojan://password123@trojan.example.com:443?security=reality&pbk=pubkey123&sid=sid123#TrojanReality';
        const proxy = urlToClashProxy(trojanUrl);

        expect(proxy.type).toBe('trojan');
        expect(proxy['reality-opts']).toBeDefined();
        expect(proxy['reality-opts']['support-x25519mlkem768']).toBeUndefined();
    });
});