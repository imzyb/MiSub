/**
 * MiSub Operator Runner
 * Implements Sub-Store like operators for node transformation.
 */

import * as NodeUtils from './node-transformer.js';
import { extractNodeRegion, getRegionEmoji } from '../modules/utils/geo-utils.js';
import { matchesDslCondition, renderDslTemplate } from './expression-dsl.js';
import { runQuickJsNodeScript } from './quickjs-sandbox.js';

/**
 * 辅助函数：将规则模式规范化为正则表达式数组
 */
function normalizeRules(rules) {
    if (!rules) return [];
    if (!Array.isArray(rules)) {
        if (typeof rules === 'string') return rules.split(/\r?\n/).filter(line => line.trim() !== '');
        return [];
    }
    
    let normalized = [];
    for (const rule of rules) {
        if (typeof rule === 'string') {
            // 支持在单个算子输入中通过 | 或 换行符 传递多个子规则
            const parts = rule.split(/\r?\n/).filter(p => p.trim() !== '');
            normalized.push(...parts);
        } else if (rule && rule.pattern) {
            normalized.push(rule);
        }
    }
    return normalized;
}

/**
 * Filter Operator
 */
function opFilter(nodes, params) {
    if (!params) return nodes;
    const { include, exclude, protocols, regions } = params;
    let result = [...nodes];

    if (include?.enabled) {
        const rules = normalizeRules(include.rules);
        if (rules.length > 0) {
            result = result.filter(r => {
                const enriched = NodeUtils.ensureRegionInfo(r, true); // 强制获取元数据
                const matchRaw = NodeUtils.matchesRegexRules(r.name, rules);
                const matchClean = r.metadata?.cleanName ? NodeUtils.matchesRegexRules(r.metadata.cleanName, rules) : false;
                const matchRegion = NodeUtils.matchesRegexRules(enriched.regionZh, rules) || 
                                    NodeUtils.matchesRegexRules(enriched.region, rules) ||
                                    NodeUtils.matchesRegexRules(enriched.regionCode, rules); // [新增] ISO 代码匹配
                
                return matchRaw || matchClean || matchRegion;
            });
        }
    }
    if (exclude?.enabled) {
        const rules = normalizeRules(exclude.rules);
        if (rules.length > 0) {
            result = result.filter(r => {
                const enriched = NodeUtils.ensureRegionInfo(r, true); // 强制获取元数据
                const matchRaw = NodeUtils.matchesRegexRules(r.name, rules);
                const matchClean = r.metadata?.cleanName ? NodeUtils.matchesRegexRules(r.metadata.cleanName, rules) : false;
                const matchRegion = NodeUtils.matchesRegexRules(enriched.regionZh, rules) || 
                                    NodeUtils.matchesRegexRules(enriched.region, rules) ||
                                    NodeUtils.matchesRegexRules(enriched.regionCode, rules); // [新增] ISO 代码匹配
                                    
                return !(matchRaw || matchClean || matchRegion);
            });
        }
    }
    if (protocols?.enabled && Array.isArray(protocols.values)) {
        const allowed = new Set(protocols.values.map(p => p.toLowerCase()));
        result = result.filter(r => allowed.has(r.protocol.toLowerCase()));
    }
    if (regions?.enabled && Array.isArray(regions.values)) {
        // Ensure region info is present
        result = result.map(r => NodeUtils.ensureRegionInfo(r, true));
        const allowed = new Set(regions.values);
        result = result.filter(r => allowed.has(r.regionZh) || allowed.has(r.region));
    }
    return result;
}

/**
 * Rename Operator
 */
