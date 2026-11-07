import { describe, expect, it } from 'vitest';
import {
    DNS_PROXY_GROUP,
    buildSingboxDnsConfig,
    resolveDnsPolicy,
    resolveSafeDnsConfig,
    dnsConfigUsesProxyGroup,
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

    it('puts geosite:geolocation-!cn before geosite:cn so CN-misclassified foreign domains are proxied', () => {
        // mihomo 的 nameserver-policy 取第一条命中；browserleaks.com 这类检测站域名同时被
        // 收进 geosite 的 CN 与 GEOLOCATION-!CN，CN 在前就会走国内明文 DNS（运营商劫持 →
        // 权威侧看到运营商递归，看起来就是 DNS 泄露）。
        const dns = resolveSafeDnsConfig('');
        const keys = Object.keys(dns['nameserver-policy']);

        expect(keys[0]).toBe('geosite:private');
        expect(keys.indexOf('geosite:geolocation-!cn')).toBeGreaterThan(0);
        expect(keys.indexOf('geosite:geolocation-!cn')).toBeLessThan(keys.indexOf('geosite:cn'));
        expect(dns['nameserver-policy']['geosite:cn']).toEqual(['223.5.5.5', '119.29.29.29']);
        expect(
            dns['nameserver-policy']['geosite:geolocation-!cn'].every((server) =>
                server.endsWith(`#${DNS_PROXY_GROUP}`)
            )
        ).toBe(true);
    });

    it('omits the empty-direct detour on domestic sing-box resolvers', () => {
        // 实测 sing-box 1.14.4 启动时报 `detour to an empty direct outbound makes no sense`，
        // 省略 detour 才是"直连"的正确写法。
        const singbox = buildSingboxDnsConfig('');
        const domestic = singbox.servers.filter((server) => server.tag.startsWith('dns-cn-'));

        expect(domestic.length).toBeGreaterThan(0);
        expect(domestic.every((server) => !Object.hasOwn(server, 'detour'))).toBe(true);
        expect(
            singbox.servers
                .filter((server) => server.tag.startsWith('dns-foreign-'))
                .every((server) => server.detour === DNS_PROXY_GROUP)
        ).toBe(true);
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

    it('detects DNS exit group references in resolved configs only', () => {
        const safe = resolveSafeDnsConfig('');
        expect(dnsConfigUsesProxyGroup(safe, DNS_PROXY_GROUP)).toBe(true);
        expect(dnsConfigUsesProxyGroup(safe, '🚀 节点选择')).toBe(false);

        // policy 形式的覆盖会在解析后重新注入 `#🌐 DNS 出口`，引用判断必须基于解析结果。
        const policyOverride = resolveSafeDnsConfig({
            domestic: ['223.5.5.5'],
            foreign: ['https://dns.google/dns-query'],
        });
        expect(dnsConfigUsesProxyGroup(policyOverride, DNS_PROXY_GROUP)).toBe(true);

        // 显式 DNS 块不带 `#策略组` 后缀时不引用任何策略组。
        const explicit = resolveSafeDnsConfig({
            enable: true,
            nameserver: ['https://1.1.1.1/dns-query'],
        });
        expect(dnsConfigUsesProxyGroup(explicit, DNS_PROXY_GROUP)).toBe(false);
        expect(dnsConfigUsesProxyGroup(null, DNS_PROXY_GROUP)).toBe(false);

        // `#` 之后的片段必须精确匹配组名：前缀相似的组名不算引用。
        expect(
            dnsConfigUsesProxyGroup([`udp://8.8.8.8:53#${DNS_PROXY_GROUP}-other`], DNS_PROXY_GROUP)
        ).toBe(false);
        expect(
            dnsConfigUsesProxyGroup(
                [`udp://8.8.8.8:53#${DNS_PROXY_GROUP}&h3=true`],
                DNS_PROXY_GROUP
            )
        ).toBe(true);
        expect(
            dnsConfigUsesProxyGroup(
                { a: { b: [`udp://8.8.8.8:53#${DNS_PROXY_GROUP}`] } },
                DNS_PROXY_GROUP
            )
        ).toBe(true);
        expect(dnsConfigUsesProxyGroup([], DNS_PROXY_GROUP)).toBe(false);
        expect(dnsConfigUsesProxyGroup([`udp://8.8.8.8:53#${DNS_PROXY_GROUP}`], '')).toBe(false);
    });
});
