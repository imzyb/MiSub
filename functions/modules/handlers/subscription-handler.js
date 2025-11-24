/**
 * 订阅处理器模块
 * 处理订阅节点获取、订阅组预览等复杂订阅逻辑
 */

import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse } from '../utils.js';
import { extractNodeRegion, parseNodeInfo } from '../utils/geo-utils.js';
import { parseNodeList, calculateProtocolStats, calculateRegionStats } from '../utils/node-parser.js';

/**
 * 常量定义
 */
const KV_KEY_SUBS = 'misub_subscriptions_v1';
const KV_KEY_PROFILES = 'misub_profiles_v1';

/**
 * 处理订阅组模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @param {string} profileId - 订阅组ID
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Object>} 处理结果
 */
async function handleProfileMode(request, env, profileId, userAgent) {
    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));

    // 获取订阅组和所有数据
    const allProfiles = await storageAdapter.get(KV_KEY_PROFILES) || [];
    const allSubscriptions = await storageAdapter.get(KV_KEY_SUBS) || [];

    // 查找匹配的订阅组
    const profile = allProfiles.find(p => (p.customId && p.customId === profileId) || p.id === profileId);

    if (!profile || !profile.enabled) {
        return createJsonResponse({ error: '订阅组不存在或已禁用' }, 404);
    }

    const profileSubIds = new Set(profile.subscriptions || []);
    const profileNodeIds = new Set(profile.manualNodes || []);

    // 过滤属于当前订阅组且已启用的项目
    const targetMisubs = allSubscriptions.filter(item => {
        const isSubscription = item.url && item.url.startsWith('http');
        const isManualNode = !isSubscription;

        const belongsToProfile = (isSubscription && profileSubIds.has(item.id)) ||
                                 (isManualNode && profileNodeIds.has(item.id));

        return item.enabled && belongsToProfile;
    });

    // 分离HTTP订阅和手工节点
    const targetSubscriptions = targetMisubs.filter(item => item.url.startsWith('http'));
    const targetManualNodes = targetMisubs.filter(item => !item.url.startsWith('http'));

    // 处理手工节点（直接解析节点URL）
    const manualNodeResults = targetManualNodes.map(node => {
        const nodeInfo = parseNodeInfo(node.url);
        return {
            subscriptionName: node.name || '手工节点',
            url: node.url,
            success: true,
            nodes: [{
                ...nodeInfo,
                subscriptionName: node.name || '手工节点'
            }],
            error: null,
            isManualNode: true
        };
    });

    // 并行获取HTTP订阅节点
    const subscriptionResults = await Promise.all(
        targetSubscriptions.map(sub => fetchSubscriptionNodes(sub.url, sub.name, userAgent))
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

    // 生成统计信息
    const protocolStats = calculateProtocolStats(allNodes);
    const regionStats = calculateRegionStats(allNodes);

    return {
        success: true,
        subscriptions: allResults,
        nodes: allNodes,
        totalCount: allNodes.length,
        stats: {
            protocols: protocolStats,
            regions: regionStats
        }
    };
}

/**
 * 处理单个订阅模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对��
 * @param {string} subscriptionId - 订阅ID
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Object>} 处理结果
 */
async function handleSingleSubscriptionMode(request, env, subscriptionId, userAgent) {
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
    const result = await fetchSubscriptionNodes(subscription.url, subscription.name, userAgent);

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
async function handleDirectUrlMode(subscriptionUrl, userAgent) {
    const result = await fetchSubscriptionNodes(subscriptionUrl, '预览订阅', userAgent);

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
 * 获取单个订阅的节点
 * @param {string} url - 订阅URL
 * @param {string} subscriptionName - 订阅名称
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Object>} 节点获取结果
 */
async function fetchSubscriptionNodes(url, subscriptionName, userAgent) {
    try {
        const response = await fetch(new Request(url, {
            headers: { 'User-Agent': userAgent },
            redirect: "follow",
            cf: { insecureSkipVerify: true }
        }));

        if (!response.ok) {
            return {
                subscriptionName,
                url,
                success: false,
                nodes: [],
                error: `HTTP ${response.status}: ${response.statusText}`
            };
        }

        let text = await response.text();

        console.log(`[DEBUG] Preview API: Raw text length: ${text.length}`);
        console.log(`[DEBUG] Preview API: Raw text preview:`, text.substring(0, 200) + '...');

        // 智能内容类型检测和Base64解码
        const processedText = decodeAndProcessContent(text);

        console.log(`[DEBUG] Preview API: Processed text length: ${processedText.length}`);
        console.log(`[DEBUG] Preview API: Content changed after processing: ${processedText !== text}`);

        // 解析节点列表
        const parsedNodes = parseNodeList(processedText);

        console.log(`[DEBUG] Preview API: Final node count: ${parsedNodes.length}`);

        return {
            subscriptionName,
            url,
            success: true,
            nodes: parsedNodes,
            error: null
        };
    } catch (e) {
        return {
            subscriptionName,
            url,
            success: false,
            nodes: [],
            error: e.message
        };
    }
}

/**
 * 解码和处理内容
 * @param {string} text - 原始文本内容
 * @returns {string} 处理后的文本内容
 */
function decodeAndProcessContent(text) {
    try {
        // 清理空白字符
        const cleanedText = text.replace(/\s/g, '');

        // 简单的Base64检测
        const base64Regex = /^[A-Za-z0-9+\/=]+$/;
        if (!base64Regex.test(cleanedText) || cleanedText.length < 20) {
            return text;
        }

        // 尝试Base64解码
        const binaryString = atob(cleanedText);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const decodedText = new TextDecoder('utf-8').decode(bytes);
        return decodedText;
    } catch (e) {
        // 解码失败，返回原始内容
        return text;
    }
}

/**
 * 确定请求模式
 * @param {Object} requestData - 请求数据
 * @returns {string} 请求模式
 */
export function determineRequestMode(requestData) {
    if (requestData.profileId) {
        return 'profile';
    } else if (requestData.subscriptionId) {
        return 'subscription';
    } else if (requestData.url) {
        return 'direct';
    }
    return 'unknown';
}

/**
 * 处理订阅节点请求的主要入口
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleSubscriptionNodesRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await request.json();
        const {
            url: subscriptionUrl,
            subscriptionId,
            profileId,
            userAgent = 'MiSub-Node-Preview/1.0'
        } = requestData;

        // 验证必需参数
        if (!subscriptionUrl && !subscriptionId && !profileId) {
            return createJsonResponse({
                error: '请提供订阅URL、订阅ID或订阅组ID'
            }, 400);
        }

        // 根据参数确定请求模式
        const mode = determineRequestMode(requestData);

        let result;
        switch (mode) {
            case 'profile':
                result = await handleProfileMode(request, env, profileId, userAgent);
                break;
            case 'subscription':
                result = await handleSingleSubscriptionMode(request, env, subscriptionId, userAgent);
                break;
            case 'direct':
                result = await handleDirectUrlMode(subscriptionUrl, userAgent);
                break;
            default:
                return createJsonResponse({
                    error: '无效的请求参数'
                }, 400);
        }

        return createJsonResponse(result);
    } catch (e) {
        return createJsonResponse({
            error: `获取节点列表失败: ${e.message}`
        }, 500);
    }
}