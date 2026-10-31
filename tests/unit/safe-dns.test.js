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
        expect(dns.nameserver).toEqual([
            `udp://8.8.8.8:53#${DNS_PROXY_GROUP}`,
            `udp://1.1.1.1:53#${DNS_PROXY_GROUP}`,
        ]);
        expect(dns.fallback).toEqual([]);
        expect(dns['proxy-server-nameserver']).toEqual(['223.5.5.5', '119.29.29.29']);
    });

    it('uses encrypted foreign resolvers only in polluted mode', () => {
        const dns = resolveSafeDnsConfig('', { mode: 'polluted' });
        const singbox = buildSingboxDnsConfig('', { mode: 'polluted' });

        expect(dns.nameserver.every((server) => server.startsWith('https://'))).toBe(true);
        expect(dns.nameserver.every((server) => server.endsWith(`#${DNS_PROXY_GROUP}`))).toBe(true);
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
    });

    it('downgrades encrypted KV foreign resolvers to plain UDP in clean mode', () => {
        const dns = resolveSafeDnsConfig({ nameserver: ['https://dns.google/dns-query'] });

        expect(dns.nameserver).toEqual([`udp://dns.google:53#${DNS_PROXY_GROUP}`]);
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
        expect(policy.foreign).toEqual(['udp://8.8.8.8:53', 'udp://1.1.1.1:53']);
        expect(policy.polluted).toEqual(['https://8.8.8.8/dns-query']);
    });
});
