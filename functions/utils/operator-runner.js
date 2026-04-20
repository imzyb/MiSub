/**
 * MiSub Operator Runner
 * Implements Sub-Store like operators for node transformation.
 */

import * as NodeUtils from './node-transformer.js';
import { extractNodeRegion, getRegionEmoji } from '../modules/utils/geo-utils.js';

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

                const newName = NodeUtils.applyRegexRename(r.name, processedRules);
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
async function opScript(nodes, params, context) {
    const { code, url } = params;
    let scriptCode = code;

    if (url) {
        try {
             // In Cloudflare Workers, we use fetch
            const response = await fetch(url);
            if (response.ok) {
                scriptCode = await response.text();
            } else {
                console.warn(`[Operator] Failed to fetch remote script from ${url}: ${response.status}`);
            }
        } catch (e) {
            console.error('[Operator] Script fetch error:', e);
        }
    }

    if (!scriptCode) return nodes;

    try {
        // [审计增强] 脚本执行前自动补全地理元数据
        const enrichedNodes = nodes.map(r => NodeUtils.ensureRegionInfo(r, true));
        
        const scriptEnv = {
            $proxies: enrichedNodes,
            $context: context,
            $utils: {
                decodeBase64: s => atob(s),
                encodeBase64: s => btoa(s),
                decodeURI: s => decodeURI(s),
                encodeURI: s => encodeURI(s),
                decodeURIComponent: s => decodeURIComponent(s),
                encodeURIComponent: s => encodeURIComponent(s),
                jsonStringify: o => JSON.stringify(o),
                jsonParse: s => JSON.parse(s),
                getHost: url => { try { return new URL(url).hostname; } catch(e) { return ''; } }
            }
        };

        // 智能包装与容错
        let finalScript = scriptCode.trim();
        if (!finalScript.includes('function operator') && !finalScript.includes('const operator')) {
            finalScript = `async function operator($proxies, $context) { \n ${finalScript} \n }`;
        } else {
            const openBraces = (finalScript.match(/\{/g) || []).length;
            const closeBraces = (finalScript.match(/\}/g) || []).length;
            if (openBraces > closeBraces) {
                finalScript += '\n'.repeat(openBraces - closeBraces) + '}'.repeat(openBraces - closeBraces);
            }
        }

        // 尝试使用更兼容的 Function 构造器，并减少包装复杂度
        let runner;
        try {
            runner = new Function('$proxies', '$context', '$utils', `
                const operator = async ($proxies, $context) => {
                    ${finalScript}
                    if (typeof operator === 'function') return await operator($proxies, $context);
                    return $proxies;
                };
                return operator($proxies, $context);
            `);
        } catch (e) {
            // 如果 Function 被彻底封死，我们尝试最后的 eval 降级
            console.warn('[Operator] Function constructor blocked, trying eval fallback');
            runner = ($proxies, $context, $utils) => {
                return (async () => {
                    // 这里是一个非常激进的尝试
                    const fn = eval(`(async ($proxies, $context) => { ${finalScript}; return await operator($proxies, $context); })`);
                    return await fn($proxies, $context);
                })();
            };
        }

        const processedNodes = enrichedNodes.map(n => {
            if (n.name) n.name = n.name.replace(/[·•・∙]/g, '·');
            n.regionzh = n.regionZh;
            n.region_zh = n.regionZh;
            return n;
        });

        // 执行脚本
        const result = await runner(processedNodes, context, scriptEnv.$utils);
        
        // 核心修复：彻底信任脚本返回的结果，并强制同步到 URL
        if (Array.isArray(result) && result.length > 0) {
            return result.map((n) => {
                // 脚本可能返回 Proxy 对象，我们需要提取原始数据
                const target = n.__target || n;
                const newName = n.name || target.name;
                
                if (newName) {
                    target.name = newName;
                    // 只要名字和初始状态不一致，就强制同步 URL
                    if (target.name !== target.originalName) {
                        target.url = NodeUtils.setNodeName(target.url, target.protocol, target.name);
                        if (target.metadata) target.metadata.cleanName = target.name;
                    }
                }
                return target;
            });
        }
        return nodes;
    } catch (e) {
        console.error('[Operator] Script execution failed:', e);
        return nodes;
    }
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
