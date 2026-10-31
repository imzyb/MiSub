import { groupNodeLinesByRegion } from './region-groups.js';
import { AI_SERVICE_RULES } from './builtin-rules-provider.js';
import { DNS_PROXY_GROUP } from './safe-dns.js';

/**
 * 解析并扩展策略组中的正则过滤器
 * @param {Object} model - 统一模板模型
 */
function resolveGroupFilters(model) {
    const proxyNames = model.proxies.map((p) => p.name || p.tag).filter(Boolean);
    if (proxyNames.length === 0) return;

    model.groups.forEach((group) => {
        if (!Array.isArray(group.filters) || group.filters.length === 0) return;

        group.members = group.members || [];
        const currentMembers = new Set(group.members);

        group.filters.forEach((filter) => {
            if (filter === '.*') {
                proxyNames.forEach((name) => currentMembers.add(name));
                return;
            }

            try {
                const regex = new RegExp(filter, 'i');
                proxyNames.forEach((name) => {
                    if (regex.test(name)) {
                        currentMembers.add(name);
                    }
                });
            } catch (e) {
                console.warn(`[Template Processor] Invalid regex filter: ${filter}`, e);
            }
        });

        group.members = Array.from(currentMembers);
    });
}

/**
 * 递归修剪所有成员为空的策略组，并清理相关引用
 * @param {Object} model - 统一模板模型
 */
function pruneEmptyGroups(model) {
    let changed = true;
    while (changed) {
        changed = false;
        const emptyGroupNames = new Set(
            model.groups
                .filter((g) => !Array.isArray(g.members) || g.members.length === 0)
                .map((g) => g.name)
        );

        if (emptyGroupNames.size === 0) break;

        // 1. 移除空组本身
        const initialCount = model.groups.length;
        model.groups = model.groups.filter((g) => !emptyGroupNames.has(g.name));
        if (model.groups.length !== initialCount) changed = true;

        // 2. 从其它组的成员列表中移除对空组的引用
        model.groups.forEach((group) => {
            if (Array.isArray(group.members)) {
                const newMembers = group.members.filter((m) => !emptyGroupNames.has(m));
                if (newMembers.length !== group.members.length) {
                    group.members = newMembers;
                    changed = true;
                }
            }
        });

        // 3. 从规则列表中移除指向空组的规则
        const initialRuleCount = model.rules.length;
        model.rules = model.rules.filter((rule) => !emptyGroupNames.has(rule.policy));
        if (model.rules.length !== initialRuleCount) changed = true;
    }
}

function normalizeGroupSemanticName(name = '') {
    return String(name)
        .replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '')
        .replace(/[\s_-]+/g, '')
        .replace(/节点/g, '')
        .toLowerCase();
}

function hasEquivalentRegionGroup(model, region) {
    const regionTags = new Set(region.tags || []);
    const normalizedRegionName = normalizeGroupSemanticName(region.name);

    return model.groups.some((group) => {
        const normalizedGroupName = normalizeGroupSemanticName(group.name);
        if (normalizedGroupName === normalizedRegionName) return true;

        const members = Array.isArray(group.members) ? group.members : [];
        if (members.length === 0) return false;

        const overlapCount = members.filter((member) => regionTags.has(member)).length;
        return (
            overlapCount > 0 && overlapCount === members.length && overlapCount === regionTags.size
        );
    });
}

function dedupeGroupsByName(model) {
    const mergedGroups = [];
    const seen = new Map();

    model.groups.forEach((group) => {
        const name = String(group.name || '').trim();
        if (!name) return;

        if (!seen.has(name)) {
            const normalized = {
                ...group,
                name,
                members: Array.isArray(group.members)
                    ? Array.from(new Set(group.members.filter(Boolean)))
                    : [],
                filters: Array.isArray(group.filters)
                    ? Array.from(new Set(group.filters.filter(Boolean)))
                    : [],
                options:
                    typeof group.options === 'object' && group.options !== null
                        ? { ...group.options }
                        : {},
            };
            seen.set(name, normalized);
            mergedGroups.push(normalized);
            return;
        }

        const existing = seen.get(name);
        existing.members = Array.from(
            new Set([...(existing.members || []), ...(group.members || []).filter(Boolean)])
        );
        existing.filters = Array.from(
            new Set([...(existing.filters || []), ...(group.filters || []).filter(Boolean)])
        );
        existing.options = {
            ...(existing.options || {}),
            ...(typeof group.options === 'object' && group.options !== null ? group.options : {}),
        };

        if ((!existing.type || existing.type === 'select') && group.type) {
            existing.type = group.type;
        }
    });

    model.groups = mergedGroups;
}

