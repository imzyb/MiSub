/**
 * 节点处理器模块
 * 处理节点数量统计、批量更新等节点相关API请求
 */

import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse } from '../utils.js';
import { parseNodeList } from '../utils/node-parser.js';

// 创建用于全局匹配的协议正则表达式
const NODE_PROTOCOL_GLOBAL_REGEX = new RegExp('^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5):\\/\\/', 'gm');

/**
 * 获取订阅节点数量和用户信息
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleNodeCountRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const { url: subUrl } = await request.json();
        if (!subUrl || typeof subUrl !== 'string' || !/^https?:\/\//.test(subUrl)) {
            return createJsonResponse({ error: 'Invalid or missing url' }, 400);
        }

        const result = { count: 0, userInfo: null };

        try {
            // 使用统一的User-Agent策略
            const fetchOptions = {
                headers: { 'User-Agent': 'v2rayN/7.23' },
                redirect: "follow",
                cf: { insecureSkipVerify: true }
            };
            const trafficFetchOptions = {
                headers: { 'User-Agent': 'clash-verge/v2.4.3' },
                redirect: "follow",
                cf: { insecureSkipVerify: true }
            };

            const trafficRequest = fetch(new Request(subUrl, trafficFetchOptions));
            const nodeCountRequest = fetch(new Request(subUrl, fetchOptions));

            // 使用 Promise.allSettled 替换 Promise.all
            const responses = await Promise.allSettled([trafficRequest, nodeCountRequest]);

            // 1. 处理流量请求的结果
            if (responses[0].status === 'fulfilled' && responses[0].value.ok) {
                const trafficResponse = responses[0].value;
                const userInfoHeader = trafficResponse.headers.get('subscription-userinfo');
                if (userInfoHeader) {
                    const info = {};
                    userInfoHeader.split(';').forEach(part => {
                        const [key, value] = part.trim().split('=');
                        if (key && value) info[key] = /^\d+$/.test(value) ? Number(value) : value;
                    });
                    result.userInfo = info;
                }
            }

            // 2. 处理节点数请求的结果
            if (responses[1].status === 'fulfilled' && responses[1].value.ok) {
                const nodeCountResponse = responses[1].value;
                const text = await nodeCountResponse.text();

                console.log(`[DEBUG] Node count API: Raw text length: ${text.length}`);
                console.log(`[DEBUG] Node count API: Raw text preview:`, text.substring(0, 200) + '...');

                // 使用与预览功能相同的节点解析逻辑
                try {
                    // 使用 parseNodeList 函数，与预览功能完全一致
                    const parsedNodes = parseNodeList(text);
                    console.log(`[DEBUG] Node count API: Parsed ${parsedNodes.length} nodes using parseNodeList`);
                    result.count = parsedNodes.length;
                } catch (e) {
                    // 解析失败，尝试简单统计
                    console.error('Node count parse error:', e);
                    console.log(`[DEBUG] Node count API: Falling back to regex count`);
                    try {
                        const cleanedText = text.replace(/\s/g, '');
                        const base64Regex = /^[A-Za-z0-9+\/=]+$/;
                        if (base64Regex.test(cleanedText) && cleanedText.length >= 20) {
                            console.log(`[DEBUG] Node count API: Base64 content detected, decoding...`);
                            const binaryString = atob(cleanedText);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            const processedText = new TextDecoder('utf-8').decode(bytes);
                            console.log(`[DEBUG] Node count API: Decoded text length: ${processedText.length}`);
                            const lineMatches = processedText.match(NODE_PROTOCOL_GLOBAL_REGEX);
                            console.log(`[DEBUG] Node count API: Regex matches in decoded text: ${lineMatches ? lineMatches.length : 0}`);
                            if (lineMatches) {
                                result.count = lineMatches.length;
                            }
                        } else {
                            console.log(`[DEBUG] Node count API: Using raw text regex match`);
                            const lineMatches = text.match(NODE_PROTOCOL_GLOBAL_REGEX);
                            console.log(`[DEBUG] Node count API: Regex matches in raw text: ${lineMatches ? lineMatches.length : 0}`);
                            if (lineMatches) {
                                result.count = lineMatches.length;
                            }
                        }
                    } catch {
                        // 最后降级到原始文本统计
                        console.log(`[DEBUG] Node count API: Final fallback to raw text regex`);
                        const lineMatches = text.match(NODE_PROTOCOL_GLOBAL_REGEX);
                        console.log(`[DEBUG] Node count API: Final regex matches: ${lineMatches ? lineMatches.length : 0}`);
                        if (lineMatches) {
                            result.count = lineMatches.length;
                        }
                    }
                }
            }

            // 只有在至少获取到一个有效信息时，才更新数据库
            if (result.userInfo || result.count > 0) {
                const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
                const originalSubs = await storageAdapter.get('misub_subscriptions_v1') || [];
                const allSubs = JSON.parse(JSON.stringify(originalSubs)); // 深拷贝
                const subToUpdate = allSubs.find(s => s.url === subUrl);

                if (subToUpdate) {
                    subToUpdate.nodeCount = result.count;
                    subToUpdate.userInfo = result.userInfo;

                    await storageAdapter.put('misub_subscriptions_v1', allSubs);
                }
            }

        } catch (e) {
            // 节点计数处理错误
            console.error('Node count processing error:', e);
        }

        return createJsonResponse(result);
    } catch (e) {
        return createJsonResponse({
            error: `获取节点数量失败: ${e.message}`
        }, 500);
    }
}

/**
 * 批量更新节点信息
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleBatchUpdateNodesRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await request.json();
        const { subscriptionIds, userAgent = 'MiSub-Batch-Update/1.0' } = requestData;

        // 验证必需参数
        if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
            return createJsonResponse({
                error: '请提供要更新的订阅ID列表'
            }, 400);
        }

        const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
        const allSubscriptions = await storageAdapter.get('misub_subscriptions_v1') || [];

        // 过滤出要更新的订阅
        const targetSubscriptions = allSubscriptions.filter(sub =>
            subscriptionIds.includes(sub.id) && sub.enabled && sub.url && sub.url.startsWith('http')
        );

        if (targetSubscriptions.length === 0) {
            return createJsonResponse({
                error: '没有找到需要更新的有效订阅'
            }, 400);
        }

        // 并行获取所有订阅的节点
        const updatePromises = targetSubscriptions.map(async (subscription) => {
            try {
                const response = await fetch(new Request(subscription.url, {
                    headers: { 'User-Agent': userAgent },
                    redirect: "follow",
                    cf: { insecureSkipVerify: true }
                }));

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const text = await response.text();

                // 使用与预览功能相同的解码和节点统计逻辑
                let nodeCount = 0;
                try {
                    // 使用 parseNodeList 函数，与预览功能完全一致
                    const parsedNodes = parseNodeList(text);
                    nodeCount = parsedNodes.length;
                } catch (e) {
                    // 解码失败，尝试简单统计
                    console.error('Batch update decode error:', e);
                    try {
                        const cleanedText = text.replace(/\s/g, '');
                        const base64Regex = /^[A-Za-z0-9+\/=]+$/;
                        if (base64Regex.test(cleanedText) && cleanedText.length >= 20) {
                            const binaryString = atob(cleanedText);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            const processedText = new TextDecoder('utf-8').decode(bytes);
                            nodeCount = (processedText.match(NODE_PROTOCOL_GLOBAL_REGEX) || []).length;
                        } else {
                            nodeCount = (text.match(NODE_PROTOCOL_GLOBAL_REGEX) || []).length;
                        }
                    } catch {
                        // 如果都失败，使用原始文本进行统计
                        nodeCount = (text.match(NODE_PROTOCOL_GLOBAL_REGEX) || []).length;
                    }
                }

                return {
                    subscriptionId: subscription.id,
                    subscriptionName: subscription.name,
                    success: true,
                    nodeCount,
                    error: null,
                    lastUpdated: new Date().toISOString()
                };
            } catch (e) {
                return {
                    subscriptionId: subscription.id,
                    subscriptionName: subscription.name,
                    success: false,
                    nodeCount: 0,
                    error: e.message,
                    lastUpdated: new Date().toISOString()
                };
            }
        });

        // 等待所有更新完成
        const results = await Promise.all(updatePromises);

        // 统计结果
        const successfulUpdates = results.filter(r => r.success);
        const totalNodes = successfulUpdates.reduce((sum, r) => sum + r.nodeCount, 0);

        return createJsonResponse({
            success: true,
            results,
            summary: {
                totalSubscriptions: targetSubscriptions.length,
                successfulUpdates: successfulUpdates.length,
                failedUpdates: targetSubscriptions.length - successfulUpdates.length,
                totalNodes
            }
        });
    } catch (e) {
        return createJsonResponse({
            error: `批量更新失败: ${e.message}`
        }, 500);
    }
}

/**
 * 清理无效节点（移除重复节点、无效节点等）
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleCleanNodesRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await request.json();
        const { profileId } = requestData;

        const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));

        if (profileId) {
            // 清理指定订阅组的节点
            const { handleSubscriptionNodesRequest } = await import('./subscription-handler.js');
            const previewResult = await handleSubscriptionNodesRequest(request, env);

            if (!previewResult.success) {
                return createJsonResponse({
                    error: '获取订阅组节点失败',
                    details: previewResult.error
                }, 400);
            }

            // 去重处理
            const uniqueNodes = [];
            const seenUrls = new Set();

            previewResult.nodes.forEach(node => {
                if (node.url && !seenUrls.has(node.url)) {
                    seenUrls.add(node.url);
                    uniqueNodes.push(node);
                }
            });

            return createJsonResponse({
                success: true,
                profileId,
                originalCount: previewResult.nodes.length,
                cleanedCount: uniqueNodes.length,
                removedDuplicates: previewResult.nodes.length - uniqueNodes.length,
                cleanedNodes: uniqueNodes
            });
        } else {
            // 清理所有订阅的节点（全局清理）
            return createJsonResponse({
                error: '全局节点清理功能暂未实现，请指定profileId'
            }, 501);
        }
    } catch (e) {
        return createJsonResponse({
            error: `节点清理失败: ${e.message}`
        }, 500);
    }
}

/**
 * 节点健康检查（测试节点连通性）
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleHealthCheckRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await request.json();
        const { nodeUrls, timeout = 5000 } = requestData;

        if (!nodeUrls || !Array.isArray(nodeUrls) || nodeUrls.length === 0) {
            return createJsonResponse({
                error: '请提供要检查的节点URL列表'
            }, 400);
        }

        // 在Cloudflare环境中，我们只能进行基本的格式检查
        // 实际的连通性测试需要在外部进行
        const healthResults = nodeUrls.map(nodeUrl => {
            try {
                const url = new URL(nodeUrl);
                const isValidProtocol = ['ss:', 'ssr:', 'vmess:', 'vless:', 'trojan:', 'hysteria:', 'hysteria2:', 'tuic:'].includes(url.protocol);

                return {
                    nodeUrl,
                    healthy: isValidProtocol,
                    error: isValidProtocol ? null : '不支持的协议',
                    checkTime: new Date().toISOString()
                };
            } catch (e) {
                return {
                    nodeUrl,
                    healthy: false,
                    error: '无效的URL格式',
                    checkTime: new Date().toISOString()
                };
            }
        });

        const healthyNodes = healthResults.filter(r => r.healthy).length;

        return createJsonResponse({
            success: true,
            results: healthResults,
            summary: {
                totalNodes: nodeUrls.length,
                healthyNodes,
                unhealthyNodes: nodeUrls.length - healthyNodes
            }
        });
    } catch (e) {
        return createJsonResponse({
            error: `健康检查失败: ${e.message}`
        }, 500);
    }
}