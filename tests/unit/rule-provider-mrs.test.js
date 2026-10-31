import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { renderClashFromIniTemplate } from '../../functions/modules/subscription/template-pipeline.js';

const PROXIES = [{ name: 'HK-01', type: 'trojan', server: '1.1.1.1', port: 443, password: 'pass' }];

function group(name, type, members) {
    return `custom_proxy_group=${name}\`${type}\`${members}`;
}

function render(rulesets) {
    const template = [
        '[custom]',
        group('🚀 节点选择', 'select', '.*'),
        group('🇨🇳 国内直连', 'select', '[]DIRECT'),
        group('🛑 广告拦截', 'select', '[]REJECT'),
        ...rulesets,
        'ruleset=🚀 节点选择,[]FINAL',
    ].join('\n');

    return yaml.load(
        renderClashFromIniTemplate(template, {
            proxies: PROXIES.map((proxy) => ({ ...proxy })),
            ruleLevel: 'none',
        })
    );
}

function providerFor(parsed, urlSuffix) {
    const providers = parsed['rule-providers'] || {};
    return Object.values(providers).find((provider) => String(provider.url).endsWith(urlSuffix));
}

describe('Mihomo mrs rule providers', () => {
    it('emits format mrs with domain behavior for geosite sets', () => {
        const parsed = render([
            'ruleset=🇨🇳 国内直连,https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/cn.mrs',
        ]);

        const provider = providerFor(parsed, '/geo/geosite/cn.mrs');

        expect(provider).toBeDefined();
        expect(provider.format).toBe('mrs');
        expect(provider.behavior).toBe('domain');
        expect(provider.path.endsWith('.mrs')).toBe(true);
    });

    it('emits ipcidr behavior for geoip sets', () => {
        const parsed = render([
            'ruleset=🇨🇳 国内直连,https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/cn.mrs',
        ]);

        const provider = providerFor(parsed, '/geo/geoip/cn.mrs');

        expect(provider).toBeDefined();
        expect(provider.format).toBe('mrs');
        expect(provider.behavior).toBe('ipcidr');
        expect(provider.path.endsWith('.mrs')).toBe(true);
    });

    it('keeps domain behavior for mrs urls outside a geoip path', () => {
        const parsed = render([
            'ruleset=🛑 广告拦截,https://cdn.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomo.mrs',
        ]);

        const provider = providerFor(parsed, '/rules/adblockmihomo.mrs');

        expect(provider).toBeDefined();
        expect(provider.format).toBe('mrs');
        expect(provider.behavior).toBe('domain');
    });

    it('leaves yaml and list providers unchanged', () => {
        const parsed = render([
            'ruleset=🇨🇳 国内直连,https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/ChinaMax/ChinaMax_Classical.yaml',
            'ruleset=🛑 广告拦截,https://cdn.jsdelivr.net/gh/example/rules@main/rules/custom.list',
        ]);

        const yamlProvider = providerFor(parsed, 'ChinaMax_Classical.yaml');
        expect(yamlProvider).toBeDefined();
        expect(yamlProvider.behavior).toBe('classical');
        expect(yamlProvider.format).toBeUndefined();
        expect(yamlProvider.path.endsWith('.yaml')).toBe(true);

        const listProvider = providerFor(parsed, 'custom.list');
        expect(listProvider).toBeDefined();
        expect(listProvider.behavior).toBe('classical');
        expect(listProvider.format).toBe('text');
        expect(listProvider.path.endsWith('.list')).toBe(true);
    });
});
