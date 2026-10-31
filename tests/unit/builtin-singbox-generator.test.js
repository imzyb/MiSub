import { describe, it, expect } from 'vitest';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';

const SS2022_V2RAY_PLUGIN_NODE =
    'ss://MjAyMi1ibGFrZTMtYWVzLTI1Ni1nY206TldSak1UVmxNVFZtTWpnMU5HRTVaRGsxT1dJd1pUUm1ZbVJrTnpkaU5qTT0@cf.090227.xyz:8080?plugin=v2ray-plugin%3Bmode%3Dwebsocket%3Bhost%3Dss.2227tsj.workers.dev%3Bpath%3D%2F%3Fenc%5C%3D2022-blake3-aes-256-gcm%3Bmux%3D0#2022-blake3-aes-256-gcm';

describe('Built-in Sing-box generator', () => {
    it('should generate a JSON config with outbounds', () => {
        const result = generateBuiltinSingboxConfig(
            ['trojan://password@1.2.3.4:443#TestNode', 'trojan://password@1.2.3.5:443#JPNode'].join(
                '\n'
            )
        );
        const parsed = JSON.parse(result);

        expect(Array.isArray(parsed.outbounds)).toBe(true);
        expect(parsed.outbounds.some((outbound) => outbound.tag.endsWith('TestNode'))).toBe(true);
        expect(parsed.outbounds.some((outbound) => outbound.tag.includes('节点选择'))).toBe(true);
        expect(parsed.outbounds.some((outbound) => outbound.tag.includes('视频广告'))).toBe(true);
        expect(parsed.outbounds.some((outbound) => outbound.tag.includes('Apple'))).toBe(true);
        expect(
            parsed.outbounds.some(
                (outbound) => outbound.tag.includes('日本') && outbound.type === 'urltest'
            )
        ).toBe(true);
        expect(parsed.route.final).toContain('节点选择');
    });

    it('should include a tun inbound for sing-box Android client deployment', () => {
        const result = generateBuiltinSingboxConfig('trojan://password@1.2.3.4:443#AndroidNode');
        const parsed = JSON.parse(result);

        expect(parsed.inbounds).toEqual([
            expect.objectContaining({
                type: 'tun',
                tag: 'tun-in',
                auto_route: true,
                strict_route: true,
                stack: 'mixed',
            }),
        ]);
        expect(parsed.inbounds[0].address).toEqual(expect.arrayContaining(['172.19.0.1/30']));
        expect(parsed.route.auto_detect_interface).toBe(true);
        expect(parsed.route.default_domain_resolver).toBe('dns-cn-1');
        expect(parsed.dns.rules).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ action: 'route', server: 'dns-cn-1' }),
            ])
        );
        expect(parsed.dns.rules).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    rule_set: ['geosite-cn'],
                    action: 'route',
                    server: 'dns-cn-1',
                }),
            ])
        );
        expect(parsed.route.rule_set).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ tag: 'geosite-cn', type: 'remote', format: 'binary' }),
            ])
        );
        expect(
            parsed.outbounds.find((outbound) => outbound.tag === '🌐 DNS 出口')?.outbounds
        ).not.toContain('DIRECT');
    });

    it('should enable TLS for https and socks5-tls', () => {
        const result = generateBuiltinSingboxConfig(
            [
                'https://user:***@1.2.3.4:443#HttpsNode',
                'https://user:pass@9.8.7.6:443?allowInsecure=1#TlsHttpNode',
                'socks5://user:pass@5.6.7.8:1080#PlainSocks',
                'socks5://user:pass@5.6.7.8:1081?tls=1#TlsSocks',
            ].join('\n')
        );
        const parsed = JSON.parse(result);
        const httpsNode = parsed.outbounds.find((outbound) => outbound.tag.endsWith('HttpsNode'));
        const socksNode = parsed.outbounds.find((outbound) => outbound.tag.endsWith('TlsSocks'));
        const tlsHttpNode = parsed.outbounds.find((outbound) => outbound.tag.endsWith('TlsHttpNode'));

        expect(httpsNode?.tls?.enabled).toBe(true);
        expect(socksNode?.tls?.enabled).toBe(true);
        expect(tlsHttpNode?.tls?.enabled).toBe(true);
        expect(tlsHttpNode?.tls?.insecure).toBe(true);
    });

    it('uses split DNS server objects while preserving Trojan websocket transport', () => {
        const result = generateBuiltinSingboxConfig(
            'trojan://password@1.2.3.4:443?type=ws&path=%2Fws&host=example.com&sni=example.org#TrojanWS'
        );
        const parsed = JSON.parse(result);
        const trojanNode = parsed.outbounds.find((outbound) => outbound.tag.endsWith('TrojanWS'));

        expect(parsed.dns.servers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'udp', server: '223.5.5.5', server_port: 53 }),
                expect.objectContaining({ type: 'udp', server: '8.8.8.8', detour: '🌐 DNS 出口' }),
            ])
        );
        expect(parsed.dns.servers.every((server) => !Object.hasOwn(server, 'address'))).toBe(true);
        expect(trojanNode?.type).toBe('trojan');
        expect(trojanNode?.tls?.enabled).toBe(true);
        expect(trojanNode?.tls?.server_name).toBe('example.org');
        expect(trojanNode?.transport?.type).toBe('ws');
        expect(trojanNode?.transport?.path).toBe('/ws');
        expect(trojanNode?.transport?.headers?.Host).toBe('example.com');
    });

    it('enables encrypted foreign DNS only in polluted mode', () => {
        const parsed = JSON.parse(
            generateBuiltinSingboxConfig('trojan://password@1.2.3.4:443#Trojan', {
                dnsMode: 'polluted',
            })
        );
        expect(parsed.dns.servers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'https',
                    server: '8.8.8.8',
                    path: '/dns-query',
                    detour: '🌐 DNS 出口',
                }),
            ])
        );
        expect(parsed.dns.final).toBe('dns-foreign-1');
        expect(parsed.dns.rules[0].rule_set).toEqual(['geosite-cn']);
    });

    it('should map anytls outbound', () => {
        const result = generateBuiltinSingboxConfig(
            'anytls://pass-anytls@anytls.example.com:443/?sni=example.com&allowInsecure=1#AnyTLSNode'
        );
        const parsed = JSON.parse(result);
        const anytlsNode = parsed.outbounds.find((outbound) => outbound.tag.endsWith('AnyTLSNode'));

        expect(anytlsNode?.type).toBe('anytls');
        expect(anytlsNode?.server).toBe('anytls.example.com');
        expect(anytlsNode?.server_port).toBe(443);
        expect(anytlsNode?.password).toBe('pass-anytls');
        expect(anytlsNode?.tls?.enabled).toBe(true);
        expect(anytlsNode?.tls?.server_name).toBe('example.com');
        expect(anytlsNode?.tls?.insecure).toBe(true);
    });

    it('should map SS2022 v2ray-plugin websocket with SIP003 fields instead of an invalid transport', () => {
        const result = generateBuiltinSingboxConfig(SS2022_V2RAY_PLUGIN_NODE);
        const parsed = JSON.parse(result);
        const ssNode = parsed.outbounds.find((outbound) => outbound.type === 'shadowsocks');

        expect(ssNode?.method).toBe('2022-blake3-aes-256-gcm');
        expect(ssNode?.plugin).toBe('v2ray-plugin');
        expect(ssNode?.plugin_opts).toBe(
            'mode=websocket;host=ss.2227tsj.workers.dev;path=/?enc=2022-blake3-aes-256-gcm'
        );
        expect(ssNode?.transport).toBeUndefined();
        expect(ssNode?.tls).toBeUndefined();
    });

    it('omits Clash-only TUIC udp_relay_mode from sing-box output', () => {
        const result = generateBuiltinSingboxConfig(
            'tuic://uuid-tuic:pass-tuic@tuic.example.com:443?sni=tuic.example.com&congestion_control=bbr&udp_relay_mode=quic#TUICNode'
        );
        const parsed = JSON.parse(result);
        const tuicNode = parsed.outbounds.find((outbound) => outbound.tag.endsWith('TUICNode'));

        expect(tuicNode?.type).toBe('tuic');
        expect(tuicNode?.udp_relay_mode).toBeUndefined();
    });

    it('should use rule_set for geoip instead of deprecated geoip field (sing-box 1.12+)', () => {
        const result = generateBuiltinSingboxConfig('trojan://password@1.2.3.4:443#TestNode');
        const parsed = JSON.parse(result);

        // No rule should have a direct geoip field
        const geoipRules = parsed.route.rules.filter((r) => r.geoip !== undefined);
        expect(geoipRules).toHaveLength(0);

        // Should have a geoip-cn rule_set reference instead
        const geoipRuleSet = parsed.route.rules.filter(
            (r) => Array.isArray(r.rule_set) && r.rule_set.includes('geoip-cn')
        );
        expect(geoipRuleSet).toHaveLength(1);
        expect(geoipRuleSet[0].outbound).toBe('DIRECT');

        // Should have geoip-cn in the rule_set definitions
        const geoipProvider = parsed.route.rule_set.find((rs) => rs.tag === 'geoip-cn');
        expect(geoipProvider).toBeDefined();
        expect(geoipProvider.type).toBe('remote');
        expect(geoipProvider.url).toContain('sing-geoip');
        expect(geoipProvider.format).toBe('binary');
    });
});
