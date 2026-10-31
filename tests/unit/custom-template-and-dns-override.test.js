import { describe, expect, it } from 'vitest';
import { renderClashFromIniTemplate } from '../../functions/modules/subscription/template-pipeline.js';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import {
    resolveSafeDnsConfig,
    DNS_PROXY_GROUP,
} from '../../functions/modules/subscription/safe-dns.js';
import yaml from 'js-yaml';

const sampleNodeList = [
    'ss://MjAyMi1ibGFrZTMtYWVzLTEyOC1nY206ZXhhbXBsZVBhc3N3b3JkMTIz@hk.example.com:443#%F0%9F%87%AD%F0%9F%87%B0%20%E9%A6%99%E6%B8%AF%2001',
    'ss://MjAyMi1ibGFrZTMtYWVzLTEyOC1nY206ZXhhbXBsZVBhc3N3b3JkMTIz@us.example.com:443#%F0%9F%87%BA%F0%9F%87%B8%20%E7%BE%8E%E5%9B%BD%2001',
    'ss://MjAyMi1ibGFrZTMtYWVzLTEyOC1nY206ZXhhbXBsZVBhc3N3b3JkMTIz@kr.example.com:443#%F0%9F%87%B0%F0%9F%87%B7%20%E9%9F%A9%E5%9B%BD%2001',
].join('\n');

const customIniTemplate = [
    '[rule]',
    'DOMAIN-KEYWORD,mycustomdomain,🚀 节点选择',
    'GEOIP,CN,DIRECT',
    'FINAL,🐟 漏网之鱼',
    '',
    '[custom]',
    'custom_proxy_group=🚀 节点选择`select`[]♻️ 自动选择`[]DIRECT',
    'custom_proxy_group=♻️ 自动选择`url-test`.*`http://www.gstatic.com/generate_204`300,,50',
    'custom_proxy_group=🐟 漏网之鱼`select`[]🚀 节点选择`[]DIRECT',
].join('\n');

const userCustomDnsYaml = [
    'dns:',
    '  enable: true',
    '  ipv6: true',
    '  enhanced-mode: fake-ip',
    '  fake-ip-range: 198.18.0.1/16',
    '  fake-ip-filter:',
    '    - geosite:private',
    '    - geosite:category-ntp',
    '  use-hosts: false',
    '  use-system-hosts: false',
    '  nameserver:',
    '    - https://1.1.1.1/dns-query',
    '    - https://8.8.8.8/dns-query',
    '  proxy-server-nameserver:',
    '    - https://223.5.5.5/dns-query',
    '    - https://223.6.6.6/dns-query',
    '  nameserver-policy:',
    '    geosite:cn:',
    '      - https://223.5.5.5/dns-query',
    '      - https://223.6.6.6/dns-query',
    '  respect-rules: true',
].join('\n');

describe('Custom template isolation & Custom DNS override', () => {
    it('does not inject AI groups or AI domain rules in custom template mode, but keeps default DNS proxy group when no custom DNS is configured', () => {
        const output = renderClashFromIniTemplate(customIniTemplate, {
            nodeList: sampleNodeList,
            ruleLevel: 'none',
            fileName: 'TestSub',
        });
        const parsed = yaml.load(output);

        const groupNames = (parsed['proxy-groups'] || []).map((g) => g.name);
        const aiGroups = groupNames.filter(
            (name) => name.includes('AI') || name.includes('OpenAI') || name.includes('Claude')
        );
        expect(aiGroups).toEqual([]);

        // 未配置自定义 DNS，采用作者默认 Safe DNS 时，保留 DNS 出口策略组以供 nameserver 引用
        expect(groupNames).toContain(DNS_PROXY_GROUP);

        const rules = parsed.rules || [];
        const hasAiRule = rules.some(
            (rule) =>
                rule.includes('openai.com') || rule.includes('claude.ai') || rule.includes('🤖')
        );
        expect(hasAiRule).toBe(false);
    });

    it('faithfully preserves user custom DNS block without appending #DNS 出口 tags', () => {
        const dns = resolveSafeDnsConfig(userCustomDnsYaml);

        expect(dns.enable).toBe(true);
        expect(dns.ipv6).toBe(true);
        expect(dns['enhanced-mode']).toBe('fake-ip');
        expect(dns['use-hosts']).toBe(false);
        expect(dns.nameserver).toEqual(['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query']);
        expect(dns['nameserver-policy']['geosite:cn']).toEqual([
            'https://223.5.5.5/dns-query',
            'https://223.6.6.6/dns-query',
        ]);
    });

    it('does not inject DNS_PROXY_GROUP when customDnsOverride is configured in template pipeline', () => {
        const output = renderClashFromIniTemplate(customIniTemplate, {
            nodeList: sampleNodeList,
            ruleLevel: 'std',
            customDnsOverride: userCustomDnsYaml,
            fileName: 'TestSub',
        });
        const parsed = yaml.load(output);

        const groupNames = (parsed['proxy-groups'] || []).map((g) => g.name);
        expect(groupNames).not.toContain(DNS_PROXY_GROUP);
        expect(parsed.dns.nameserver).toEqual([
            'https://1.1.1.1/dns-query',
            'https://8.8.8.8/dns-query',
        ]);
    });

    it('does not inject DNS_PROXY_GROUP in builtin generator when customDnsOverride is present without DNS exit', () => {
        const output = generateBuiltinClashConfig(sampleNodeList, {
            ruleLevel: 'std',
            customDnsOverride: userCustomDnsYaml,
            fileName: 'BuiltinTest',
        });
        const parsed = yaml.load(output);

        const groupNames = (parsed['proxy-groups'] || []).map((g) => g.name);
        expect(groupNames).not.toContain(DNS_PROXY_GROUP);
        expect(parsed.dns.nameserver).toEqual([
            'https://1.1.1.1/dns-query',
            'https://8.8.8.8/dns-query',
        ]);
    });

    it('still retains AI policy and default safe DNS in standard builtin mode', () => {
        const output = generateBuiltinClashConfig(sampleNodeList, {
            ruleLevel: 'std',
            fileName: 'BuiltinStd',
        });
        const parsed = yaml.load(output);

        const groupNames = (parsed['proxy-groups'] || []).map((g) => g.name);
        expect(groupNames).toContain(DNS_PROXY_GROUP);
        expect(groupNames).toContain('🤖 AI 自动');
        expect(groupNames).toContain('🤖 OpenAI');
        expect(parsed.dns.nameserver).toEqual([
            `udp://8.8.8.8:53#${DNS_PROXY_GROUP}`,
            `udp://1.1.1.1:53#${DNS_PROXY_GROUP}`,
        ]);
    });
});
