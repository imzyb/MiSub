export function renderTransformTemplate(templateText, context = {}) {
    if (typeof templateText !== 'string' || templateText.trim() === '') return templateText;

    const replacements = {
        '<%proxies%>': context.proxies ?? '',
        '<%rules%>': context.rules ?? '',
        '<%file_name%>': context.fileName ?? '',
        '<%fileName%>': context.fileName ?? '',
        '<%interval%>': context.interval ?? '',
        '<%managed_config_url%>': context.managedConfigUrl ?? '',
        '<%managedConfigUrl%>': context.managedConfigUrl ?? '',
        '<%target_format%>': context.targetFormat ?? '',
        '<%targetFormat%>': context.targetFormat ?? '',
        '<%node_count%>': context.nodeCount ?? '',
        '<%nodeCount%>': context.nodeCount ?? '',
        '<%region_groups%>': context.regionGroups ?? '',
        '<%regionGroups%>': context.regionGroups ?? '',
        '<%region_group_names%>': context.regionGroupNames ?? '',
        '<%regionGroupNames%>': context.regionGroupNames ?? '',
        '<%region_group_counts%>': context.regionGroupCounts ?? '',
        '<%regionGroupCounts%>': context.regionGroupCounts ?? '',
        '<%region_group_list%>': context.regionGroupList ?? '',
        '<%regionGroupList%>': context.regionGroupList ?? '',
        '<%protocol_groups%>': context.protocolGroups ?? '',
        '<%protocolGroups%>': context.protocolGroups ?? '',
        '<%protocol_group_names%>': context.protocolGroupNames ?? '',
        '<%protocolGroupNames%>': context.protocolGroupNames ?? '',
        '<%protocol_group_counts%>': context.protocolGroupCounts ?? '',
        '<%protocolGroupCounts%>': context.protocolGroupCounts ?? '',
        '<%protocol_group_list%>': context.protocolGroupList ?? '',
        '<%protocolGroupList%>': context.protocolGroupList ?? '',
        '<%primary_strategy_chain%>': context.primaryStrategyChain ?? '',
        '<%primaryStrategyChain%>': context.primaryStrategyChain ?? '',
        '<%region_strategy_chain%>': context.regionStrategyChain ?? '',
        '<%regionStrategyChain%>': context.regionStrategyChain ?? '',
        '<%protocol_strategy_chain%>': context.protocolStrategyChain ?? '',
        '<%protocolStrategyChain%>': context.protocolStrategyChain ?? '',
        '<%all_strategy_groups%>': context.allStrategyGroups ?? '',
        '<%allStrategyGroups%>': context.allStrategyGroups ?? ''
    };

    let rendered = templateText;
    for (const [placeholder, value] of Object.entries(replacements)) {
        rendered = rendered.split(placeholder).join(String(value));
    }

    return rendered;
}

export function buildTransformTemplateContext({ proxies = '', rules = '', fileName = '', interval = '', managedConfigUrl = '', targetFormat = '', nodeCount = 0, regionGroups = [], protocolGroups = [] } = {}) {
    const normalizedRegionGroups = Array.isArray(regionGroups) ? regionGroups : [];
    const normalizedProtocolGroups = Array.isArray(protocolGroups) ? protocolGroups : [];
    const regionNames = normalizedRegionGroups.map(group => group.name).filter(Boolean);
    const protocolNames = normalizedProtocolGroups.map(group => group.name).filter(Boolean);
    const primaryStrategyChain = ['🚀 节点选择', '♻️ 自动选择', ...regionNames, ...protocolNames, '☑️ 手动切换', 'DIRECT'].join(', ');
    return {
        proxies,
        rules,
        fileName,
        interval,
        managedConfigUrl,
        targetFormat,
        nodeCount,
        regionGroups: JSON.stringify(normalizedRegionGroups, null, 2),
        regionGroupNames: normalizedRegionGroups.map(group => group.name).join(', '),
        regionGroupCounts: normalizedRegionGroups.map(group => `${group.name}:${group.count ?? (group.tags?.length || 0)}`).join(', '),
        regionGroupList: normalizedRegionGroups.map(group => `${group.name}(${group.count ?? (group.tags?.length || 0)})`).join('\n'),
        protocolGroups: JSON.stringify(normalizedProtocolGroups, null, 2),
        protocolGroupNames: normalizedProtocolGroups.map(group => group.name).join(', '),
        protocolGroupCounts: normalizedProtocolGroups.map(group => `${group.name}:${group.count ?? (group.lines?.length || 0)}`).join(', '),
        protocolGroupList: normalizedProtocolGroups.map(group => `${group.name}(${group.count ?? (group.lines?.length || 0)})`).join('\n'),
        primaryStrategyChain,
        regionStrategyChain: regionNames.join(', '),
        protocolStrategyChain: protocolNames.join(', '),
        allStrategyGroups: [...new Set(['🚀 节点选择', '♻️ 自动选择', ...regionNames, ...protocolNames, '☑️ 手动切换', 'DIRECT'])].join(', ')
    };
}
