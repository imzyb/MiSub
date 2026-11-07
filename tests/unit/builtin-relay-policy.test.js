import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinSurgeConfig } from '../../functions/modules/subscription/builtin-surge-generator.js';
import { generateBuiltinLoonConfig } from '../../functions/modules/subscription/builtin-loon-generator.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';
import { generateBuiltinQuanxConfig } from '../../functions/modules/subscription/builtin-quanx-generator.js';

const RELAY_NODE_LIST = [
    'trojan://pass@hk.example.com:443?sni=hk.example.com#香港入口-HK-01',
    'trojan://pass@us.example.com:443?sni=us.example.com#美国落地-US-01',
    'ss://YWVzLTI1Ni1nY206cGFzcw@sg.example.com:8388#狮城-SG-01',
].join('\n');

describe('内置 Relay 分流等级', () => {
    it('普通 Clash Relay 应保持可导入的 select 降级，不输出 Mihomo 专属 dialer-proxy', () => {
        const parsed = yaml.load(
            generateBuiltinClashConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' })
        );

        expect(parsed['proxy-groups'].some((group) => group.type === 'relay')).toBe(false);
        expect(parsed.proxies.some((proxy) => proxy['dialer-proxy'])).toBe(false);

        const defaultRelayGroup = parsed['proxy-groups'].find(
            (group) => group.name === '🌍 总出口'
        );
        expect(defaultRelayGroup?.type).toBe('select');
        expect(defaultRelayGroup?.proxies).toEqual(
            expect.arrayContaining(['🔗 链式代理', '♻️ 自动选择', '👋 手动切换', '🚀 常用节点'])
        );
        expect(defaultRelayGroup?.proxies.indexOf('♻️ 自动选择')).toBeLessThan(
            defaultRelayGroup?.proxies.indexOf('🚀 常用节点')
        );
        expect(defaultRelayGroup?.proxies.indexOf('👋 手动切换')).toBeLessThan(
            defaultRelayGroup?.proxies.indexOf('🚀 常用节点')
        );

        const relayGroup = parsed['proxy-groups'].find((group) => group.name === '🔗 链式代理');
        expect(relayGroup?.type).toBe('select');
        expect(relayGroup?.proxies.some((name) => name.startsWith('🔗 链式代理 - '))).toBe(false);
        expect(relayGroup?.proxies).toEqual(
            expect.arrayContaining(['入口节点', '🇭🇰 香港入口-HK-01', '🇺🇸 美国落地-US-01'])
        );
        expect(parsed['proxy-groups'].some((group) => group.name === '落地节点')).toBe(false);
    });

    it('Mihomo/Meta Relay 应隐藏落地节点分组，仅通过链式代理分组选择链式落地副本', () => {
        const parsed = yaml.load(
            generateBuiltinClashConfig(RELAY_NODE_LIST, { ruleLevel: 'relay', isMeta: true })
        );

        expect(parsed['proxy-groups'].some((group) => group.type === 'relay')).toBe(false);
        expect(
            parsed.proxies.some(
                (proxy) =>
                    proxy.name?.startsWith('🔗 链式代理 - ') && proxy['dialer-proxy'] === '入口节点'
            )
        ).toBe(true);

        const relayGroup = parsed['proxy-groups'].find((group) => group.name === '🔗 链式代理');
        expect(relayGroup?.type).toBe('select');
        expect(relayGroup?.proxies.every((name) => name.startsWith('🔗 链式代理 - '))).toBe(true);
        expect(relayGroup?.proxies.some((name) => name.includes('美国落地-US-01'))).toBe(true);

        expect(parsed['proxy-groups'].some((group) => group.name === '落地节点')).toBe(false);
    });

    it('Surge/Loon Relay 分流应输出原生 relay 策略组', () => {
        const surge = generateBuiltinSurgeConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' });
        const loon = generateBuiltinLoonConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' });

        expect(surge).toContain('🔗 链式代理 = relay, 入口节点, 落地节点');
        expect(loon).toContain('🔗 链式代理 = relay, 入口节点, 落地节点');
    });

    it('Sing-box Relay 分流应隐藏落地节点分组，仅通过链式代理选择 detour 链式出站', () => {
        const parsed = JSON.parse(
            generateBuiltinSingboxConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' })
        );

        expect(
            parsed.outbounds.some(
                (outbound) =>
                    outbound.tag?.startsWith('🔗 链式代理 - ') && outbound.detour === '入口节点'
            )
        ).toBe(true);
        const relaySelector = parsed.outbounds.find((outbound) => outbound.tag === '🔗 链式代理');
        expect(relaySelector?.type).toBe('selector');
        expect(relaySelector?.outbounds.every((tag) => tag.startsWith('🔗 链式代理 - '))).toBe(
            true
        );
        expect(relaySelector?.outbounds.some((tag) => tag.includes('美国落地-US-01'))).toBe(true);

        expect(parsed.outbounds.some((outbound) => outbound.tag === '落地节点')).toBe(false);
    });

    it('QuanX 不支持真链式时应保持 static 降级而不是输出 relay', () => {
        const quanx = generateBuiltinQuanxConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' });

        expect(quanx).toContain('static=🔗 链式代理');
        expect(quanx).not.toContain('relay=🔗 链式代理');
    });

    it('Mihomo/Meta Relay 的 DNS 出口必须跟随链式代理组，不能直接列原始节点', () => {
        const parsed = yaml.load(
            generateBuiltinClashConfig(RELAY_NODE_LIST, { ruleLevel: 'relay', isMeta: true })
        );

        const dnsExitGroup = parsed['proxy-groups'].find((group) => group.name === '🌐 DNS 出口');
        // DNS 与流量共用同一个出口：只引用链式代理组，不存在裸节点候选。
        expect(dnsExitGroup?.type).toBe('select');
        expect(dnsExitGroup?.proxies).toEqual(['🔗 链式代理']);
        expect(dnsExitGroup?.proxies).not.toContain('DIRECT');

        // nameserver 仍然引用该组，引用目标必须真实存在（否则 mihomo 会当作网卡名 → DNS 泄露）。
        const dnsRefs = [
            ...parsed.dns.nameserver,
            ...parsed.dns['nameserver-policy']['geosite:geolocation-!cn'],
        ];
        expect(dnsRefs.every((server) => server.endsWith('#🌐 DNS 出口'))).toBe(true);
        expect(parsed['proxy-groups'].some((group) => group.name === '🔗 链式代理')).toBe(true);
    });

    it('Mihomo/Meta Relay 在 polluted DNS 模式下同样让 DNS 跟随链式出口', () => {
        const parsed = yaml.load(
            generateBuiltinClashConfig(RELAY_NODE_LIST, {
                ruleLevel: 'relay',
                isMeta: true,
                dnsMode: 'polluted',
            })
        );

        const dnsExitGroup = parsed['proxy-groups'].find((group) => group.name === '🌐 DNS 出口');
        expect(dnsExitGroup?.proxies).toEqual(['🔗 链式代理']);
        expect(parsed.dns.nameserver.every((server) => server.endsWith('#🌐 DNS 出口'))).toBe(true);
        expect(parsed.dns.fallback.every((server) => server.endsWith('#🌐 DNS 出口'))).toBe(true);
    });

    it('普通 Clash Relay（无 dialer-proxy 能力）保留 DNS 出口组的原始节点候选', () => {
        const parsed = yaml.load(
            generateBuiltinClashConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' })
        );

        const dnsExitGroup = parsed['proxy-groups'].find((group) => group.name === '🌐 DNS 出口');
        expect(dnsExitGroup?.type).toBe('url-test');
        expect(dnsExitGroup?.proxies).toEqual(
            expect.arrayContaining(['🇭🇰 香港入口-HK-01', '🇺🇸 美国落地-US-01'])
        );
        // 普通 Clash 不生成链式副本，DNS 出口组也不应引用不存在的链式组。
        expect(dnsExitGroup?.proxies).not.toContain('🔗 链式代理');
    });

    it('Sing-box Relay 的 DNS detour 必须跟随链式出站，不能直接拨原始节点', () => {
        const parsed = JSON.parse(
            generateBuiltinSingboxConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' })
        );

        const dnsExitSelector = parsed.outbounds.find((outbound) => outbound.tag === '🌐 DNS 出口');
        expect(dnsExitSelector?.type).toBe('selector');
        expect(dnsExitSelector?.outbounds).toEqual(['🔗 链式代理']);

        const foreignServers = parsed.dns.servers.filter(
            (server) => server.tag !== 'dns-cn-1' && server.tag !== 'dns-cn-2'
        );
        expect(foreignServers.length).toBeGreaterThan(0);
        expect(foreignServers.every((server) => server.detour === '🌐 DNS 出口')).toBe(true);
        expect(parsed.outbounds.some((outbound) => outbound.tag === '🔗 链式代理')).toBe(true);
    });

    it('Sing-box 非 Relay 等级不受影响，DNS 出口仍然是原始节点', () => {
        const parsed = JSON.parse(
            generateBuiltinSingboxConfig(RELAY_NODE_LIST, { ruleLevel: 'std' })
        );

        const dnsExitSelector = parsed.outbounds.find((outbound) => outbound.tag === '🌐 DNS 出口');
        expect(dnsExitSelector?.type).toBe('urltest');
        expect(dnsExitSelector?.outbounds).not.toContain('🔗 链式代理');
        expect(dnsExitSelector?.outbounds).not.toContain('DIRECT');
    });

    it('Relay 生成结果里所有组引用都必须存在（dialer-proxy / detour / 组员）', () => {
        const clash = yaml.load(
            generateBuiltinClashConfig(RELAY_NODE_LIST, { ruleLevel: 'relay', isMeta: true })
        );
        const clashNames = new Set([
            ...clash.proxies.map((proxy) => proxy.name),
            ...clash['proxy-groups'].map((group) => group.name),
            'DIRECT',
            'REJECT',
            'REJECT-DROP',
            'ANY',
        ]);
        for (const group of clash['proxy-groups']) {
            for (const member of group.proxies || []) {
                expect(clashNames.has(member), `${group.name} -> ${member}`).toBe(true);
            }
        }
        for (const proxy of clash.proxies) {
            if (proxy['dialer-proxy']) {
                expect(clashNames.has(proxy['dialer-proxy'])).toBe(true);
            }
        }
        // DNS 引用的组必须真的存在，否则 mihomo 会把组名当网卡名。
        for (const server of clash.dns.nameserver) {
            expect(server.endsWith('#🌐 DNS 出口')).toBe(true);
        }
        expect(clash['proxy-groups'].some((group) => group.name === '🌐 DNS 出口')).toBe(true);

        const singbox = JSON.parse(
            generateBuiltinSingboxConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' })
        );
        const tags = new Set(singbox.outbounds.map((outbound) => outbound.tag));
        for (const outbound of singbox.outbounds) {
            for (const tag of outbound.outbounds || []) {
                expect(tags.has(tag), `${outbound.tag} -> ${tag}`).toBe(true);
            }
            if (outbound.detour) {
                expect(tags.has(outbound.detour), `${outbound.tag} detour`).toBe(true);
            }
        }
        for (const server of singbox.dns.servers) {
            if (server.detour) expect(tags.has(server.detour)).toBe(true);
        }
    });

    it('Sing-box Relay 没有可用节点时 DNS 出口必须 fail-closed 而不是回落 DIRECT', () => {
        const parsed = JSON.parse(
            generateBuiltinSingboxConfig('vless://not-a-real-node', { ruleLevel: 'relay' })
        );

        const chain = parsed.outbounds.find((outbound) => outbound.tag === '🔗 链式代理');
        expect(chain?.outbounds).toEqual(['REJECT']);

        const dnsExit = parsed.outbounds.find((outbound) => outbound.tag === '🌐 DNS 出口');
        expect(dnsExit?.outbounds).toEqual(['REJECT']);
        expect(dnsExit?.outbounds).not.toContain('DIRECT');
    });

    it('Sing-box 的 DNS 劫持规则必须限定 53 端口并排在私网直连等规则之前', () => {
        const parsed = JSON.parse(
            generateBuiltinSingboxConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' })
        );

        const firstRule = parsed.route.rules[0];
        // 必须带 port 匹配：sing-box 的 hijack-dns 对命中的任何连接/报文生效，
        // 无条件规则会把所有流量都当成 DNS 处理。
        expect(firstRule).toEqual({ port: 53, action: 'hijack-dns' });
        expect(parsed.route.rules[1]).toEqual(
            expect.objectContaining({
                ip_cidr: expect.arrayContaining(['127.0.0.0/8', '10.0.0.0/8']),
                outbound: 'DIRECT',
            })
        );
        // 任何其它规则都不能是无条件的 hijack-dns
        for (const rule of parsed.route.rules) {
            if (rule.action === 'hijack-dns') {
                expect(rule.port).toBe(53);
            }
        }
    });

    it('Sing-box 出站 tag 必须唯一（含无可用节点的情况）', () => {
        for (const nodeList of [RELAY_NODE_LIST, 'vless://not-a-real-node']) {
            const parsed = JSON.parse(
                generateBuiltinSingboxConfig(nodeList, { ruleLevel: 'relay' })
            );
            const tags = parsed.outbounds.map((outbound) => outbound.tag);
            expect(new Set(tags).size).toBe(tags.length);
        }
    });

    it('Relay 等级下 policy 形式的 DNS 覆盖仍然保留 DNS 出口组（解析后仍有 #引用）', () => {
        const clash = yaml.load(
            generateBuiltinClashConfig(RELAY_NODE_LIST, {
                ruleLevel: 'relay',
                isMeta: true,
                customDnsOverride: { domestic: ['223.5.5.5'], foreign: ['1.1.1.1'] },
            })
        );

        const dnsExitGroup = clash['proxy-groups'].find((group) => group.name === '🌐 DNS 出口');
        expect(dnsExitGroup?.proxies).toEqual(['🔗 链式代理']);
        expect(clash.dns.nameserver.every((server) => server.endsWith('#🌐 DNS 出口'))).toBe(true);
    });

    it('Sing-box Relay 在 polluted DNS 模式下 DNS detour 同样指向链式出站', () => {
        const parsed = JSON.parse(
            generateBuiltinSingboxConfig(RELAY_NODE_LIST, {
                ruleLevel: 'relay',
                dnsMode: 'polluted',
            })
        );

        const dnsExit = parsed.outbounds.find((outbound) => outbound.tag === '🌐 DNS 出口');
        expect(dnsExit?.outbounds).toEqual(['🔗 链式代理']);
        const foreign = parsed.dns.servers.filter((server) =>
            server.tag.startsWith('dns-foreign-')
        );
        expect(foreign.every((server) => server.type === 'https')).toBe(true);
        expect(foreign.every((server) => server.detour === '🌐 DNS 出口')).toBe(true);
    });
});
