import { groupNodeLinesByRegion } from './region-groups.js';

/**
 * 解析并扩展策略组中的正则过滤器
 * @param {Object} model - 统一模板模型
 */
function resolveGroupFilters(model) {
    const proxyNames = model.proxies.map(p => p.name || p.tag).filter(Boolean);
    if (proxyNames.length === 0) return;

    model.groups.forEach(group => {
        if (!Array.isArray(group.filters) || group.filters.length === 0) return;

        group.members = group.members || [];
        const currentMembers = new Set(group.members);

        group.filters.forEach(filter => {
            if (filter === '.*') {
                proxyNames.forEach(name => currentMembers.add(name));
                return;
            }

            try {
                const regex = new RegExp(filter, 'i');
                proxyNames.forEach(name => {
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
                .filter(g => (!Array.isArray(g.members) || g.members.length === 0))
                .map(g => g.name)
        );

        if (emptyGroupNames.size === 0) break;

        // 1. 移除空组本身
        const initialCount = model.groups.length;
        model.groups = model.groups.filter(g => !emptyGroupNames.has(g.name));
        if (model.groups.length !== initialCount) changed = true;

        // 2. 从其它组的成员列表中移除对空组的引用
        model.groups.forEach(group => {
            if (Array.isArray(group.members)) {
                const newMembers = group.members.filter(m => !emptyGroupNames.has(m));
                if (newMembers.length !== group.members.length) {
                    group.members = newMembers;
                    changed = true;
                }
            }
        });

        // 3. 从规则列表中移除指向空组的规则
        const initialRuleCount = model.rules.length;
        model.rules = model.rules.filter(rule => !emptyGroupNames.has(rule.policy));
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

    return model.groups.some(group => {
        const normalizedGroupName = normalizeGroupSemanticName(group.name);
        if (normalizedGroupName === normalizedRegionName) return true;

        const members = Array.isArray(group.members) ? group.members : [];
        if (members.length === 0) return false;

        const overlapCount = members.filter(member => regionTags.has(member)).length;
        return overlapCount > 0 && overlapCount === members.length && overlapCount === regionTags.size;
    });
}

function dedupeGroupsByName(model) {
    const mergedGroups = [];
    const seen = new Map();

    model.groups.forEach(group => {
        const name = String(group.name || '').trim();
        if (!name) return;

        if (!seen.has(name)) {
            const normalized = {
                ...group,
                name,
                members: Array.isArray(group.members) ? Array.from(new Set(group.members.filter(Boolean))) : [],
                filters: Array.isArray(group.filters) ? Array.from(new Set(group.filters.filter(Boolean))) : [],
                options: typeof group.options === 'object' && group.options !== null ? { ...group.options } : {}
            };
            seen.set(name, normalized);
            mergedGroups.push(normalized);
            return;
        }

        const existing = seen.get(name);
        existing.members = Array.from(new Set([...(existing.members || []), ...((group.members || []).filter(Boolean))]));
        existing.filters = Array.from(new Set([...(existing.filters || []), ...((group.filters || []).filter(Boolean))]));
        existing.options = {
            ...(existing.options || {}),
            ...((typeof group.options === 'object' && group.options !== null) ? group.options : {})
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
    const regionNames = Array.from(new Set(
        model.groups
            .filter(g => g.type === 'url-test' && !g.name.includes('自动'))
            .map(g => g.name)
    ));
    
    // 获取协议分组（如果存在）
    const protocolNames = Array.from(new Set(
        model.groups
            .filter(g => g.name.includes('节点') && !regionNames.includes(g.name))
            .map(g => g.name)
    ));

    model.groups.forEach(group => {
        if (!Array.isArray(group.members)) return;

        const newMembers = [];
        group.members.forEach(member => {
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
        ...model.proxies.map(p => p.name || p.tag),
        ...model.groups.map(g => g.name),
        'DIRECT', 'REJECT'
    ]);

    model.groups.forEach(group => {
        if (Array.isArray(group.members)) {
            group.members = group.members.filter(m => validTargetNames.has(m));
        }
    });
}

/**
 * 模板模型智能优化器（主入口）
 * 包含：自动解析过滤器、注入地区组、展开占位符、清理无效引用及空组
 * @param {Object} model - 统一模板模型
 */
export function applySmartModelOptimizations(model) {
    const { ruleLevel } = model.meta;
    
    // 1. 执行现有的正则过滤器解析
    resolveGroupFilters(model);

    // 2. 如果等级为 none (完全禁用) 或 base (精简版)，则执行完基础解析和修剪后即可返回
    const normalizedLevel = (ruleLevel || '').toLowerCase();
    if (normalizedLevel === 'none' || normalizedLevel === 'base' || !normalizedLevel) {
        pruneEmptyGroups(model);
        return model;
    }

    // 3. 准备获取所有节点的名称，用于后续注入
    const proxyNames = model.proxies.map(p => p.name || p.tag).filter(Boolean);
    if (proxyNames.length === 0) {
        pruneEmptyGroups(model);
        return model;
    }

    // 4. 识别地区分组并注入（如果模板中没有对应名称的组）
    const nodeEntries = proxyNames.map(name => ({ tag: name }));
    const regions = groupNodeLinesByRegion(nodeEntries);
    
    // 注入地区自动选优组
    regions.forEach(region => {
        if (hasEquivalentRegionGroup(model, region)) return;
        model.groups.push({
            name: region.name,
            type: 'url-test',
            members: region.tags,
            options: {
                url: 'http://www.gstatic.com/generate_204',
                interval: '300',
                tolerance: '50'
            }
        });
    });

    // 5. 展开魔法占位符
    expandMagicPlaceholders(model);

    // 6. 寻找目标“主选择器”进行手动注入兜底（如果模板里一个占位符都没写）
    const mainGroupCandidates = model.groups.filter(g => 
        /选择|Proxy|Default|Global|Main|select/i.test(g.name)
    );
    if (mainGroupCandidates.length > 0) {
        const targetGroup = mainGroupCandidates[0];
        // 如果该组还没有任何成员，注入所有地区作为兜底
        if (targetGroup.members.length === 0) {
            targetGroup.members.push(...regions.map(r => r.name));
        }
    }

    // 7. 最后进行全局修剪与去重
    dedupeGroupsByName(model);
    pruneInvalidMembers(model); // 清理无效引用
    pruneEmptyGroups(model);    // 递归清理最终可能产生的新空组

    return model;
}
