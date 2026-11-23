import { describe, it, expect } from 'vitest';
import {
    RULE_SETS,
    getBuiltinRules,
    getRemoteProviderDefinitions,
    GEOX_URLS,
    GH_PROXY_BASE,
    PINNED_RULE_REVISIONS,
} from '../../functions/modules/subscription/builtin-rules-provider.js';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';
import yaml from 'js-yaml';

const LEVELS = ['BASE', 'STD', 'FULL', 'RELAY'];
const SAMPLE_NODES = 'ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HKNode';
const ACL4SSR_CN_DOMAIN = `https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/${PINNED_RULE_REVISIONS.ACL4SSR}/Clash/ChinaDomain.list`;

function indexOfRule(rules, predicate) {
    return rules.findIndex(predicate);
}

describe('内置规则 - 国内直连（域名维度 + IP 维度）', () => {
    it('所有内置等级都在 GEOIP 之前包含国内域名直连规则', () => {
        for (const level of LEVELS) {
            const rules = RULE_SETS[level];
            const cnDomainIdx = indexOfRule(rules, (r) => r === 'RULE-SET,CN_DOMAIN,DIRECT');
            const cnTldIdx = indexOfRule(rules, (r) => r === 'DOMAIN-SUFFIX,cn,DIRECT');
            const geoipIdx = indexOfRule(rules, (r) => r === 'GEOIP,CN,DIRECT');
            const matchIdx = indexOfRule(rules, (r) => r.startsWith('MATCH,'));

            expect(cnDomainIdx, `${level} 应包含 RULE-SET,CN_DOMAIN,DIRECT`).toBeGreaterThan(-1);
            expect(cnTldIdx, `${level} 应包含 .cn 顶级域直连`).toBeGreaterThan(-1);
            expect(geoipIdx, `${level} 应包含 GEOIP,CN,DIRECT`).toBeGreaterThan(-1);
            expect(cnDomainIdx).toBeLessThan(geoipIdx);
            expect(cnTldIdx).toBeLessThan(geoipIdx);
            expect(geoipIdx).toBeLessThan(matchIdx);
        }
    });

    it('Clash 翻译：CN_DOMAIN 生成 rule-provider 引用，geosite 专用源被跳过', () => {
        const rules = getBuiltinRules('RELAY', 'clash');
        const providerRule = rules.find(
            (r) => typeof r === 'object' && r.type === 'rule-provider' && r.provider === 'CN_DOMAIN'
        );
        expect(providerRule).toMatchObject({ target: 'DIRECT' });

        const providers = getRemoteProviderDefinitions('clash', rules);
        expect(providers.CN_DOMAIN).toMatchObject({
            type: 'http',
            behavior: 'classical',
            format: 'text',
            url: ACL4SSR_CN_DOMAIN,
        });
        expect(providers.CN_DOMAIN.path).toBe('./ruleset/CN_DOMAIN.list');
    });

    it('国内请求方的规则源走 gh-proxy.org 加速', () => {
        const rules = getBuiltinRules('RELAY', 'clash', { isChinaClient: true });
        const providers = getRemoteProviderDefinitions('clash', rules, { isChinaClient: true });

        expect(providers.CN_DOMAIN.url).toBe(`${GH_PROXY_BASE}${ACL4SSR_CN_DOMAIN}`);
        expect(providers.ADS.url).toContain(GH_PROXY_BASE);

        const surgeRules = getBuiltinRules('RELAY', 'surge', { isChinaClient: true });
        expect(surgeRules).toContain(
            `RULE-SET,${GH_PROXY_BASE}${ACL4SSR_CN_DOMAIN},DIRECT`
        );

        // 国外请求方保持 raw 直连
        const foreignRules = getBuiltinRules('RELAY', 'surge');
        expect(foreignRules).toContain(`RULE-SET,${ACL4SSR_CN_DOMAIN},DIRECT`);
    });

    it('Clash 翻译后的规则行按 CN → GEOIP → MATCH 顺序输出', () => {
        const rules = getBuiltinRules('RELAY', 'clash').map((r) =>
            typeof r === 'string' ? r : `RULE-SET,${r.provider},${r.target}`
        );
        const cnDomainIdx = indexOfRule(rules, (r) => r === 'RULE-SET,CN_DOMAIN,DIRECT');
        const cnTldIdx = indexOfRule(rules, (r) => r === 'DOMAIN-SUFFIX,cn,DIRECT');
        const geoipIdx = indexOfRule(rules, (r) => r === 'GEOIP,CN,DIRECT');
        const matchIdx = indexOfRule(rules, (r) => r.startsWith('MATCH,'));

        expect(cnDomainIdx).toBeGreaterThan(-1);
        expect(cnDomainIdx).toBeLessThan(geoipIdx);
        expect(cnTldIdx).toBeLessThan(geoipIdx);
        expect(geoipIdx).toBeLessThan(matchIdx);
    });

    it('sing-box 翻译：CN_DOMAIN 复用 geosite-cn 规则集且位于 geoip-cn 之前', () => {
        const rules = getBuiltinRules('RELAY', 'singbox');
        const geositeIdx = indexOfRule(
            rules,
            (r) => typeof r === 'object' && r.type === 'rule_set' && r.tag === 'geosite-cn'
        );
        const geoipIdx = indexOfRule(
            rules,
            (r) => typeof r === 'object' && r.type === 'rule_set' && r.tag === 'geoip-cn'
        );
        const cnSuffixIdx = indexOfRule(
            rules,
            (r) =>
                typeof r === 'object' &&
                Array.isArray(r.domain_suffix) &&
                r.domain_suffix.includes('cn')
        );

        expect(geositeIdx).toBeGreaterThan(-1);
        expect(geositeIdx).toBeLessThan(geoipIdx);
        expect(cnSuffixIdx).toBeLessThan(geoipIdx);

        // 规则集定义中 geosite-cn 只应出现一次（DNS 分流与路由共享同一份下载）
        const providers = getRemoteProviderDefinitions('singbox', rules);
        expect(Object.keys(providers).filter((tag) => tag === 'geosite-cn')).toHaveLength(1);
    });

    it('Surge/Loon 翻译：CN_DOMAIN 指向 ACL4SSR 国内域名列表，且不产生 undefined 引用', () => {
        for (const format of ['surge', 'loon']) {
            const rules = getBuiltinRules('RELAY', format);
            expect(rules).toContain(`RULE-SET,${ACL4SSR_CN_DOMAIN},DIRECT`);
            expect(rules).toContain('DOMAIN-SUFFIX,cn,DIRECT');
            rules.forEach((rule) => {
                expect(rule).not.toContain('undefined');
            });
        }
    });

    it('Quantumult X 翻译：仅输出显式 quanx 源，不回退到 Clash URL', () => {
        const rules = getBuiltinRules('STD', 'quanx');
        rules.forEach((rule) => {
            if (rule.startsWith('filter_remote')) {
                // ACL4SSR Clash 列表为 QuanX 兼容的 classical 文本，其余源不得混入
                expect(rule).toContain('raw.githubusercontent.com/ACL4SSR');
                expect(rule).not.toContain('.yaml');
            }
        });
        expect(rules).toContain('HOST-SUFFIX, cn, DIRECT');
    });
});

