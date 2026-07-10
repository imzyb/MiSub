import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { generateBuiltinClashConfig, generateProxiesOnly } from '../../functions/modules/subscription/builtin-clash-generator.js';

describe('Clash 内置生成器', () => {
    it('应清理节点列表中的控制字符', () => {
        const nodeWithControl = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#Test\x00SS';
        const result = generateBuiltinClashConfig(nodeWithControl);
        expect(result).toContain('TestSS');
    });

    it('proxies-only 也应清理控制字符', () => {
        const nodeWithControl = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#Test\x00SS';
        const result = generateProxiesOnly(nodeWithControl);
        expect(result).toContain('TestSS');
    });
    it('should render SS v2ray-plugin mux as a boolean for Clash compatibility', () => {
        const node = 'ss://MjAyMi1ibGFrZTMtYWVzLTI1Ni1nY206TldSak1UVmxNVFZtTWpnMU5HRTVaRGsxT1dJd1pUUm1ZbVJrTnpkaU5qTT0@cf.090227.xyz:8080?plugin=v2ray-plugin%3Bmode%3Dwebsocket%3Bhost%3Dss.2227tsj.workers.dev%3Bpath%3D%2F%3Fenc%5C%3D2022-blake3-aes-256-gcm%3Bmux%3D0#2022-blake3-aes-256-gcm';
        const result = generateProxiesOnly(node);

        expect(result).toContain('plugin: v2ray-plugin');
        expect(result).toContain('mode: websocket');
        expect(result).toContain('path: /?enc=2022-blake3-aes-256-gcm');
        expect(result).toContain('mux: false');
        expect(result).not.toContain('mux: "0"');
        expect(result).not.toContain("mux: '0'");
    });

    it('应生成可被 YAML 解析的 WireGuard 配置', () => {
        const node = 'wireguard://privatekey@1.2.3.8:51820?publickey=peerpub&reserved=1,2,3&address=172.16.0.2/32#WG-01';

        const result = generateBuiltinClashConfig(node);
        const parsed = yaml.load(result);

        expect(parsed.proxies[0].type).toBe('wireguard');
        expect(parsed.proxies[0]['remote-dns-resolve']).toBe(true);
    });

    it('不应在 Clash 输出中泄露内部 metadata 字段', () => {
        const node = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#HK-Test';

        const fullConfig = yaml.load(generateBuiltinClashConfig(node));
        const proxiesOnly = yaml.load(generateProxiesOnly(node));

        expect(fullConfig.proxies[0]).not.toHaveProperty('metadata');
        expect(proxiesOnly.proxies[0]).not.toHaveProperty('metadata');
    });

    it('应将 TUIC URL 的 congestion_control 转为 Clash/Mihomo 兼容字段', () => {
        const node = 'tuic://uuid-tuic:pass-tuic@tuic.example.com:443?sni=tuic.example.com&congestion_control=bbr&udp_relay_mode=native&alpn=h3&allow_insecure=1#TUICNode';

        const fullConfig = yaml.load(generateBuiltinClashConfig(node));
        const proxiesOnly = yaml.load(generateProxiesOnly(node));

        for (const parsed of [fullConfig, proxiesOnly]) {
            expect(parsed.proxies[0].type).toBe('tuic');
            expect(parsed.proxies[0]['congestion-controller']).toBe('bbr');
            expect(parsed.proxies[0]).not.toHaveProperty('congestion-control');
            expect(parsed.proxies[0]['udp-relay-mode']).toBe('native');
        }
    });

    it('应保留 TUIC URL 中包含特殊字符的密码且不污染 server', () => {
        const node = 'tuic://11111111-1111-1111-1111-111111111111:p%40ss%3Aword@tuic.example.com:443?sni=tuic.example.com&alpn=h3#TUICNode';

        const fullConfig = yaml.load(generateBuiltinClashConfig(node));
        const proxy = fullConfig.proxies[0];

        expect(proxy.type).toBe('tuic');
        expect(proxy.server).toBe('tuic.example.com');
        expect(proxy.uuid).toBe('11111111-1111-1111-1111-111111111111');
        expect(proxy.password).toBe('p@ss:word');
        expect(proxy.alpn).toEqual(['h3']);
    });

    it('应将用户自定义地区覆盖规则应用到内置策略组', () => {
        const nodes = [
            'trojan://password@1.2.3.4:443#机场A 新加坡 原生',
            'trojan://password@1.2.3.5:443#机场A US-West'
        ].join('\n');

        const fullConfig = yaml.load(generateBuiltinClashConfig(nodes, {
            regionOverrides: [{ pattern: '新加坡 原生', region: '美国' }]
        }));
        const usGroup = fullConfig['proxy-groups'].find(group => group.name === '🇺🇸 美国节点');
        const sgGroup = fullConfig['proxy-groups'].find(group => group.name === '🇸🇬 狮城节点');

        expect(usGroup.proxies).toContain('🇸🇬 机场A 新加坡 原生');
        expect(usGroup.proxies).toContain('🇺🇸 机场A US-West');
        expect(sgGroup).toBeUndefined();
    });
});
