import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { transformBuiltinSubscription } from '../../functions/modules/subscription/transformer-factory.js';

const NODE_LIST = [
    'trojan://password@1.2.3.4:443?sni=example.com#HK-01',
    'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.5:8388#JP-01'
].join('\n');

describe('Builtin target smoke output', () => {
    it('renders parseable Clash YAML with core sections', () => {
        const rendered = transformBuiltinSubscription(NODE_LIST, 'clash', {
            fileName: 'Smoke Clash',
            ruleLevel: 'std',
            managedConfigUrl: 'https://example.com/sub?target=clash&builtin=1'
        });
        const parsed = yaml.load(rendered);

        expect(Array.isArray(parsed.proxies)).toBe(true);
        expect(parsed.proxies.length).toBeGreaterThan(0);
        expect(Array.isArray(parsed['proxy-groups'])).toBe(true);
        expect(parsed['proxy-groups'].length).toBeGreaterThan(0);
        expect(Array.isArray(parsed.rules)).toBe(true);
        expect(parsed.rules.length).toBeGreaterThan(0);
    });

    it('renders parseable Sing-box JSON with outbounds and route', () => {
        const rendered = transformBuiltinSubscription(NODE_LIST, 'singbox', {
            fileName: 'Smoke Singbox',
            ruleLevel: 'std'
        });
        const parsed = JSON.parse(rendered);

        expect(Array.isArray(parsed.outbounds)).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.type === 'trojan')).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.type === 'shadowsocks')).toBe(true);
        expect(parsed.route).toBeTruthy();
        expect(typeof parsed.route.final).toBe('string');
    });

    it('renders Surge sections with proxy, policy group, and rules', () => {
        const rendered = transformBuiltinSubscription(NODE_LIST, 'surge&ver=4', {
            fileName: 'Smoke Surge',
            ruleLevel: 'std',
            managedConfigUrl: 'https://example.com/sub?target=surge&ver=4&builtin=1'
        });

        expect(rendered).toContain('[Proxy]');
        expect(rendered).toContain('[Proxy Group]');
        expect(rendered).toContain('[Rule]');
        expect(rendered).toContain('HK-01 = trojan');
    });

    it('renders Loon sections with proxy, policy group, and rules', () => {
        const rendered = transformBuiltinSubscription(NODE_LIST, 'loon', {
            fileName: 'Smoke Loon',
            ruleLevel: 'std',
            managedConfigUrl: 'https://example.com/sub?target=loon&builtin=1'
        });

        expect(rendered).toContain('[Proxy]');
        expect(rendered).toContain('[Proxy Group]');
        expect(rendered).toContain('[Rule]');
        expect(rendered).toContain('HK-01 = trojan');
    });

    it('renders Quantumult X sections without pseudo DIRECT node entries', () => {
        const rendered = transformBuiltinSubscription(NODE_LIST, 'quanx', {
            fileName: 'Smoke QuanX',
            ruleLevel: 'std',
            managedConfigUrl: 'https://example.com/sub?target=quanx&builtin=1'
        });

        expect(rendered).toContain('[server_local]');
        expect(rendered).toContain('[policy]');
        expect(rendered).toContain('[filter_remote]');
        expect(rendered).toContain('[filter_local]');
        expect(rendered).toContain('trojan=1.2.3.4:443');
        expect(rendered).not.toContain('DIRECT = direct');
    });

    it('renders parseable Egern YAML with proxies, policy groups, and rules', () => {
        const rendered = transformBuiltinSubscription(NODE_LIST, 'egern', {
            fileName: 'Smoke Egern',
            ruleLevel: 'std',
            managedConfigUrl: 'https://example.com/sub?target=egern&builtin=1'
        });
        const parsed = yaml.load(rendered);

        expect(parsed.auto_update).toBeTruthy();
        expect(Array.isArray(parsed.proxies)).toBe(true);
        expect(parsed.proxies.length).toBeGreaterThan(0);
        expect(Array.isArray(parsed.policy_groups)).toBe(true);
        expect(parsed.policy_groups.length).toBeGreaterThan(0);
        expect(Array.isArray(parsed.rules)).toBe(true);
        expect(parsed.rules.length).toBeGreaterThan(0);
    });

    it('honors addFlagEmoji=false across builtin targets including Egern', () => {
        const node = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:443#HKNode';
        const targets = ['clash', 'surge&ver=4', 'loon', 'quanx', 'singbox', 'egern'];

        for (const target of targets) {
            const rendered = transformBuiltinSubscription(node, target, {
                fileName: `Emoji ${target}`,
                ruleLevel: 'std',
                addFlagEmoji: false
            });

            expect(rendered, target).toContain('HKNode');
            expect(rendered, target).not.toContain('🌍 HKNode');
            expect(rendered, target).not.toContain('🇭🇰 HKNode');
        }
    });
});