describe('内置生成器 - 国内直连兜底能力', () => {
    it('Clash(Meta) 配置注入 geox-url jsDelivr 镜像，规则顺序正确', () => {
        const config = yaml.load(
            generateBuiltinClashConfig(SAMPLE_NODES, { ruleLevel: 'relay', isMeta: true })
        );

        expect(config['geox-url']).toMatchObject({
            geoip: expect.stringContaining(
                'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat'
            ),
            geosite: expect.stringContaining('meta-rules-dat@release/geosite.dat'),
            mmdb: expect.stringContaining('meta-rules-dat@release/country.mmdb'),
        });

        const cnDomainIdx = indexOfRule(config.rules, (r) => r === 'RULE-SET,CN_DOMAIN,DIRECT');
        const cnTldIdx = indexOfRule(config.rules, (r) => r === 'DOMAIN-SUFFIX,cn,DIRECT');
        const geoipIdx = indexOfRule(config.rules, (r) => r === 'GEOIP,CN,DIRECT');
        const matchIdx = indexOfRule(config.rules, (r) => r.startsWith('MATCH,'));

        expect(cnDomainIdx).toBeGreaterThan(-1);
        expect(cnDomainIdx).toBeLessThan(geoipIdx);
        expect(cnTldIdx).toBeLessThan(geoipIdx);
        expect(geoipIdx).toBeLessThan(matchIdx);

        // 国内域名规则集的 rule-provider 定义应存在（国外请求方走 raw 直连）
        expect(config['rule-providers'].CN_DOMAIN).toMatchObject({
            behavior: 'classical',
            format: 'text',
            url: ACL4SSR_CN_DOMAIN,
        });
    });

    it('国内请求方生成的 Clash 配置规则源全部经 gh-proxy 加速', () => {
        const config = yaml.load(
            generateBuiltinClashConfig(SAMPLE_NODES, {
                ruleLevel: 'relay',
                isMeta: true,
                isChinaClient: true,
            })
        );
        const providerUrls = Object.values(config['rule-providers'] || {}).map((p) => p.url);

        expect(providerUrls.length).toBeGreaterThan(0);
        for (const url of providerUrls) {
            expect(url.startsWith(`${GH_PROXY_BASE}https://raw.githubusercontent.com/`)).toBe(
                true
            );
        }
    });

    it('sing-box 配置：geosite-cn 直连规则在 geoip-cn 之前，且不再重复追加 .cn 兜底', () => {
        const parsed = JSON.parse(
            generateBuiltinSingboxConfig(SAMPLE_NODES, { ruleLevel: 'relay' })
        );

        const rules = parsed.route.rules;
        const geositeIdx = indexOfRule(rules, (r) => Array.isArray(r.rule_set) && r.rule_set.includes('geosite-cn'));
        const geoipIdx = indexOfRule(rules, (r) => Array.isArray(r.rule_set) && r.rule_set.includes('geoip-cn'));

        expect(geositeIdx).toBeGreaterThan(-1);
        expect(geositeIdx).toBeLessThan(geoipIdx);

        // 在 geoip-cn 之前应有一条 .cn 后缀直连（来自规则集 DOMAIN-SUFFIX,cn），其后不应再有重复项
        const firstCnSuffixIdx = indexOfRule(
            rules,
            (r) => Array.isArray(r.domain_suffix) && r.domain_suffix.includes('cn')
        );
        const lastCnSuffixIdx = rules.length - 1 - [...rules].reverse().findIndex((r) => Array.isArray(r.domain_suffix) && r.domain_suffix.includes('cn'));
        expect(firstCnSuffixIdx).toBeGreaterThan(-1);
        expect(firstCnSuffixIdx).toBeLessThan(geoipIdx);
        expect(lastCnSuffixIdx).toBe(firstCnSuffixIdx);

        // route.rule_set 里 geosite-cn 只定义一次
        expect(parsed.route.rule_set.filter((rs) => rs.tag === 'geosite-cn')).toHaveLength(1);
    });

    it('GEOX_URLS 全部指向 jsDelivr 镜像（geo 数据库不受 ACL4SSR 封禁影响）', () => {
        Object.values(GEOX_URLS).forEach((url) => {
            expect(url).toContain('https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/');
            expect(url).not.toContain('github.com');
        });
    });
});
