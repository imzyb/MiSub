import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse } from '../utils.js';
import { parseNodeInfo } from '../utils/geo-utils.js';
import { calculateProtocolStats, calculateRegionStats } from '../utils/node-parser.js';
import { applyNodeTransformPipeline } from '../../utils/node-transformer.js';
import { KV_KEY_SUBS, KV_KEY_PROFILES } from '../config.js';
import { fetchSubscriptionNodes } from './node-fetcher.js';
import { applyManualNodeName } from '../utils/node-cleaner.js';

/**
 * 处理订阅组模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @param {string} profileId - 订阅组ID
 * @param {string} userAgent - 用户代理
 * @param {boolean} applyTransform - 是否应用节点转换规则（智能重命名、前缀等）
 * @returns {Promise<Object>} 处理结果
 */
export async function handleProfileMode(request, env, profileId, userAgent, applyTransform = false, skipCertVerify = false) {
    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));

    // 获取订阅组和所有数据
    const allProfiles = await storageAdapter.get(KV_KEY_PROFILES) || [];
    const allSubscriptions = await storageAdapter.get(KV_KEY_SUBS) || [];

    // 查找匹配的订阅组
    const profile = allProfiles.find(p => (p.customId && p.customId === profileId) || p.id === profileId);

    if (!profile || !profile.enabled) {
        return createJsonResponse({ error: '订阅组不存在或已禁用' }, 404);
    }

    // Create a map for quick lookup
    const misubMap = new Map(allSubscriptions.map(item => [item.id, item]));

    const targetMisubs = [];

    // 1. Add subscriptions in order defined by profile
    const profileSubIds = profile.subscriptions || [];
    if (Array.isArray(profileSubIds)) {
        profileSubIds.forEach(id => {
            const sub = misubMap.get(id);
            if (sub && sub.enabled && sub.url.startsWith('http')) {
                targetMisubs.push(sub);
            }
        });
    }

    // 2. Add manual nodes in order defined by profile
    const profileNodeIds = profile.manualNodes || [];
    if (Array.isArray(profileNodeIds)) {
        profileNodeIds.forEach(id => {
            const node = misubMap.get(id);
            if (node && node.enabled && !node.url.startsWith('http')) {
                targetMisubs.push(node);
            }
        });
    }

    // 分离HTTP订阅和手工节点
    const targetSubscriptions = targetMisubs.filter(item => item.url.startsWith('http'));
    const targetManualNodes = targetMisubs.filter(item => !item.url.startsWith('http'));

    // 处理手工节点（直接解析节点URL）
    // 先将用户自定义名称写入 URL（与订阅生成流程保持一致），
    // 确保 parseNodeInfo 和节点转换管道能基于正确名称工作
    const manualNodeResults = targetManualNodes.map(node => {
        const customName = typeof node.name === 'string' ? node.name.trim() : '';
        const effectiveUrl = customName ? applyManualNodeName(node.url, customName) : node.url;

        const nodeInfo = parseNodeInfo(effectiveUrl);
        return {
            subscriptionName: node.name || '手工节点',
            url: effectiveUrl,
            success: true,
            nodes: [{
                ...nodeInfo,
                url: effectiveUrl,
                subscriptionName: node.name || '手工节点'
            }],
            error: null,
            isManualNode: true
        };
    });

    // 并行获取HTTP订阅节点
    const subscriptionResults = await Promise.all(
        targetSubscriptions.map(sub => fetchSubscriptionNodes(sub.url, sub.name, userAgent, sub.customUserAgent, false, sub.exclude, sub.fetchProxy, skipCertVerify, Boolean(sub?.plusAsSpace)))
    );

    // 合并所有结果
    const allResults = [...subscriptionResults, ...manualNodeResults];

    // 统计所有节点
    const allNodes = [];
    allResults.forEach(result => {
        if (result.success) {
            allNodes.push(...result.nodes);
        }
    });

    // 如果需要应用转换规则，则处理节点名称
    let processedNodes = allNodes;
    if (applyTransform && profile.nodeTransform?.enabled) {
        // 提取节点 URL 列表
        const nodeUrls = allNodes.map(node => node.url);

        // 应用节点转换管道
        // 使用默认模板 '{emoji}{region}-{protocol}-{index}'，如果用户未自定义模板
        const defaultTemplate = '{emoji}{region}-{protocol}-{index}';
        const effectiveTemplate = profile.nodeTransform.rename?.template?.template || defaultTemplate;
        const transformedUrls = applyNodeTransformPipeline(nodeUrls, {
            ...profile.nodeTransform,
            enableEmoji: effectiveTemplate.includes('{emoji}')
        });

        // 重要修复：由于节点转换管道可能会重新排序节点，
        // 不能用原始索引匹配转换后的 URL，必须从转换后的 URL 重新解析所有节点信息
        processedNodes = transformedUrls.map(transformedUrl => {
            const nodeInfo = parseNodeInfo(transformedUrl);
            // 尝试找到原始节点以保留 subscriptionName
            const originalNode = allNodes.find(n => {
                // 通过 URL 的核心部分（服务器和端口）进行匹配
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
                subscriptionName: originalNode?.subscriptionName || nodeInfo.subscriptionName || '未知'
            };
        });
    }

    // 生成统计信息（使用处理后的节点）
    const protocolStats = calculateProtocolStats(processedNodes);
    const regionStats = calculateRegionStats(processedNodes);

    return {
        success: true,
        subscriptions: allResults,
        nodes: processedNodes,
        totalCount: processedNodes.length,
        stats: {
            protocols: protocolStats,
            regions: regionStats
        }
    };
}
