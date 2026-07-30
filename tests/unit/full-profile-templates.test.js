import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { transformBuiltinSubscription } from '../../functions/modules/subscription/transformer-factory.js';
import {
    expandProfileTemplateMembers,
    renderFullProfileTemplate
} from '../../functions/modules/subscription/profile-template-renderer.js';
import { normalizeCustomRuleTemplates } from '../../functions/modules/rule-template-handler.js';
import { ProcessorService } from '../../functions/services/processor-service.js';

const NODE_LIST = [
    'trojan://pass@1.1.1.1:443?sni=example.com#HK-01',
    'trojan://pass@2.2.2.2:443?sni=example.com#SG-01'
].join('\n');
const HK_NODE = '🇭🇰 HK-01';
const SG_NODE = '🇸🇬 SG-01';

function createMemoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        get: async key => data.has(key) ? data.get(key) : null,
        put: async (key, value) => data.set(key, value)
    };
}

describe('full profile templates', () => {
    it('expands all, include and exclude member markers', () => {
        const names = ['HK-01', 'SG-01', 'US-01'];
        expect(expandProfileTemplateMembers(['DIRECT', '{{MISUB_ALL}}'], names))
            .toEqual(['DIRECT', 'HK-01', 'SG-01', 'US-01']);
        expect(expandProfileTemplateMembers(['{{MISUB_INCLUDE:^(HK|SG)}}'], names))
            .toEqual(['HK-01', 'SG-01']);
        expect(expandProfileTemplateMembers(['{{MISUB_EXCLUDE:US}}'], names))
            .toEqual(['HK-01', 'SG-01']);
    });

    it('injects nodes into a complete Clash YAML profile and preserves custom fields', () => {
        const template = `
dns:
  enable: true
proxies:
  - name: Static
    type: direct
proxy-groups:
  - name: Main
    type: select
    proxies:
      - Static
      - "{{MISUB_ALL}}"
  - name: Hong Kong
    type: url-test
    proxies:
      - "{{MISUB_INCLUDE:HK}}"
rules:
  - MATCH,Main
`;
        const rendered = renderFullProfileTemplate(
            template,
            transformBuiltinSubscription(NODE_LIST, 'clash'),
            'clash'
        );
        const config = yaml.load(rendered);
        expect(config.dns.enable).toBe(true);
        expect(config.proxies.map(proxy => proxy.name)).toEqual(expect.arrayContaining(['Static', HK_NODE, SG_NODE]));
        expect(config['proxy-groups'][0].proxies).toEqual(['Static', HK_NODE, SG_NODE]);
        expect(config['proxy-groups'][1].proxies).toEqual([HK_NODE]);
        expect(config.rules).toEqual(['MATCH,Main']);
    });

    it('injects nodes into a JSON5 Sing-box profile without replacing DNS, TUN or routes', () => {
        const template = `{
          // User-owned DNS and inbound configuration.
          dns: { servers: [{ type: "local", tag: "dns-local" }] },
          inbounds: [{ type: "tun", tag: "tun-in", address: ["172.19.0.1/30"] }],
          outbounds: [
            { type: "selector", tag: "Main", outbounds: ["direct", "{{MISUB_ALL}}"] },
            { type: "urltest", tag: "HK", outbounds: ["{{MISUB_INCLUDE:HK}}"] },
            { type: "direct", tag: "direct" },
          ],
          route: { final: "Main", rules: [{ ip_is_private: true, outbound: "direct" }] },
        }`;
        const rendered = renderFullProfileTemplate(
            template,
            transformBuiltinSubscription(NODE_LIST, 'singbox'),
            'singbox'
        );
        const config = JSON.parse(rendered);
        expect(config.dns.servers[0].tag).toBe('dns-local');
        expect(config.inbounds[0].tag).toBe('tun-in');
        expect(config.route.rules[0].ip_is_private).toBe(true);
        expect(config.outbounds.find(item => item.tag === 'Main').outbounds)
            .toEqual(['direct', HK_NODE, SG_NODE]);
        expect(config.outbounds.find(item => item.tag === 'HK').outbounds).toEqual([HK_NODE]);
        expect(config.outbounds.filter(item => item.server).map(item => item.tag))
            .toEqual(expect.arrayContaining([HK_NODE, SG_NODE]));
    });

    it.each([
        {
            target: 'surge',
            template: '[General]\nloglevel = notify\n\n[Proxy]\nDIRECT = direct\n\n[Proxy Group]\nMain = select, DIRECT, {{MISUB_ALL}}\nHK = url-test, {{MISUB_INCLUDE:HK}}, url=https://example.com/ping\n\n[Rule]\nFINAL,Main',
            nodeSection: '[Proxy]',
            groupPattern: /Main = select, DIRECT, 🇭🇰 HK-01, 🇸🇬 SG-01/
        },
        {
            target: 'loon',
            template: '[General]\nipv6 = false\n\n[Proxy]\nDIRECT = direct\n\n[Proxy Group]\nMain = select, DIRECT, {{MISUB_ALL}}\n\n[Rule]\nFINAL,Main',
            nodeSection: '[Proxy]',
            groupPattern: /Main = select, DIRECT, 🇭🇰 HK-01, 🇸🇬 SG-01/
        },
        {
            target: 'quanx',
            template: '[general]\nserver_check_url = https://example.com/ping\n\n[server_local]\n\n[policy]\nstatic=Main, direct, {{MISUB_ALL}}\n\n[filter_local]\nfinal, Main',
            nodeSection: '[server_local]',
            groupPattern: /static=Main, direct, 🇭🇰 HK-01, 🇸🇬 SG-01/
        }
    ])('injects nodes into a complete $target INI profile', ({ target, template, nodeSection, groupPattern }) => {
        const rendered = renderFullProfileTemplate(
            template,
            transformBuiltinSubscription(NODE_LIST, target),
            target
        );
        expect(rendered).toContain(nodeSection);
        expect(rendered).toContain('HK-01');
        expect(rendered).toContain('SG-01');
        expect(rendered).toMatch(groupPattern);
        expect(rendered).not.toContain('{{MISUB_');
    });

    it('injects nodes into a complete Egern YAML profile', () => {
        const template = `
dns:
  nameserver:
    - system
proxies: []
policy_groups:
  - select:
      name: Main
      policies:
        - DIRECT
        - "{{MISUB_ALL}}"
rules:
  - default:
      policy: Main
`;
        const rendered = renderFullProfileTemplate(
            template,
            transformBuiltinSubscription(NODE_LIST, 'egern'),
            'egern'
        );
        const config = yaml.load(rendered);
        expect(config.dns.nameserver).toEqual(['system']);
        expect(config.proxies).toHaveLength(2);
        expect(config.policy_groups[0].select.policies).toEqual(['DIRECT', HK_NODE, SG_NODE]);
    });

    it('normalizes full profile templates alongside legacy INI templates', () => {
        const templates = normalizeCustomRuleTemplates([
            {
                id: 'singbox-android',
                name: 'Android',
                type: 'profile',
                target: 'sing-box',
                fileName: 'config.json',
                content: '{ outbounds: [] }'
            },
            {
                id: 'bad-profile',
                name: 'Bad',
                type: 'profile',
                target: 'surge',
                content: '{ outbounds: [] }'
            }
        ]);
        expect(templates).toHaveLength(1);
        expect(templates[0]).toMatchObject({
            id: 'singbox-android',
            type: 'profile',
            target: 'singbox',
            fileName: 'config.json'
        });
    });

    it('renders a stored full profile template through ProcessorService', async () => {
        const storageAdapter = createMemoryStorage({
            misub_rule_templates_v1: [{
                id: 'clash-windows',
                name: 'Windows',
                type: 'profile',
                target: 'clash',
                content: 'proxies: []\nproxy-groups:\n  - name: Main\n    type: select\n    proxies: ["{{MISUB_ALL}}"]\nrules: [MATCH,Main]'
            }]
        });
        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'Demo',
            config: { UpdateInterval: 86400 },
            builtinOptions: {},
            templateSource: { kind: 'custom', value: 'clash-windows' },
            managedConfigUrl: '',
            storageAdapter
        });
        const config = yaml.load(result.content);
        expect(result.headers['X-MiSub-Template-Mode']).toBe('full-profile');
        expect(config.proxies).toHaveLength(2);
        expect(config['proxy-groups'][0].proxies).toEqual([HK_NODE, SG_NODE]);
    });
});
