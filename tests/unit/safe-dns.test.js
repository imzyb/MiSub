import { describe, expect, it } from 'vitest';
import {
    DNS_PROXY_GROUP,
    buildSingboxDnsConfig,
    resolveDnsPolicy,
    resolveSafeDnsConfig,
} from '../../functions/modules/subscription/safe-dns.js';

describe('shared split DNS policy', () => {
    it('routes domestic names directly and foreign names through the proxy group in clean mode', () => {
        const dns = resolveSafeDnsConfig('');

        expect(dns['respect-rules']).toBe(true);
        expect(dns['nameserver-policy']['geosite:cn']).toEqual(['223.5.5.5', '119.29.29.29']);
        // 境外解析默认为 IP 型 DoH（免引导解析，比明文 UDP:53 抗污染、链路更稳）
        expect(dns.nameserver).toEqual([
            `https://8.8.8.8/dns-query#${DNS_PROXY_GROUP}`,
            `https://1.1.1.1/dns-query#${DNS_PROXY_GROUP}`,
        ]);
        expect(dns.fallback).toEqual([]);
        expect(dns['proxy-server-nameserver']).toEqual(['223.5.5.5', '119.29.29.29']);
    });

    it('uses encrypted foreign resolvers in both clean and polluted modes', () => {
        for (const mode of ['clean', 'polluted']) {
            const dns = resolveSafeDnsConfig('', { mode });
            const singbox = buildSingboxDnsConfig('', { mode });

            expect(dns.nameserver.every((server) => server.startsWith('https://'))).toBe(true);
            expect(dns.nameserver.every((server) => server.endsWith(`#${DNS_PROXY_GROUP}`))).toBe(
                true
            );
            expect(
                singbox.servers.some(
                    (server) => server.type === 'https' && server.detour === DNS_PROXY_GROUP
                )
            ).toBe(true);
            expect(singbox.final).toBe('dns-foreign-1');
            expect(singbox.rules[0]).toEqual({
                rule_set: ['geosite-cn'],
                action: 'route',
                server: 'dns-cn-1',
            });
        }
    });

    it('keeps user-provided encrypted foreign resolvers as-is', () => {
        const dns = resolveSafeDnsConfig({ nameserver: ['https://dns.google/dns-query'] });

        expect(dns.nameserver).toEqual([`https://dns.google/dns-query#${DNS_PROXY_GROUP}`]);
        expect(dns.fallback).toEqual([]);
    });

    it('rejects unsafe resolver overrides and keeps the safe policy', () => {
        const policy = resolveDnsPolicy({
            mode: 'polluted',
            domestic: ['127.0.0.1'],
            foreign: ['udp://0.0.0.0:53#DIRECT'],
            polluted: ['https://8.8.8.8/dns-query'],
        });

        expect(policy.domestic).toEqual(['223.5.5.5', '119.29.29.29']);
        expect(policy.foreign).toEqual(['https://8.8.8.8/dns-query', 'https://1.1.1.1/dns-query']);
        expect(policy.polluted).toEqual(['https://8.8.8.8/dns-query']);
    });
});