function opRename(nodes, params) {
    if (!params) return nodes;
    const { regex, template } = params;
    let result = [...nodes];

    if (regex?.enabled) {
        const rules = normalizeRules(regex.rules);
        if (rules.length > 0) {
            result = result.map(r => {
                const enriched = NodeUtils.ensureRegionInfo(r, true);
                const vars = {
                    name: r.name,
                    protocol: r.protocol,
                    region: enriched.region,
                    regionCode: enriched.regionCode,
                    regionZh: enriched.regionZh,
                    emoji: enriched.emoji,
                    server: r.server,
                    port: r.port
                };

                // 核心增强：允许在正则替换中使用 {regionZh} 等变量
                const processedRules = rules.map(rule => {
                    if (typeof rule === 'object' && rule.replacement && rule.replacement.includes('{')) {
                        return { ...rule, replacement: NodeUtils.renderTemplate(rule.replacement, vars, r) };
                    }
                    return rule;
                });

                const newName = NodeUtils.applyRegexRename(r.name, processedRules, r);
                if (newName !== r.name) {
                    return {
                        ...r,
                        name: newName,
                        url: NodeUtils.setNodeName(r.url, r.protocol, newName)
                    };
                }
                return r;
            });
        }
    }

    if (template?.enabled && template.template) {
        const counters = new Map();
        const scope = template.indexScope || template.scope || 'region'; // 默认按地区分组计数，符合用户直觉

        result = result.map((r, index) => {
            const enriched = NodeUtils.ensureRegionInfo(r, true);
            
            // 确定索引分组键
            let groupKey = 'global';
            if (scope === 'region') groupKey = `r:${enriched.regionZh || 'Other'}`;
            else if (scope === 'protocol') groupKey = `p:${r.protocol}`;
            else if (scope === 'regionProtocol') groupKey = `rp:${enriched.regionZh || 'Other'}|${r.protocol}`;
            
            const groupIndex = (counters.get(groupKey) || 0) + 1;
            counters.set(groupKey, groupIndex);

            const vars = {
                name: r.name,
                protocol: r.protocol,
                region: enriched.region,
                regionCode: enriched.regionCode,
                regionZh: enriched.regionZh,
                emoji: enriched.emoji,
                server: r.server,
                port: r.port,
                index: groupIndex + (Number(template.offset || template.indexStart) || 1) - 1,
                globalIndex: index + (Number(template.offset || template.indexStart) || 1)
            };
            const newName = NodeUtils.renderTemplate(template.template, vars, r);
            
            if (newName !== r.name) {
                return {
                    ...r,
                    name: newName,
                    url: NodeUtils.setNodeName(r.url, r.protocol, newName)
                };
            }
            return r;
        });
    }

    return result;
}

/**
 * Script Operator (The heart of Sub-Store)
 */
function matchesDslConditions(node, condition) {
    if (Array.isArray(condition)) {
        return condition.every(item => matchesDslCondition(node, item));
    }
    return matchesDslCondition(node, condition);
}

function matchesDslStep(node, step) {
    if (step.when && !matchesDslConditions(node, step.when)) return false;
    if (step.unless && matchesDslConditions(node, step.unless)) return false;
    return true;
}

