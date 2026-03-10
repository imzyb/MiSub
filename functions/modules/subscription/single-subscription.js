import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse } from '../utils.js';
import { parseNodeInfo } from '../utils/geo-utils.js';
import { calculateProtocolStats, calculateRegionStats } from '../utils/node-parser.js';
import { KV_KEY_SUBS } from '../config.js';
import { fetchSubscriptionNodes } from './node-fetcher.js';

/**
 * 处理单个订阅模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @param {string} subscriptionId - 订阅ID
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Object>} 处理结果
 */
export async function handleSingleSubscriptionMode(request, env, subscriptionId, userAgent) {
    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));

    // 查找订阅
    const allSubscriptions = await storageAdapter.get(KV_KEY_SUBS) || [];
    const subscription = allSubscriptions.find(sub => sub.id === subscriptionId);

    if (!subscription || !subscription.enabled) {
        return createJsonResponse({ error: '订阅不存在或已禁用' }, 404);
    }

    // 检查是否为手工节点
    if (!subscription.url.startsWith('http')) {
        // 手工节点：直接解析节点URL
        const nodeInfo = parseNodeInfo(subscription.url);
        const manualNodeResult = {
            subscriptionName: subscription.name || '手工节点',
            url: subscription.url,
            success: true,
            nodes: [{
                ...nodeInfo,
                subscriptionName: subscription.name || '手工节点'
            }],
            error: null,
            isManualNode: true
        };

        return {
            success: true,
            subscriptions: [manualNodeResult],
            nodes: manualNodeResult.nodes,
            totalCount: manualNodeResult.nodes.length,
            stats: {
                protocols: { [nodeInfo.protocol]: 1 },
                regions: { [nodeInfo.region || '其他']: 1 }
            }
        };
    }

    // HTTP订阅：获取节点
    const result = await fetchSubscriptionNodes(subscription.url, subscription.name, userAgent, subscription.customUserAgent, false, subscription.exclude, subscription.fetchProxy);

    return {
        success: true,
        subscriptions: [result],
        nodes: result.nodes,
        totalCount: result.nodes.length,
        stats: {
            protocols: calculateProtocolStats(result.nodes),
            regions: calculateRegionStats(result.nodes)
        }
    };
}

/**
 * 处理直接URL模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {string} subscriptionUrl - 订阅URL
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Object>} 处理结果
 */
export async function handleDirectUrlMode(subscriptionUrl, userAgent) {
    const debug = subscriptionUrl.includes('b0b422857bb46aba65da8234c84f38c6');
    const result = await fetchSubscriptionNodes(subscriptionUrl, '预览订阅', userAgent, null, debug, '');

    return {
        success: true,
        subscriptions: [result],
        nodes: result.nodes,
        totalCount: result.nodes.length,
        stats: {
            protocols: calculateProtocolStats(result.nodes),
            regions: calculateRegionStats(result.nodes)
        }
    };
}
