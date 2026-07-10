import { describe, it, expect } from 'vitest';
import { getBuiltinTemplate } from '../../functions/modules/subscription/builtin-template-registry.js';
import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.js';
import { applySmartModelOptimizations } from '../../functions/modules/subscription/template-processor.js';
import { TRANSFORM_ASSETS } from '../../src/constants/transform-assets.js';
import { getBuiltinRules, getRemoteProviderDefinitions, REMOTE_SOURCES } from '../../functions/modules/subscription/builtin-rules-provider.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';

const sampleProxies = [
    { name: '香港 01', type: 'ss', server: 'hk.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
    { name: '日本 01', type: 'ss', server: 'jp.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
    { name: '美国 01', type: 'ss', server: 'us.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
    { name: '新加坡 01', type: 'ss', server: 'sg.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' }
];

function getOptimizedTemplateModel(templateId) {
    const template = getBuiltinTemplate(templateId);
    expect(template, `${templateId} should exist`).not.toBeNull();

    const model = parseIniTemplate(template.content, {
        proxies: sampleProxies,
        ruleLevel: 'std'
    });
    return applySmartModelOptimizations(model);
}

function findGroup(model, groupName) {
    return model.groups.find(group => group.name === groupName);
}

describe('Builtin template rule audit', () => {
    it('keeps exactly one builtin template marked as default and uses MiSub minimal as that default', () => {
        const builtinDefaultAssets = TRANSFORM_ASSETS.configs.filter(asset =>
            asset.sourceType === 'builtin-preset' && asset.is_default
        );

        expect(builtinDefaultAssets).toHaveLength(1);
        expect(builtinDefaultAssets[0].url).toBe('builtin:clash_misub_minimal');
    });

    it('uses a consistent manual switch group name in MiSub minimal', () => {
        const model = getOptimizedTemplateModel('clash_misub_minimal');
        const mainGroup = findGroup(model, '🚀 节点选择');

        expect(mainGroup?.members).toContain('☑️ 手动切换');
        expect(mainGroup?.members).not.toContain('☑ * 手动切换');
        expect(findGroup(model, '☑️ 手动切换')).toBeTruthy();
    });

    it('lets ACL4SSR lite auto selection include all smart region groups', () => {
        const model = getOptimizedTemplateModel('clash_acl4ssr_lite');
        const autoGroup = findGroup(model, '♻️ 自动选择');

        expect(autoGroup?.members).toContain('🇭🇰 香港节点');
        expect(autoGroup?.members).toContain('🇯🇵 日本节点');
        expect(autoGroup?.members).toContain('🇺🇸 美国节点');
        expect(autoGroup?.members).toContain('🌍 狮城节点');
        expect(autoGroup?.members).not.toContain('🇺🇲 美国节点');
    });

    it('does not put MiSub media AI main selector inside itself', () => {
        const model = getOptimizedTemplateModel('clash_misub_media_ai');
        const mainGroup = findGroup(model, '🚀 节点选择');

        expect(mainGroup?.members).not.toContain('🚀 节点选择');
    });

    it('keeps AI service choices proxy-only and preserves United States region choice', () => {
        const model = getOptimizedTemplateModel('clash_misub_media_ai');
        const aiGroup = findGroup(model, '🤖 AI 服务');

        expect(aiGroup?.members).toContain('🚀 节点选择');
        expect(aiGroup?.members).toContain('♻️ 自动选择');
        expect(aiGroup?.members).toContain('🇺🇸 美国节点');
        expect(aiGroup?.members).toContain('🇯🇵 日本节点');
        expect(aiGroup?.members).not.toContain('DIRECT');
        expect(aiGroup?.members).not.toContain('🇺🇲 美国节点');
    });

    it('uses a consistent AI service group and United States region in ACL4SSR full', () => {
        const model = getOptimizedTemplateModel('clash_acl4ssr_full');
        const aiGroup = findGroup(model, '🤖 AI 服务');
        const legacyOpenAiGroup = findGroup(model, '🤖 OpenAi');

        expect(legacyOpenAiGroup).toBeUndefined();
        expect(aiGroup?.members).toContain('🚀 节点选择');
        expect(aiGroup?.members).toContain('🔯 故障转移');
        expect(aiGroup?.members).toContain('🇺🇸 美国节点');
        expect(aiGroup?.members).not.toContain('🇺🇲 美国节点');
    });

    it('uses maintained SagerNet sing-box binary rule sets instead of deprecated Loyalsoldier JSON rules', () => {
        const rawRules = getBuiltinRules('FULL', 'singbox');
        const providers = getRemoteProviderDefinitions('singbox', rawRules);

        expect(REMOTE_SOURCES.ADS.singbox).toBe('https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-category-ads-all.srs');
        expect(Object.values(REMOTE_SOURCES).every(source => !source.singbox?.includes('Loyalsoldier/sing-box-rules'))).toBe(true);
        expect(Object.values(providers).every(provider => provider.format === 'binary')).toBe(true);
        expect(providers.ADS.url).toBe(REMOTE_SOURCES.ADS.singbox);
    });

    it('emits sing-box ADS rule set as binary SRS in builtin config', () => {
        const parsed = JSON.parse(generateBuiltinSingboxConfig('ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HKNode', { ruleLevel: 'std' }));
        const adsRuleSet = parsed.route.rule_set.find(ruleSet => ruleSet.tag === 'ADS');

        expect(adsRuleSet).toMatchObject({
            type: 'remote',
            format: 'binary',
            url: 'https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-category-ads-all.srs',
            download_detour: 'DIRECT'
        });
    });
});
