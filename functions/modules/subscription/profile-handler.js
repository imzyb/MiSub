import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse } from '../utils.js';
import { parseNodeInfo } from '../utils/geo-utils.js';
import {
    calculateProtocolStats,
    calculateRegionStats,
    parseNodeList,
} from '../utils/node-parser.js';
import { applyNodeTransformPipeline } from '../../utils/node-transformer.js';
import { runOperatorChain } from '../../utils/operator-runner.js';
import { KV_KEY_SUBS, KV_KEY_PROFILES, KV_KEY_SETTINGS, DEFAULT_SETTINGS } from '../config.js';
import { fetchSubscriptionNodes } from './node-fetcher.js';
import {
    ensureSnapshotForOutput,
    getNodeSnapshotForOutput,
    isNodePersistenceEnabled,
    maybeRefreshDueNodes,
} from '../../services/node-persistence-service.js';
import { applyManualNodeName } from '../utils/node-cleaner.js';

function ensureArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function adaptLegacyTransform(config) {
    if (!config || !config.enabled) return [];

    const ops = [];
    const filter = config.filter;
    if (
        filter &&
        (filter.include?.enabled ||
            filter.exclude?.enabled ||
            filter.protocols?.enabled ||
            filter.regions?.enabled ||
            filter.script?.enabled ||
            filter.useless?.enabled)
    ) {
        ops.push({ id: 'legacy-filter', type: 'filter', enabled: true, params: { ...filter } });
    }

    const regex = config.rename?.regex;
    if (regex?.enabled && regex.rules?.length > 0) {
        ops.push({
            id: 'legacy-rename-regex',
            type: 'rename',
            enabled: true,
            params: { regex: { ...regex } },
        });
    }

    const template = config.rename?.template;
    if (template?.enabled) {
        ops.push({
            id: 'legacy-rename-template',
            type: 'rename',
            enabled: true,
            params: {
                template: {
                    enabled: true,
                    template: template.template || '{emoji}{region}-{protocol}-{index}',
                    offset: template.indexStart || 1,
                    indexScope: template.indexScope || 'region',
                },
            },
        });
    }

    const renameScript = config.rename?.script;
    if (renameScript?.enabled && renameScript.expression) {
        ops.push({
            id: 'legacy-rename-script',
            type: 'script',
            enabled: true,
            params: { dsl: [{ action: 'rename', template: renameScript.expression }] },
        });
    }

    const dedup = config.dedup;
    if (dedup?.enabled) {
        ops.push({ id: 'legacy-dedup', type: 'dedup', enabled: true, params: { ...dedup } });
    }

    const sort = config.sort;
    if (sort?.enabled && sort.keys?.length > 0) {
        ops.push({ id: 'legacy-sort', type: 'sort', enabled: true, params: { ...sort } });
    }

    return ops;
}

/**
 * 处理订阅组模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @param {string} profileId - 订阅组ID
 * @param {string} userAgent - 用户代理
 * @param {boolean} applyTransform - 是否应用节点转换规则（智能重命名、前缀等）
 * @returns {Promise<Object>} 处理结果
 */
