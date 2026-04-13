import { describe, it, expect } from 'vitest';
import { buildTransformTemplateContext, renderTransformTemplate } from '../../functions/modules/subscription/transform-template-renderer.js';

describe('Transform template renderer', () => {
    it('should replace placeholders', () => {
        const rendered = renderTransformTemplate('name=<%fileName%>\nproxies=<%proxies%>\nrules=<%rules%>\nregions=<%regionGroupNames%>\nprotocols=<%protocolGroupNames%>\nchain=<%primaryStrategyChain%>', {
            fileName: 'Demo',
            proxies: 'proxy-a',
            rules: 'MATCH,DIRECT',
            regionGroupNames: '🇯🇵 日本节点',
            protocolGroupNames: 'Trojan 节点',
            primaryStrategyChain: '🚀 节点选择, ♻️ 自动选择, 🇯🇵 日本节点, Trojan 节点, ☑️ 手动切换, DIRECT'
        });

        expect(rendered).toContain('name=Demo');
        expect(rendered).toContain('proxies=proxy-a');
        expect(rendered).toContain('rules=MATCH,DIRECT');
        expect(rendered).toContain('regions=🇯🇵 日本节点');
        expect(rendered).toContain('protocols=Trojan 节点');
        expect(rendered).toContain('chain=🚀 节点选择, ♻️ 自动选择, 🇯🇵 日本节点, Trojan 节点, ☑️ 手动切换, DIRECT');
    });

    it('should build region aware context', () => {
        const context = buildTransformTemplateContext({
            fileName: 'Demo',
            regionGroups: [{ name: '🇯🇵 日本节点', tags: ['JP-1', 'JP-2'] }],
            protocolGroups: [{ name: 'Trojan 节点', lines: ['trojan://a', 'trojan://b'] }]
        });

        expect(context.regionGroupNames).toContain('🇯🇵 日本节点');
        expect(context.regionGroups).toContain('JP-1');
        expect(context.regionGroupCounts).toContain('🇯🇵 日本节点:2');
        expect(context.regionGroupList).toContain('🇯🇵 日本节点(2)');
        expect(context.protocolGroupNames).toContain('Trojan 节点');
        expect(context.protocolGroups).toContain('trojan://a');
        expect(context.protocolGroupCounts).toContain('Trojan 节点:2');
        expect(context.protocolGroupList).toContain('Trojan 节点(2)');
        expect(context.primaryStrategyChain).toContain('🚀 节点选择');
        expect(context.regionStrategyChain).toContain('🇯🇵 日本节点');
        expect(context.protocolStrategyChain).toContain('Trojan 节点');
        expect(context.allStrategyGroups).toContain('DIRECT');
    });
});
