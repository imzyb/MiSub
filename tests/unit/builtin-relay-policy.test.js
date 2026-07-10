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
    'ss://YWVzLTI1Ni1nY206cGFzcw@sg.example.com:8388#狮城-SG-01'
].join('\n');

describe('内置 Relay 分流等级', () => {
    it('普通 Clash Relay 应保持可导入的 select 降级，不输出 Mihomo 专属 dialer-proxy', () => {
        const parsed = yaml.load(generateBuiltinClashConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' }));

        expect(parsed['proxy-groups'].some(group => group.type === 'relay')).toBe(false);
        expect(parsed.proxies.some(proxy => proxy['dialer-proxy'])).toBe(false);

        const defaultRelayGroup = parsed['proxy-groups'].find(group => group.name === '🌍 总出口');
        expect(defaultRelayGroup?.type).toBe('select');
        expect(defaultRelayGroup?.proxies).toEqual(expect.arrayContaining(['🔗 链式代理', '♻️ 自动选择', '👋 手动切换', '🚀 常用节点']));
        expect(defaultRelayGroup?.proxies.indexOf('♻️ 自动选择')).toBeLessThan(defaultRelayGroup?.proxies.indexOf('🚀 常用节点'));
        expect(defaultRelayGroup?.proxies.indexOf('👋 手动切换')).toBeLessThan(defaultRelayGroup?.proxies.indexOf('🚀 常用节点'));

        const relayGroup = parsed['proxy-groups'].find(group => group.name === '🔗 链式代理');
        expect(relayGroup?.type).toBe('select');
        expect(relayGroup?.proxies.some(name => name.startsWith('🔗 链式代理 - '))).toBe(false);
        expect(relayGroup?.proxies).toEqual(expect.arrayContaining(['入口节点', '🇭🇰 香港入口-HK-01', '🇺🇸 美国落地-US-01']));
        expect(parsed['proxy-groups'].some(group => group.name === '落地节点')).toBe(false);
    });

    it('Mihomo/Meta Relay 应隐藏落地节点分组，仅通过链式代理分组选择链式落地副本', () => {
        const parsed = yaml.load(generateBuiltinClashConfig(RELAY_NODE_LIST, { ruleLevel: 'relay', isMeta: true }));

        expect(parsed['proxy-groups'].some(group => group.type === 'relay')).toBe(false);
        expect(parsed.proxies.some(proxy => proxy.name?.startsWith('🔗 链式代理 - ') && proxy['dialer-proxy'] === '入口节点')).toBe(true);

        const relayGroup = parsed['proxy-groups'].find(group => group.name === '🔗 链式代理');
        expect(relayGroup?.type).toBe('select');
        expect(relayGroup?.proxies.every(name => name.startsWith('🔗 链式代理 - '))).toBe(true);
        expect(relayGroup?.proxies.some(name => name.includes('美国落地-US-01'))).toBe(true);

        expect(parsed['proxy-groups'].some(group => group.name === '落地节点')).toBe(false);
    });

    it('Surge/Loon Relay 分流应输出原生 relay 策略组', () => {
        const surge = generateBuiltinSurgeConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' });
        const loon = generateBuiltinLoonConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' });

        expect(surge).toContain('🔗 链式代理 = relay, 入口节点, 落地节点');
        expect(loon).toContain('🔗 链式代理 = relay, 入口节点, 落地节点');
    });

    it('Sing-box Relay 分流应隐藏落地节点分组，仅通过链式代理选择 detour 链式出站', () => {
        const parsed = JSON.parse(generateBuiltinSingboxConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' }));

        expect(parsed.outbounds.some(outbound => outbound.tag?.startsWith('🔗 链式代理 - ') && outbound.detour === '入口节点')).toBe(true);
        const relaySelector = parsed.outbounds.find(outbound => outbound.tag === '🔗 链式代理');
        expect(relaySelector?.type).toBe('selector');
        expect(relaySelector?.outbounds.every(tag => tag.startsWith('🔗 链式代理 - '))).toBe(true);
        expect(relaySelector?.outbounds.some(tag => tag.includes('美国落地-US-01'))).toBe(true);

        expect(parsed.outbounds.some(outbound => outbound.tag === '落地节点')).toBe(false);
    });

    it('QuanX 不支持真链式时应保持 static 降级而不是输出 relay', () => {
        const quanx = generateBuiltinQuanxConfig(RELAY_NODE_LIST, { ruleLevel: 'relay' });

        expect(quanx).toContain('static=🔗 链式代理');
        expect(quanx).not.toContain('relay=🔗 链式代理');
    });
});