export async function handleProfileMode(
    request,
    env,
    profileId,
    userAgent,
    applyTransform = false,
    skipCertVerify = false,
    depth = 0,
    visited = new Set(),
    context = null
) {
    if (depth > 3 || (profileId && visited.has(profileId))) {
        console.warn(
            `[Profile Nesting] 触发深度超限或循环引用保护: profileId=${profileId}, depth=${depth}`
        );
        return {
            success: false,
            subscriptions: [],
            nodes: [],
            totalCount: 0,
            stats: { protocols: {}, regions: {} },
            error: '循环引用或嵌套层级过深',
        };
    }

    const storageAdapter = StorageFactory.createAdapter(
        env,
        await StorageFactory.getStorageType(env)
    );

    const profile =
        typeof storageAdapter.getProfileById === 'function'
            ? await storageAdapter.getProfileById(profileId)
            : ((await storageAdapter.get(KV_KEY_PROFILES)) || []).find(
                  (p) => p.id === profileId || p.customId === profileId || p.linkId === profileId
              );
    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || DEFAULT_SETTINGS;

    if (!profile || !profile.enabled) {
        return createJsonResponse({ error: '订阅组不存在或已禁用' }, 404);
    }

    const relatedIds = [
        ...(Array.isArray(profile.subscriptions)
            ? profile.subscriptions.map((item) => (typeof item === 'object' ? item.id : item))
            : []),
        ...(Array.isArray(profile.manualNodes) ? profile.manualNodes : []),
    ].filter(Boolean);
    const relatedSubs =
        typeof storageAdapter.getSubscriptionsByIds === 'function'
            ? await storageAdapter.getSubscriptionsByIds(Array.from(new Set(relatedIds)))
            : (await storageAdapter.get(KV_KEY_SUBS)) || [];
    const misubMap = new Map(relatedSubs.map((item) => [item.id, item]));

    const targetMisubs = [];
    const profileSubIds = (profile.subscriptions || []).map((item) =>
        typeof item === 'object' ? item.id : item
    );
    profileSubIds.forEach((id) => {
        const sub = misubMap.get(id);
        if (sub && sub.enabled && /^https?:\/\//i.test(sub.url)) {
            targetMisubs.push(sub);
        }
    });

    const targetManualNodes = [];
    const profileNodeIds = profile.manualNodes || [];
    if (Array.isArray(profileNodeIds)) {
        profileNodeIds.forEach((id) => {
            const node = misubMap.get(id);
            if (node && node.enabled) targetManualNodes.push(node);
        });
    }

    const httpProxyPattern = /^https?:\/\/[^/?#]+:\d+(?:[/?#]|$)/i;
    const targetSubscriptions = targetMisubs.filter((sub) => !httpProxyPattern.test(sub.url));
    const httpProxyNodes = targetMisubs.filter((sub) => httpProxyPattern.test(sub.url));
    const seenManualIds = new Set();
    const allManualNodes = [];
    for (const node of [...httpProxyNodes, ...targetManualNodes]) {
        const key = node?.id || node?.url;
        if (!node || (key && seenManualIds.has(key))) continue;
        if (key) seenManualIds.add(key);
        allManualNodes.push(node);
    }
    // 处理手工节点（直接解析节点URL），并将用户自定义名称写入 URL。
    const manualNodeResults = allManualNodes.map((node) => {
        const customName = typeof node.name === 'string' ? node.name.trim() : '';
        const effectiveUrl = customName ? applyManualNodeName(node.url, customName) : node.url;

        const nodeInfo = parseNodeInfo(effectiveUrl);
        return {
            subscriptionName: node.name || '手工节点',
            group: node.group || '',
            url: effectiveUrl,
            success: true,
            nodes: [
                {
                    ...nodeInfo,
                    url: effectiveUrl,
                    subscriptionName: node.name || '手工节点',
                    group: node.group || '',
                },
            ],
            error: null,
            isManualNode: true,
        };
    });

    // 预览/嵌套订阅也是一次后端命中：顺便做一次到期检查（后台执行，不阻塞预览）。
    // 预览同样是一次后端命中：有 waitUntil 就真正后台刷新，没有也绝不阻塞预览。
    if (isNodePersistenceEnabled(env, settings) && Array.isArray(targetSubscriptions)) {
        const previewContext = { ...(context || {}), env, config: settings };
        const dueRun = maybeRefreshDueNodes(previewContext, targetSubscriptions, {
            reason: 'preview',
        }).catch((error) =>
            console.warn('[NodePersistence] preview due refresh failed:', error?.message || error)
        );
        if (typeof previewContext.waitUntil === 'function') previewContext.waitUntil(dueRun);
        else void dueRun;
    }

    // 并行获取HTTP订阅节点。
    // D1 节点持久化开启时只读快照，绝不回源机场；否则走实时拉取（失败时回退保护性缓存）。
    const persistenceEnabled = isNodePersistenceEnabled(env, settings);
    // 单次请求最多为 3 个「还没有快照」的机场做懒初始化，避免首访超时；
    // 剩下的会在下一次访问时继续补齐。
    let lazyBudget = 3;
    const subscriptionResults = await Promise.all(
        targetSubscriptions.map(async (sub) => {
            if (persistenceEnabled) {
                const budget = Number.isFinite(lazyBudget) ? lazyBudget : 3;
                let snapshot = await getNodeSnapshotForOutput(env, sub);
                const needsRefresh = !snapshot || snapshot.fingerprintMatches === false;
                if (needsRefresh && budget > 0) {
                    lazyBudget = budget - 1;
                    snapshot = await ensureSnapshotForOutput(env, sub, { reason: 'preview' });
                }
                if (!snapshot) {
                    return {
                        subscriptionName: sub.name,
                        url: sub.url,
                        success: true,
                        nodes: [],
                        error: null,
                        fromPersistence: true,
                    };
                }
                const parsedNodes = parseNodeList(snapshot.nodes.join('\n'), {
                    plusAsSpace: Boolean(sub?.plusAsSpace),
                });
                return {
                    subscriptionName: sub.name,
                    url: sub.url,
                    success: true,
                    nodes: parsedNodes,
                    error: null,
                    fromPersistence: true,
                    cacheUpdatedAt: snapshot.lastSuccessAt,
                };
            }
            return fetchSubscriptionNodes(
                sub.url,
                sub.name,
                userAgent,
                sub.customUserAgent,
                false,
                sub.exclude,
                sub.fetchProxy,
                skipCertVerify,
                Boolean(sub?.plusAsSpace),
                sub?.enableNodeCache === true,
                storageAdapter,
                sub
            );
        })
    );

    // 3. 处理嵌套的组合订阅 (Sub-Profiles)
    const profileSubProfileIds = profile.subProfiles || [];
    const nestedSubProfileResults = [];
    if (Array.isArray(profileSubProfileIds) && profileSubProfileIds.length > 0 && depth < 3) {
        const nextVisited = new Set(visited);
        if (profile.id) nextVisited.add(profile.id);
        if (profile.customId) nextVisited.add(profile.customId);

        for (const subProfileId of profileSubProfileIds) {
            if (!subProfileId || nextVisited.has(subProfileId)) {
                console.warn(`[Profile Nesting] 跳过循环引用或空子订阅组: ${subProfileId}`);
                continue;
            }
            try {
                const subResult = await handleProfileMode(
                    request,
                    env,
                    subProfileId,
                    userAgent,
                    true, // 应用子订阅自身的算子与清洗规则
                    skipCertVerify,
                    depth + 1,
                    nextVisited
                );
                if (subResult.success && Array.isArray(subResult.nodes)) {
                    nestedSubProfileResults.push({
                        subscriptionName: subResult.profileName || '组合订阅',
                        group: subResult.profileName || '组合订阅',
                        url: `profile://${subProfileId}`,
                        success: true,
                        nodes: subResult.nodes,
                        error: null,
                        isSubProfile: true,
                    });
                }
            } catch (err) {
                console.error(`[Profile Nesting] 拉取子订阅组异常 ${subProfileId}:`, err);
            }
        }
    }

    // 合并所有结果
    const allResults = [...subscriptionResults, ...manualNodeResults, ...nestedSubProfileResults];

    // 统计所有节点
    const allNodes = [];
    allResults.forEach((result) => {
        if (result.success) {
            allNodes.push(...result.nodes);
        }
    });

    // 如果需要应用转换规则，则处理节点名称
    let processedNodes = allNodes;
    const presetNodeTransform = profile.nodeTransformPresetId
        ? Array.isArray(settings.nodeTransformPresets)
            ? settings.nodeTransformPresets.find(
                  (item) => item?.id === profile.nodeTransformPresetId
              )?.config
            : null
        : null;
    const effectiveNodeTransform = profile.nodeTransform?.enabled
        ? profile.nodeTransform
        : presetNodeTransform;

    if (applyTransform) {
        const nodeUrls = allNodes.map((node) => node.url);
        const nodeMetadataByUrl = new Map(
            allNodes.map((node) => [node.url, { group: node.group || '' }])
        );

        let activeOperators = ensureArray(profile?.operators);
        if (
            !activeOperators.length &&
            profile?.nodeTransform?.enabled &&
            profile.nodeTransform?.operators
        ) {
            activeOperators = ensureArray(profile.nodeTransform.operators);
        }
        if (!activeOperators.length && settings?.defaultOperators) {
            activeOperators = ensureArray(settings.defaultOperators);
        }
        if (!activeOperators.length && effectiveNodeTransform?.enabled) {
            activeOperators = adaptLegacyTransform({
                ...effectiveNodeTransform,
                enableEmoji: settings.enableFlagEmoji !== false,
            });
        }

        let transformedUrls = nodeUrls;
        if (activeOperators.length > 0) {
            transformedUrls = await runOperatorChain(nodeUrls, activeOperators, {
                subName: profile?.name,
                userAgent,
                config: settings,
                nodeMetadataByUrl,
            });
        } else if (effectiveNodeTransform?.enabled) {
            const defaultTemplate = '{emoji}{region}-{protocol}-{index}';
            const effectiveTemplate =
                effectiveNodeTransform.rename?.template?.template || defaultTemplate;
            transformedUrls = applyNodeTransformPipeline(nodeUrls, {
                ...effectiveNodeTransform,
                enableEmoji:
                    settings.enableFlagEmoji !== false && effectiveTemplate.includes('{emoji}'),
            });
        }

        processedNodes = transformedUrls.map((transformedUrl) => {
            const nodeInfo = parseNodeInfo(transformedUrl);
            const originalNode = allNodes.find((n) => {
                try {
                    const origUrl = new URL(n.url);
                    const transUrl = new URL(transformedUrl);
                    return origUrl.hostname === transUrl.hostname && origUrl.port === transUrl.port;
                } catch {
                    return false;
                }
            });
            return {
                ...nodeInfo,
                subscriptionName:
                    originalNode?.subscriptionName || nodeInfo.subscriptionName || '未知',
            };
        });
    }

    // 生成统计信息（使用处理后的节点）
    const protocolStats = calculateProtocolStats(processedNodes);
    const regionStats = calculateRegionStats(processedNodes);

    return {
        success: true,
        profileName: profile.name || '',
        subscriptions: allResults,
        nodes: processedNodes,
        totalCount: processedNodes.length,
        // 预览来源：persistence=读 D1 快照；live=本次实时拉取
        nodeSource: persistenceEnabled ? 'persistence' : 'live',
        stats: {
            protocols: protocolStats,
            regions: regionStats,
        },
    };
}