/**
 * 展开魔法占位符（如 <%regionStrategyChain%>）
 * @param {Object} model - 统一模板模型
 */
function expandMagicPlaceholders(model) {
    const regionNames = Array.from(
        new Set(
            model.groups
                .filter((g) => g.type === 'url-test' && !g.name.includes('自动'))
                .map((g) => g.name)
        )
    );

    // 获取协议分组（如果存在）
    const protocolNames = Array.from(
        new Set(
            model.groups
                .filter((g) => g.name.includes('节点') && !regionNames.includes(g.name))
                .map((g) => g.name)
        )
    );

    model.groups.forEach((group) => {
        if (!Array.isArray(group.members)) return;

        const newMembers = [];
        group.members.forEach((member) => {
            if (member === '<%regionStrategyChain%>') {
                newMembers.push(...regionNames);
            } else if (member === '<%protocolStrategyChain%>') {
                newMembers.push(...protocolNames);
            } else {
                newMembers.push(member);
            }
        });
        group.members = newMembers;
    });
}

/**
 * 清理策略组中指向空组或不存在节点的无效引用
 * @param {Object} model - 统一模板模型
 */
function pruneInvalidMembers(model) {
    const validTargetNames = new Set([
        ...model.proxies.map((p) => p.name || p.tag),
        ...model.groups.map((g) => g.name),
        'DIRECT',
        'REJECT',
    ]);

    model.groups.forEach((group) => {
        if (Array.isArray(group.members)) {
            group.members = group.members.filter((m) => validTargetNames.has(m));
        }
    });
}

function ensureDnsProxyGroup(model) {
    if (model.groups.some((group) => group.name === DNS_PROXY_GROUP)) return;
    const proxyNames = model.proxies.map((proxy) => proxy.name || proxy.tag).filter(Boolean);
    model.groups.push({
        name: DNS_PROXY_GROUP,
        type: 'url-test',
        members: proxyNames.length > 0 ? proxyNames : ['REJECT'],
        filters: [],
        options: {
            url: 'http://www.gstatic.com/generate_204',
            interval: 300,
            tolerance: 50,
        },
    });
}

function isAiGroupName(name) {
    const value = String(name || '');
    return /人工智能|智能\s*ai|(?:^|[^a-z])(ai|claude|openai|gemini|grok|mistral|deepseek|perplexity|copilot)(?=$|[^a-z])/i.test(
        value
    );
}

function proxyOnlyMembers(members) {
    return Array.from(
        new Set(
            (Array.isArray(members) ? members : []).filter(
                (member) =>
                    !['DIRECT', 'REJECT-DROP', 'PASS'].includes(String(member).toUpperCase())
            )
        )
    );
}