function sortDslRecords(nodes, step) {
    const field = String(step.field || '_dslRank');
    const direction = String(step.order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    const missingLast = step.missing !== 'first';

    return nodes
        .map((node, originalIndex) => ({ node, originalIndex }))
        .sort((left, right) => {
            const a = left.node[field];
            const b = right.node[field];
            const aMissing = a === undefined || a === null || a === '';
            const bMissing = b === undefined || b === null || b === '';

            if (aMissing !== bMissing) {
                return (aMissing ? 1 : -1) * (missingLast ? 1 : -1);
            }
            if (!aMissing && !bMissing) {
                const aNumber = Number(a);
                const bNumber = Number(b);
                const bothNumeric = Number.isFinite(aNumber) && Number.isFinite(bNumber);
                const comparison = bothNumeric
                    ? aNumber - bNumber
                    : String(a).localeCompare(String(b), 'zh-CN', { numeric: true, sensitivity: 'base' });
                if (comparison !== 0) return comparison * direction;
            }
            return left.originalIndex - right.originalIndex;
        })
        .map(item => item.node);
}

async function opScript(nodes, params = {}, context) {
    const mode = params.mode || (params.code ? 'javascript' : 'rules');
    if (mode === 'javascript' && typeof params.code === 'string' && params.code.trim()) {
        try {
            const enrichedNodes = nodes.map(record => {
                const enriched = NodeUtils.ensureRegionInfo(record, true);
                return {
                    ...enriched,
                    name: enriched.name?.replace(/[·•・∙]/g, '·') || enriched.name,
                    regionzh: enriched.regionZh,
                    region_zh: enriched.regionZh
                };
            });
            const scriptedNodes = await runQuickJsNodeScript(params.code, enrichedNodes, context);
            return scriptedNodes.map(node => {
                const name = node.name || node.originalName;
                if (!name) return node;
                const nextNode = {
                    ...node,
                    name,
                    url: NodeUtils.setNodeName(node.url, node.protocol, name)
                };
                if (node.metadata) {
                    nextNode.metadata = { ...node.metadata, cleanName: name };
                }
                return nextNode;
            });
        } catch (error) {
            console.error('[Operator] Sandbox script execution failed:', error);
            return nodes;
        }
    }

    const dsl = mode === 'rules' && Array.isArray(params.dsl)
        ? params.dsl
        : (mode === 'rules' && params.action ? [params] : []);

    if (!dsl.length) {
        if (params.url) {
            console.warn('[Operator] Remote scripts are disabled; paste the code into the sandbox editor instead.');
        }
        return nodes;
    }

    let result = nodes.map(r => NodeUtils.ensureRegionInfo(r, true));

    for (const step of dsl) {
        const action = String(step?.action || '').toLowerCase();
        if (action === 'filter') {
            result = result.filter((node, index) => matchesDslCondition({ ...node, index: index + 1 }, step));
            continue;
        }
        if (action === 'rename') {
            const template = step.template || step.expression;
            if (!template) continue;
            const counters = new Map();
            result = result.map((node, index) => {
                const conditionContext = {
                    ...node,
                    globalIndex: index + 1,
                    target: context?.target || ''
                };
                if (!matchesDslStep(conditionContext, step)) return node;

                const groupKey = step.groupBy
                    ? renderDslTemplate(step.groupBy, conditionContext)
                    : 'global';
                const groupIndex = (counters.get(groupKey) || 0) + 1;
                counters.set(groupKey, groupIndex);

                const offset = Number(step.offset ?? step.indexStart ?? 1);
                const templateContext = {
                    ...conditionContext,
                    index: groupIndex + (Number.isFinite(offset) ? offset : 1) - 1
                };
                const nextName = renderDslTemplate(template, templateContext) || node.name;
                const nextNode = {
                    ...node,
                    ...(Number.isFinite(Number(step.rank)) ? { _dslRank: Number(step.rank) } : {})
                };

                if (nextName === node.name) return nextNode;
                return {
                    ...nextNode,
                    name: nextName,
                    url: NodeUtils.setNodeName(node.url, node.protocol, nextName),
                    metadata: node.metadata ? { ...node.metadata, cleanName: nextName } : node.metadata
                };
            });
            continue;
        }
        if (action === 'sort') {
            result = sortDslRecords(result, step);
        }
    }

    return result;
}

/**
 * Main Entry Point for Operator Chain
 */
export async function runOperatorChain(nodeUrls, operators, context = {}) {
    if (!Array.isArray(operators) || operators.length === 0) {
        return nodeUrls;
    }

    // 1. Convert URLs to Records
    let records = NodeUtils.nodeUrlsToRecords(nodeUrls, { 
        needServerPort: true, 
        ensureRegion: false 
    });
    const metadataByUrl = context.nodeMetadataByUrl instanceof Map
        ? context.nodeMetadataByUrl
        : new Map(Object.entries(context.nodeMetadataByUrl || {}));
    if (metadataByUrl.size > 0) {
        records = records.map(record => ({
            ...record,
            ...(metadataByUrl.get(record.url) || {})
        }));
    }

    const ua = (context.userAgent || '').toLowerCase();
    const platform = {
        isClash: /clash|mihomo|stash|meta|verge/i.test(ua),
        isSurge: /surge/i.test(ua),
        isQuanX: /quantumult/i.test(ua),
        isLoon: /loon/i.test(ua),
        isShadowrocket: /shadowrocket/i.test(ua),
        isSingBox: /sing-box|singbox/i.test(ua),
        userAgent: context.userAgent,
        target: context.target || 'base64'
    };

    const enrichedContext = { ...context, ...platform };

    // 2. Run Operators sequentially
    for (const op of operators) {
        const { type, params, enabled } = op;
        if (enabled === false) continue;

        switch (type) {
            case 'filter':
                records = opFilter(records, params);
                break;
            case 'rename':
                records = opRename(records, params);
                break;
            case 'script':
                records = await opScript(records, params, enrichedContext);
                break;
            case 'sort':
                if (params && Array.isArray(params.keys)) {
                    const needsRegion = params.keys.some(k => k.key === 'region' || k.key === 'regionZh');
                    if (needsRegion) {
                        records = records.map(r => NodeUtils.ensureRegionInfo(r, true));
                    }
                    records.sort(NodeUtils.makeComparator({ keys: params.keys }));
                }
                break;
            case 'dedup':
                const includeProtocol = params?.includeProtocol !== false;
                const seenNodes = new Map();
                for (const r of records) {
                    const hostPort = `${r.server}:${r.port}`;
                    const key = includeProtocol ? `${r.protocol}|${hostPort}` : hostPort;
                    if (!seenNodes.has(key)) {
                        seenNodes.set(key, r);
                    } else {
                        const existing = seenNodes.get(key);
                        if ((r.name || '').length > (existing.name || '').length) {
                            seenNodes.set(key, r);
                        }
                    }
                }
                records = Array.from(seenNodes.values());
                break;
        }
    }

    // 3. Convert Records back to URLs
    return NodeUtils.recordsToNodeUrls(records);
}
