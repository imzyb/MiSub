import { describe, it, expect } from 'vitest';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';

const SS2022_V2RAY_PLUGIN_NODE = 'ss://MjAyMi1ibGFrZTMtYWVzLTI1Ni1nY206TldSak1UVmxNVFZtTWpnMU5HRTVaRGsxT1dJd1pUUm1ZbVJrTnpkaU5qTT0@cf.090227.xyz:8080?plugin=v2ray-plugin%3Bmode%3Dwebsocket%3Bhost%3Dss.2227tsj.workers.dev%3Bpath%3D%2F%3Fenc%5C%3D2022-blake3-aes-256-gcm%3Bmux%3D0#2022-blake3-aes-256-gcm';

describe('Built-in Sing-box generator', () => {
    it('should generate a JSON config with outbounds', () => {
        const result = generateBuiltinSingboxConfig([
            'trojan://password@1.2.3.4:443#TestNode',
            'trojan://password@1.2.3.5:443#JPNode'
        ].join('\n'));
        const parsed = JSON.parse(result);

        expect(Array.isArray(parsed.outbounds)).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag.endsWith('TestNode'))).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag.includes('节点选择'))).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag.includes('视频广告'))).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag.includes('Apple'))).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag.includes('日本') && outbound.type === 'urltest')).toBe(true);
        expect(parsed.route.final).toContain('节点选择');
    });

    it('should enable TLS for https and socks5-tls', () => {
        const result = generateBuiltinSingboxConfig([
            'https://user:pass@1.2.3.4:443#HttpsNode',
            'socks5://user:pass@5.6.7.8:1080#PlainSocks',
            'socks5://user:pass@5.6.7.8:1081?tls=1#TlsSocks'
        ].join('\n'));
        const parsed = JSON.parse(result);
        const httpsNode = parsed.outbounds.find(outbound => outbound.tag.endsWith('HttpsNode'));
        const socksNode = parsed.outbounds.find(outbound => outbound.tag.endsWith('TlsSocks'));

        expect(httpsNode?.tls?.enabled).toBe(true);
        expect(socksNode?.tls?.enabled).toBe(true);
    });

    it('should map trojan websocket transport', () => {
        const result = generateBuiltinSingboxConfig('trojan://password@1.2.3.4:443?type=ws&path=%2Fws&host=example.com&sni=example.org#TrojanWS');
        const parsed = JSON.parse(result);
        const trojanNode = parsed.outbounds.find(outbound => outbound.tag.endsWith('TrojanWS'));

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
        const anytlsNode = parsed.outbounds.find(outbound => outbound.tag.endsWith('AnyTLSNode'));

        expect(anytlsNode?.type).toBe('anytls');
        expect(anytlsNode?.server).toBe('anytls.example.com');
        expect(anytlsNode?.server_port).toBe(443);
        expect(anytlsNode?.password).toBe('pass-anytls');
        expect(anytlsNode?.tls?.enabled).toBe(true);
        expect(anytlsNode?.tls?.server_name).toBe('example.com');
        expect(anytlsNode?.tls?.insecure).toBe(true);
    });

    it('should map SS2022 v2ray-plugin websocket without forcing TLS', () => {
        const result = generateBuiltinSingboxConfig(SS2022_V2RAY_PLUGIN_NODE);
        const parsed = JSON.parse(result);
        const ssNode = parsed.outbounds.find(outbound => outbound.type === 'shadowsocks');

        expect(ssNode?.method).toBe('2022-blake3-aes-256-gcm');
        expect(ssNode?.transport?.type).toBe('ws');
        expect(ssNode?.transport?.path).toBe('/?enc=2022-blake3-aes-256-gcm');
        expect(ssNode?.transport?.headers?.Host).toBe('ss.2227tsj.workers.dev');
        expect(ssNode?.tls).toBeUndefined();
    });

    it('should map TUIC extended parameters documented by sing-box', () => {
        const result = generateBuiltinSingboxConfig('tuic://uuid-tuic:pass-tuic@tuic.example.com:443?sni=tuic.example.com&congestion_control=bbr&udp_relay_mode=quic&udp_over_stream=1&zero_rtt_handshake=1&heartbeat=10s&allow_insecure=1#TUICNode');
        const parsed = JSON.parse(result);
        const tuicNode = parsed.outbounds.find(outbound => outbound.tag.endsWith('TUICNode'));

        expect(tuicNode?.type).toBe('tuic');
        expect(tuicNode?.congestion_control).toBe('bbr');
        expect(tuicNode?.udp_relay_mode).toBe('quic');
        expect(tuicNode?.udp_over_stream).toBe(true);
        expect(tuicNode?.zero_rtt_handshake).toBe(true);
        expect(tuicNode?.heartbeat).toBe('10s');
        expect(tuicNode?.tls?.server_name).toBe('tuic.example.com');
        expect(tuicNode?.tls?.insecure).toBe(true);
    });
});