function ensureAiPolicy(model) {
    const aiGroups = model.groups.filter((group) => isAiGroupName(group.name));
    const mainGroup = model.groups.find(
        (group) => !isAiGroupName(group.name) && /选择|proxy|default|global|main/i.test(group.name)
    );
    const fallbackMembers = proxyOnlyMembers(mainGroup?.members);
    const preferredMembers = proxyOnlyMembers(aiGroups[0]?.members);
    const nodeMembers = model.proxies.map((proxy) => proxy.name || proxy.tag).filter(Boolean);
    const aiMembers = Array.from(
        new Set([
            ...(preferredMembers.length > 0 ? preferredMembers : fallbackMembers),
            ...(preferredMembers.length > 0 || fallbackMembers.length > 0 ? [] : nodeMembers),
        ])
    );
    const nodeCandidates = aiMembers.length > 0 ? aiMembers : ['REJECT'];

    aiGroups.forEach((group) => {
        group.members = proxyOnlyMembers(group.members);
        if (group.members.length === 0) group.members = ['REJECT'];
    });

    const existingNames = new Set(model.groups.map((group) => group.name));
    if (!existingNames.has('🤖 AI 自动')) {
        model.groups.push({
            name: '🤖 AI 自动',
            type: 'url-test',
            members: nodeCandidates,
            filters: [],
            options: { url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
        });
        existingNames.add('🤖 AI 自动');
    }
    if (!existingNames.has('🤖 AI 故障转移')) {
        model.groups.push({
            name: '🤖 AI 故障转移',
            type: 'fallback',
            members: nodeCandidates,
            filters: [],
            options: { url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
        });
        existingNames.add('🤖 AI 故障转移');
    }
    if (!existingNames.has('🤖 智能 AI')) {
        model.groups.push({
            name: '🤖 智能 AI',
            type: 'select',
            members: ['🤖 AI 自动', '🤖 AI 故障转移'],
        });
        existingNames.add('🤖 智能 AI');
    }
    AI_SERVICE_RULES.forEach((service) => {
        const groupName = `🤖 ${service.name}`;
        if (!existingNames.has(groupName)) {
            model.groups.push({
                name: groupName,
                type: 'select',
                members: ['🤖 AI 自动', '🤖 AI 故障转移'],
                filters: [],
                options: {},
            });
            existingNames.add(groupName);
        }
    });

    const existingRules = new Set(
        model.rules.map((rule) => `${rule.type}|${rule.value}|${rule.policy}`)
    );
    const aiRules = [];
    AI_SERVICE_RULES.forEach((service) =>
        service.domains.forEach((domain) => {
            const rule = {
                type: 'domain-suffix',
                value: domain,
                policy: `🤖 ${service.name}`,
                source: 'inline',
                extras: [],
            };
            const key = `${rule.type}|${rule.value}|${rule.policy}`;
            if (!existingRules.has(key)) aiRules.push(rule);
        })
    );
    // 保留模板作者已有的精确规则优先级；新服务规则只补缺失项。
    model.rules = [...model.rules, ...aiRules];
}

/**
 * 模板模型智能优化器（主入口）
 * 包含：自动解析过滤器、注入地区组、展开占位符、清理无效引用及空组
 * @param {Object} model - 统一模板模型
 */
export function applySmartModelOptimizations(model) {
    const { ruleLevel } = model.meta || {};
    const normalizedLevel = (ruleLevel || '').toLowerCase();
    const isCustomOrNone = !normalizedLevel || normalizedLevel === 'none';

    // 1. 执行现有的正则过滤器解析 (始终执行)
    resolveGroupFilters(model);

    // 2. DNS 出口策略组注入：
    // 只要没用自定义 DNS（使用作者默认 Safe DNS），就保证注入 DNS 出口策略组；
    // 只要自定义配置了 DNS，就不跟随注入 DNS 出口策略组。
    const hasCustomDns = Boolean(
        model.settings?.customDnsOverride && String(model.settings.customDnsOverride).trim()
    );
    if (!hasCustomDns) {
        ensureDnsProxyGroup(model);
    }

    // 3. AI 服务分组与分流规则注入：
    // 仅在非纯自定义模板模式（启用内置分流）下才注入
    if (!isCustomOrNone) {
        ensureAiPolicy(model);
    }

    // 4. 检查等级。如果是 none (完全禁用)，我们只执行占位符展开和清理，不进行智能注入。
    if (!isCustomOrNone && normalizedLevel !== 'base') {
        // 3. 准备获取所有节点的名称，用于后续注入
        const proxyNames = model.proxies.map((p) => p.name || p.tag).filter(Boolean);
        if (proxyNames.length > 0) {
            // 4. 识别地区分组并注入
            const nodeEntries = proxyNames.map((name) => ({ tag: name }));
            const regions = groupNodeLinesByRegion(nodeEntries);

            // 注入地区自动选优组
            regions.forEach((region) => {
                if (hasEquivalentRegionGroup(model, region)) return;
                model.groups.push({
                    name: region.name,
                    type: 'url-test',
                    members: region.tags,
                    options: {
                        url: 'http://www.gstatic.com/generate_204',
                        interval: '300',
                        tolerance: '50',
                    },
                });
            });
        }
    }

    // 5. 展开魔法占位符 (始终执行，确保模板标签被替换)
    expandMagicPlaceholders(model);

    // 6. 只有在非精简模式下才执行主选择器兜底注入
    if (normalizedLevel !== 'none' && normalizedLevel !== 'base' && normalizedLevel) {
        const mainGroupCandidates = model.groups.filter((g) =>
            /选择|Proxy|Default|Global|Main|select/i.test(g.name)
        );
        if (mainGroupCandidates.length > 0) {
            const targetGroup = mainGroupCandidates[0];
            // 如果该组还没有任何成员，注入所有可用的组
            if (targetGroup.members.length === 0) {
                const availableGroups = model.groups
                    .filter(
                        (g) =>
                            g.name !== targetGroup.name &&
                            (g.type === 'url-test' || g.type === 'fallback')
                    )
                    .map((g) => g.name);
                targetGroup.members.push(...availableGroups);
            }
        }
    }

    // 7. 最后进行全局修剪与去重 (始终执行，保证输出质量)
    dedupeGroupsByName(model);
    pruneInvalidMembers(model);
    pruneEmptyGroups(model);

    return model;
}
