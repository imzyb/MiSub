import { describe, it, expect } from 'vitest';
import { buildTransformTemplateContext, renderTransformTemplate } from '../../functions/modules/subscription/transform-template-renderer.js';

describe('Transform template renderer', () => {
    it('should replace placeholders', () => {
        const rendered = renderTransformTemplate('name=<%file_name%>/<%fileName%>\ntarget=<%target_format%>/<%targetFormat%>\ncount=<%node_count%>/<%nodeCount%>\nproxies=<%proxies%>\nrules=<%rules%>\nregions=<%region_group_names%>/<%regionGroupNames%>\nregion-counts=<%region_group_counts%>/<%regionGroupCounts%>\nregion-list=<%region_group_list%>/<%regionGroupList%>\nprotocols=<%protocol_group_names%>/<%protocolGroupNames%>\nprotocol-counts=<%protocol_group_counts%>/<%protocolGroupCounts%>\nprotocol-list=<%protocol_group_list%>/<%protocolGroupList%>\nprimary=<%primary_strategy_chain%>/<%primaryStrategyChain%>\nregion-chain=<%region_strategy_chain%>/<%regionStrategyChain%>\nprotocol-chain=<%protocol_strategy_chain%>/<%protocolStrategyChain%>\nall=<%all_strategy_groups%>/<%allStrategyGroups%>', {
            fileName: 'Demo',
            targetFormat: 'clash',
            nodeCount: 2,
            proxies: 'proxy-a',
            rules: 'MATCH,DIRECT',
            regionGroupNames: '🇯🇵 日本节点',
            regionGroupCounts: '🇯🇵 日本节点:2',
            regionGroupList: '🇯🇵 日本节点(2)',
            protocolGroupNames: 'Trojan 节点',
            protocolGroupCounts: 'Trojan 节点:2',
            protocolGroupList: 'Trojan 节点(2)',
            primaryStrategyChain: '🚀 节点选择, ♻️ 自动选择, 🇯🇵 日本节点, Trojan 节点, ☑️ 手动切换, DIRECT',
            regionStrategyChain: '🇯🇵 日本节点',
            protocolStrategyChain: 'Trojan 节点',
            allStrategyGroups: '🚀 节点选择, 🇯🇵 日本节点, Trojan 节点, DIRECT'
        });

        expect(rendered).toContain('name=Demo/Demo');
        expect(rendered).toContain('target=clash/clash');
        expect(rendered).toContain('count=2/2');
        expect(rendered).toContain('proxies=proxy-a');
        expect(rendered).toContain('rules=MATCH,DIRECT');
        expect(rendered).toContain('regions=🇯🇵 日本节点/🇯🇵 日本节点');
        expect(rendered).toContain('region-counts=🇯🇵 日本节点:2/🇯🇵 日本节点:2');
        expect(rendered).toContain('region-list=🇯🇵 日本节点(2)/🇯🇵 日本节点(2)');
        expect(rendered).toContain('protocols=Trojan 节点/Trojan 节点');
        expect(rendered).toContain('protocol-counts=Trojan 节点:2/Trojan 节点:2');
        expect(rendered).toContain('protocol-list=Trojan 节点(2)/Trojan 节点(2)');
        expect(rendered).toContain('primary=🚀 节点选择, ♻️ 自动选择, 🇯🇵 日本节点, Trojan 节点, ☑️ 手动切换, DIRECT/🚀 节点选择, ♻️ 自动选择, 🇯🇵 日本节点, Trojan 节点, ☑️ 手动切换, DIRECT');
        expect(rendered).toContain('region-chain=🇯🇵 日本节点/🇯🇵 日本节点');
        expect(rendered).toContain('protocol-chain=Trojan 节点/Trojan 节点');
        expect(rendered).toContain('all=🚀 节点选择, 🇯🇵 日本节点, Trojan 节点, DIRECT/🚀 节点选择, 🇯🇵 日本节点, Trojan 节点, DIRECT');
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
