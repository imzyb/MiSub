import { describe, it, expect } from 'vitest';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';

describe('Sing-Box 内置生成器', () => {
    it('should generate a JSON config with outbounds', () => {
        const result = generateBuiltinSingboxConfig([
            'trojan://password@1.2.3.4:443#TestNode',
            'trojan://password@1.2.3.5:443#JPNode'
        ].join('\n'));
        const parsed = JSON.parse(result);

        expect(Array.isArray(parsed.outbounds)).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === 'TestNode')).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🚀 节点选择')).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🎬 视频广告')).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🍎 Apple')).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🇯🇵 日本节点' && outbound.type === 'urltest')).toBe(true);
        expect(parsed.route.final).toBe('🚀 节点选择');
    });

    it('should enable TLS for https and socks5-tls', () => {
        const result = generateBuiltinSingboxConfig([
            'https://user:pass@1.2.3.4:443#HttpsNode',
            'socks5://user:pass@5.6.7.8:1080#PlainSocks',
            'socks5://user:pass@5.6.7.8:1081?tls=1#TlsSocks'
        ].join('\n'));
        const parsed = JSON.parse(result);
        const httpsNode = parsed.outbounds.find(outbound => outbound.tag === 'HttpsNode');
        const socksNode = parsed.outbounds.find(outbound => outbound.tag === 'TlsSocks');

        expect(httpsNode?.tls?.enabled).toBe(true);
        expect(socksNode?.tls?.enabled).toBe(true);
    });

    it('should map trojan websocket transport', () => {
        const result = generateBuiltinSingboxConfig('trojan://password@1.2.3.4:443?type=ws&path=%2Fws&host=example.com&sni=example.org#TrojanWS');
        const parsed = JSON.parse(result);
        const trojanNode = parsed.outbounds.find(outbound => outbound.tag === 'TrojanWS');

        expect(trojanNode?.type).toBe('trojan');
        expect(trojanNode?.tls?.enabled).toBe(true);
        expect(trojanNode?.tls?.server_name).toBe('example.org');
        expect(trojanNode?.transport?.type).toBe('ws');
        expect(trojanNode?.transport?.path).toBe('/ws');
        expect(trojanNode?.transport?.headers?.Host).toBe('example.com');
    });

    it('should map anytls outbound', () => {
        const result = generateBuiltinSingboxConfig('anytls://pass-anytls@anytls.example.com:443/?sni=example.com&allowInsecure=1#AnyTLSNode');
        const parsed = JSON.parse(result);
        const anytlsNode = parsed.outbounds.find(outbound => outbound.tag === 'AnyTLSNode');

        expect(anytlsNode?.type).toBe('anytls');
        expect(anytlsNode?.server).toBe('anytls.example.com');
        expect(anytlsNode?.server_port).toBe(443);
        expect(anytlsNode?.password).toBe('pass-anytls');
        expect(anytlsNode?.tls?.enabled).toBe(true);
        expect(anytlsNode?.tls?.server_name).toBe('example.com');
        expect(anytlsNode?.tls?.insecure).toBe(true);
    });
});
