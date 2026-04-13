import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.js';
import { renderClashFromIniTemplate, renderLoonFromIniTemplate, renderQuanxFromIniTemplate, renderSingboxFromIniTemplate, renderSurgeFromIniTemplate } from '../../functions/modules/subscription/template-pipeline.js';
import { getBuiltinTemplate } from '../../functions/modules/subscription/builtin-template-registry.js';

describe('Template pipeline', () => {
    it('should parse limited ini template into unified model', () => {
        const model = parseIniTemplate(`
[Proxy Group]
节点选择 = select, HK-01, JP-01, DIRECT
自动选择 = url-test, HK-01, JP-01, url=http://www.gstatic.com/generate_204, interval=300

[Rule]
DOMAIN-SUFFIX,google.com,节点选择
GEOIP,CN,DIRECT
MATCH,节点选择
        `, {
            fileName: 'Demo',
            targetFormat: 'clash'
        });

        expect(model.groups).toHaveLength(2);
        expect(model.rules).toHaveLength(3);
        expect(model.groups[0].name).toBe('节点选择');
        expect(model.rules[2].type).toBe('match');
    });

    it('should render clash yaml from limited ini template', () => {
        const rendered = renderClashFromIniTemplate(`
[Proxy Group]
节点选择 = select, HK-01, JP-01, DIRECT

[Rule]
DOMAIN-SUFFIX,google.com,节点选择
MATCH,节点选择
        `, {
            proxies: [
                { name: 'HK-01', type: 'trojan', server: '1.1.1.1', port: 443, password: 'pass' },
                { name: 'JP-01', type: 'trojan', server: '2.2.2.2', port: 443, password: 'pass' }
            ],
            managedConfigUrl: 'https://example.com/sub'
        });

        const parsed = yaml.load(rendered);
        expect(parsed['proxy-groups'][0].name).toBe('节点选择');
        expect(parsed.rules).toContain('MATCH,节点选择');
        expect(parsed.profile['subscription-url']).toBe('https://example.com/sub');
    });

    it('should exclude DIRECT from auto-select groups when rendering templates', () => {
        const rendered = renderClashFromIniTemplate(`
[Proxy Group]
节点选择 = select, 自动选择, DIRECT
自动选择 = url-test, HK-01, JP-01, DIRECT

[Rule]
MATCH,节点选择
        `, {
            proxies: [
                { name: 'HK-01', type: 'trojan', server: '1.1.1.1', port: 443, password: 'pass' },
                { name: 'JP-01', type: 'trojan', server: '2.2.2.2', port: 443, password: 'pass' }
            ]
        });

        const parsed = yaml.load(rendered);
        const autoSelectGroup = parsed['proxy-groups'].find(group => group.name === '自动选择');
        expect(autoSelectGroup.proxies).toEqual(['HK-01', 'JP-01']);
        expect(autoSelectGroup.proxies).not.toContain('DIRECT');
    });

    it('should merge duplicate proxy groups with the same name before rendering', () => {
        const rendered = renderClashFromIniTemplate(`
[Proxy Group]
节点选择 = select, HK-01
节点选择 = select, JP-01, DIRECT
自动选择 = url-test, HK-01, JP-01

[Rule]
MATCH,节点选择
        `, {
            proxies: [
                { name: 'HK-01', type: 'trojan', server: '1.1.1.1', port: 443, password: 'pass' },
                { name: 'JP-01', type: 'trojan', server: '2.2.2.2', port: 443, password: 'pass' }
            ]
        });

        const parsed = yaml.load(rendered);
        const selectGroups = parsed['proxy-groups'].filter(group => group.name === '节点选择');
        expect(selectGroups).toHaveLength(1);
        expect(selectGroups[0].proxies).toContain('HK-01');
        expect(selectGroups[0].proxies).toContain('JP-01');
        expect(selectGroups[0].proxies).toContain('DIRECT');
    });

    it('should parse builtin ACL4SSR custom template registry entry', () => {
        const builtinTemplate = getBuiltinTemplate('clash_acl4ssr_full');
        const model = parseIniTemplate(builtinTemplate.content, {
            fileName: 'ACL4SSR',
            targetFormat: 'clash'
        });

        expect(model.groups.length).toBeGreaterThan(10);
        expect(model.rules.some(rule => rule.type === 'rule-set')).toBe(true);
        expect(model.groups.some(group => group.name === '🚀 节点选择')).toBe(true);
    });

    it('should render sing-box json from ACL4SSR custom template', () => {
        const builtinTemplate = getBuiltinTemplate('clash_acl4ssr_full');
        const rendered = renderSingboxFromIniTemplate(builtinTemplate.content, {
            nodeList: [
                'trojan://password@1.2.3.4:443#HK-01',
                'vmess://eyJ2IjoiMiIsInBzIjoiSlAtMDEiLCJhZGQiOiIxLjIuMy41IiwicG9ydCI6IjQ0MyIsImlkIjoidXVpZC0xMjM0IiwiYWlkIjoiMCIsIm5ldCI6IndzIiwidHlwZSI6Im5vbmUiLCJob3N0IjoiZXhhbXBsZS5jb20iLCJwYXRoIjoiL3dzIiwidGxzIjoidGxzIn0'
            ].join('\n'),
            targetFormat: 'singbox'
        });
        const parsed = JSON.parse(rendered);

        expect(Array.isArray(parsed.outbounds)).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🚀 节点选择')).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🇭🇰 HK-01')).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🇯🇵 JP-01' && outbound.type === 'vmess')).toBe(true);
        expect(Array.isArray(parsed.route.rule_set)).toBe(true);
        expect(parsed.route.rule_set.length).toBeGreaterThan(0);
    });

    it('should render surge config sections from ACL4SSR custom template', () => {
        const builtinTemplate = getBuiltinTemplate('clash_acl4ssr_full');
        const rendered = renderSurgeFromIniTemplate(builtinTemplate.content, {
            nodeList: [
                'trojan://password@1.2.3.4:443#HK-01',
                'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.5:8388#JP-01'
            ].join('\n'),
            targetFormat: 'surge&ver=4'
        });

        expect(rendered).toContain('[Proxy]');
        expect(rendered).toContain('[Proxy Group]');
        expect(rendered).toContain('[Rule]');
        expect(rendered).toContain('🚀 节点选择 = select');
    });

    it('should render loon and quanx config sections from ACL4SSR custom template', () => {
        const builtinTemplate = getBuiltinTemplate('clash_acl4ssr_full');
        const nodeList = [
            'trojan://password@1.2.3.4:443#HK-01',
            'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.5:8388#JP-01',
            'vmess://eyJ2IjoiMiIsInBzIjoiVVMtMDEiLCJhZGQiOiIxLjIuMy42IiwicG9ydCI6IjQ0MyIsImlkIjoidXVpZC01Njc4IiwiYWlkIjoiMCIsIm5ldCI6IndzIiwiaG9zdCI6ImV4YW1wbGUuY29tIiwicGF0aCI6Ii93cyIsInRscyI6InRscyJ9',
            'vless://uuid-9999@1.2.3.7:443?security=reality&type=grpc&serviceName=edge&pbk=testpublickey&sid=abcd&sni=example.com#SG-01',
            'wireguard://privatekey@1.2.3.8:51820?publickey=peerpub&reserved=1,2,3&address=172.16.0.2/32#WG-01'
        ].join('\n');

        const loonRendered = renderLoonFromIniTemplate(builtinTemplate.content, { nodeList, targetFormat: 'loon' });
        const quanxRendered = renderQuanxFromIniTemplate(builtinTemplate.content, { nodeList, targetFormat: 'quanx' });
        const surgeRendered = renderSurgeFromIniTemplate(builtinTemplate.content, { nodeList, targetFormat: 'surge&ver=4' });

        expect(loonRendered).toContain('[Proxy]');
        expect(loonRendered).toContain('[Proxy Group]');
        expect(loonRendered).toContain('[Rule]');
        expect(loonRendered).toContain('SG-01 = vless');
        expect(loonRendered).toContain('grpc-service-name=edge');
        expect(loonRendered).toContain('reality=true');
        expect(loonRendered).toContain('WG-01 = wireguard');
        expect(loonRendered).toContain('RULE-SET,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Apple.list,🍎 苹果服务');
        expect(loonRendered).toContain('🚀 节点选择 = select');
        expect(quanxRendered).toContain('[Proxy]');
        expect(quanxRendered).toContain('[Policy]');
        expect(quanxRendered).toContain('[Rule]');
        expect(quanxRendered).toContain('vmess=🇺🇸 US-01');
        expect(quanxRendered).toContain('https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Apple.list, tag=🍎 苹果服务, policy=🍎 苹果服务, enabled=true');
        expect(quanxRendered).toContain('🚀 节点选择 = select');
        expect(surgeRendered).toContain('SG-01 = vless');
        expect(surgeRendered).toContain('grpc-service-name=edge');
        expect(surgeRendered).toContain('reality=true');
        expect(surgeRendered).toContain('WG-01 = wireguard');
        expect(surgeRendered).toContain('RULE-SET,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Apple.list,🍎 苹果服务');
        expect(surgeRendered).toContain('🚀 节点选择 = select');
    });
});
