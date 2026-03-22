/**
 * 节点处理器模块
 * 处理节点数量统计、批量更新等节点相关API请求
 */

import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse, createErrorResponse } from '../utils.js';
import { parseNodeList } from '../utils/node-parser.js';

// 创建用于全局匹配的协议正则表达式
const NODE_PROTOCOL_GLOBAL_REGEX = new RegExp('^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5|socks):\\/\\/', 'gm');

/**
 * 获取订阅节点数量和用户信息
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleNodeCountRequest(request, env) {
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }

    try {
        const { url: subUrl, fetchProxy, plusAsSpace } = await request.json();
        if (!subUrl || typeof subUrl !== 'string' || !/^https?:\/\//.test(subUrl)) {
            return createErrorResponse('Invalid or missing url', 400);
        }

        const result = { count: 0, userInfo: null };
        let trafficRequestSucceeded = false;
        let nodeCountRequestSucceeded = false;
        let fetchError = null;

        let requestUrl = subUrl;
        if (fetchProxy && typeof fetchProxy === 'string' && fetchProxy.trim()) {
            requestUrl = fetchProxy.trim() + encodeURIComponent(subUrl);
        }

        try {
            // 使用统一的User-Agent策略
            const fetchOptions = {
                headers: { 'User-Agent': 'v2rayN/7.23' },
                redirect: "follow"
            };
            const trafficFetchOptions = {
                headers: { 'User-Agent': 'clash-verge/v2.4.3' },
                redirect: "follow"
            };

            // cf 选项需传给 fetch() 而非 Request()：Cloudflare 环境生效，Node.js 安全忽略
            const cfOptions = { cf: { insecureSkipVerify: true } };
            const trafficRequest = fetch(new Request(requestUrl, trafficFetchOptions), cfOptions);
            const nodeCountRequest = fetch(new Request(requestUrl, fetchOptions), cfOptions);

            // 使用 Promise.allSettled 替换 Promise.all
            const responses = await Promise.allSettled([trafficRequest, nodeCountRequest]);

            // 1. 处理流量请求的结果
            // 辅助函数：从响应头提取用户信息
            const extractUserInfo = (response) => {
                const userInfoHeader = response.headers.get('subscription-userinfo');
                if (userInfoHeader) {
                    const info = {};
                    userInfoHeader.split(';').forEach(part => {
                        const [key, value] = part.trim().split('=');
                        if (key && value) info[key] = /^\d+$/.test(value) ? Number(value) : value;
                    });
                    return info;
                }
                return null;
            };

            // 辅助函数：从响应体伪节点名称中解析流量和到期信息
            // 许多机场会在节点列表中嵌入 "剩余流量：985.4 GB" / "套餐到期：2025-12-31" 等伪节点
            const extractUserInfoFromBody = (decodedText) => {
                if (!decodedText) return null;

                const info = {};
                // 解析所有 URI fragment（# 后面的部分）
                const fragments = [];
                const lines = decodedText.split('\n');
                for (const line of lines) {
                    const hashIdx = line.indexOf('#');
                    if (hashIdx !== -1) {
                        try {
                            fragments.push(decodeURIComponent(line.slice(hashIdx + 1).trim()));
                        } catch {
                            fragments.push(line.slice(hashIdx + 1).trim());
                        }
                    }
                }
                const fullText = fragments.join('\n');

                // 解析剩余流量（支持多种格式）
                const trafficPatterns = [
                    /剩余流量[：:]\s*([\d.]+)\s*(GB|MB|TB|KB)/i,
                    /Remaining[：:]\s*([\d.]+)\s*(GB|MB|TB|KB)/i,
                    /剩余[：:]\s*([\d.]+)\s*(GB|MB|TB|KB)/i,
                    /Traffic[：:]\s*([\d.]+)\s*(GB|MB|TB|KB)/i
                ];
                for (const pattern of trafficPatterns) {
                    const match = fullText.match(pattern);
                    if (match) {
                        const value = parseFloat(match[1]);
                        const unit = match[2].toUpperCase();
                        const multipliers = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
                        const bytes = Math.round(value * (multipliers[unit] || 1));
                        // 用 total = bytes, upload = 0, download = 0 表示剩余流量
                        info.total = bytes;
                        info.upload = 0;
                        info.download = 0;
                        break;
                    }
                }

                // 解析到期时间
                const expirePatterns = [
                    /(?:套餐到期|到期时间|过期时间|Expire)[：:]\s*(.+)/i
                ];
                for (const pattern of expirePatterns) {
                    const match = fullText.match(pattern);
                    if (match) {
                        const expireStr = match[1].trim();
                        if (/长期有效|永久|永不过期|unlimited|forever/i.test(expireStr)) {
                            // 设置一个非常远的到期时间表示长期有效
                            info.expire = Math.floor(new Date('2099-12-31').getTime() / 1000);
                        } else {
                            // 尝试解析日期
                            const dateMatch = expireStr.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
                            if (dateMatch) {
                                const ts = new Date(dateMatch[1].replace(/\//g, '-')).getTime();
                                if (!isNaN(ts)) {
                                    info.expire = Math.floor(ts / 1000);
                                }
                            }
                        }
                        break;
                    }
                }

                // 只有当至少解析到一项信息时才返回
                return Object.keys(info).length > 0 ? info : null;
            };

            // 1. 处理流量请求的结果
            if (responses[0].status === 'fulfilled' && responses[0].value.ok) {
                const info = extractUserInfo(responses[0].value);
                if (info) {
                    result.userInfo = info;
                    trafficRequestSucceeded = true;
                }
            } else {
                // 仅记录警告，不视为严重错误，因为我们还有 fallback
                const reason = responses[0].status === 'fulfilled'
                    ? `HTTP ${responses[0].value.status}`
                    : (responses[0].reason?.message || 'Unknown Error');
                console.warn(`[NodeHandler] Traffic specific request failed (${reason}). Will attempt fallback extraction.`);
            }

            // 2. 处理节点数请求的结果
            if (responses[1].status === 'fulfilled' && responses[1].value.ok) {
                const nodeCountResponse = responses[1].value;
                const buffer = await nodeCountResponse.arrayBuffer();
                const text = new TextDecoder('utf-8').decode(buffer);

                // 使用与预览功能相同的节点解析逻辑
                try {
                    // [回退1] 如果之前的流量请求失败或没拿到数据，尝试从节点请求的响应头中提取
                    if (!result.userInfo) {
                        const info = extractUserInfo(responses[1].value);
                        if (info) {
                            console.info('[NodeHandler] Successfully extracted traffic info from node response header (Fallback 1).');
                            result.userInfo = info;
                            trafficRequestSucceeded = true;
                        }
                    }

                    // 使用 parseNodeList 函数，与预览功能完全一致
                    const parsedNodes = parseNodeList(text, { plusAsSpace: Boolean(plusAsSpace) });

                    // [回退2] 如果响应头中也没有流量信息，尝试从 body 伪节点中解析
                    // 这在使用 FetchProxy（如 Vercel）时非常重要，因为代理会丢弃上游响应头
                    if (!result.userInfo) {
                        // 需要先解码 base64（如果是 base64 编码的话）
                        let decodedText = text;
                        try {
                            const cleanedText = text.replace(/\s/g, '');
                            let normalized = cleanedText.replace(/-/g, '+').replace(/_/g, '/');
                            const padding = normalized.length % 4;
                            if (padding) normalized += '='.repeat(4 - padding);
                            if (/^[A-Za-z0-9+/=]+$/.test(normalized) && normalized.length >= 20) {
                                const binaryString = atob(normalized);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                decodedText = new TextDecoder('utf-8').decode(bytes);
                            }
                        } catch { /* 已经是明文 */ }

                        const bodyInfo = extractUserInfoFromBody(decodedText);
                        if (bodyInfo) {
                            console.info('[NodeHandler] Successfully extracted traffic info from body fake nodes (Fallback 2).');
                            result.userInfo = bodyInfo;
                            trafficRequestSucceeded = true;
                        }
                    }

                    result.count = parsedNodes.length;
                    nodeCountRequestSucceeded = true;
                } catch (e) {
                    // 解析失败，尝试简单统计
                    console.error('Node count parse error:', e);

                    try {
                        const cleanedText = text.replace(/\s/g, '');
                        let normalized = cleanedText.replace(/-/g, '+').replace(/_/g, '/');
                        const padding = normalized.length % 4;
                        if (padding) {
                            normalized += '='.repeat(4 - padding);
                        }
                        const base64Regex = /^[A-Za-z0-9+\/=]+$/;
                        if (base64Regex.test(normalized) && normalized.length >= 20) {
                            const binaryString = atob(normalized);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            const processedText = new TextDecoder('utf-8').decode(bytes);
                            const lineMatches = processedText.match(NODE_PROTOCOL_GLOBAL_REGEX);
                            if (lineMatches) {
                                result.count = lineMatches.length;
                                nodeCountRequestSucceeded = true;
                            }
                        } else {
                            const lineMatches = text.match(NODE_PROTOCOL_GLOBAL_REGEX);
                            if (lineMatches) {
                                result.count = lineMatches.length;
                                nodeCountRequestSucceeded = true;
                            }
                        }
                    } catch (error) {
                        // 最后降级到原始文本统计
                        console.debug('[NodeHandler] Failed to decode node count response, falling back to raw text:', error);
                        const lineMatches = text.match(NODE_PROTOCOL_GLOBAL_REGEX);
                        if (lineMatches) {
                            result.count = lineMatches.length;
                            nodeCountRequestSucceeded = true;
                        }
                    }
                }
            } else if (responses[1].status === 'rejected') {
                if (!fetchError) fetchError = responses[1].reason;
                console.error('Node count request failed:', responses[1].reason);
            } else if (responses[1].status === 'fulfilled' && !responses[1].value.ok) {
                if (!fetchError) fetchError = new Error(`HTTP ${responses[1].value.status}: ${responses[1].value.statusText}`);
                console.error('Node count request returned error:', responses[1].value.status);
            }

            // 检查是否两个请求都失败了
            if (!trafficRequestSucceeded && !nodeCountRequestSucceeded) {
                // 两个请求都失败,返回错误信息
                let errorType = 'fetch_failed';
                let errorMessage = '订阅获取失败';

                if (fetchError) {
                    if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
                        errorType = 'timeout';
                        errorMessage = '订阅请求超时';
                    } else if (fetchError.message?.includes('network') || fetchError.message?.includes('fetch')) {
                        errorType = 'network';
                        errorMessage = '网络连接失败';
                    } else if (fetchError.message?.includes('HTTP')) {
                        errorType = 'server';
                        errorMessage = fetchError.message;
                    }
                }

                console.error(`[Node Count] Both requests failed for ${subUrl}:`, errorMessage);
                result.error = errorMessage;
                result.errorType = errorType;
                return createJsonResponse(result);
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
            result.error = `处理失败: ${e.message}`;
            result.errorType = 'processing_error';
            return createJsonResponse(result);
        }

        return createJsonResponse(result);
    } catch (e) {
        return createErrorResponse(`获取节点数量失败: ${e.message}`, 500);
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

        // 单个订阅超时时间（毫秒）
        const SINGLE_SUB_TIMEOUT = 15000;

        // 并行获取所有订阅的节点（带超时）
        const updatePromises = targetSubscriptions.map(async (subscription) => {
            try {
                let requestUrl = subscription.url;
                if (subscription.fetchProxy && typeof subscription.fetchProxy === 'string' && subscription.fetchProxy.trim()) {
                    requestUrl = subscription.fetchProxy.trim() + encodeURIComponent(subscription.url);
                }

                // 使用 Promise.race 实现超时
                const fetchPromise = fetch(new Request(requestUrl, {
                    headers: { 'User-Agent': userAgent },
                    redirect: "follow"
                }), { cf: { insecureSkipVerify: true } });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('请求超时')), SINGLE_SUB_TIMEOUT)
                );

                const response = await Promise.race([fetchPromise, timeoutPromise]);

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
        return createErrorResponse(`批量更新失败: ${e.message}`, 500);
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
            const { handleSubscriptionNodesRequest } = await import('../subscription-handler.js');
            const previewResult = await handleSubscriptionNodesRequest(request, env);

            if (!previewResult.success) {
                return createErrorResponse(`获取订阅组节点失败: ${previewResult.error}`, 400);
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
            return createErrorResponse('全局节点清理功能暂未实现，请指定profileId', 501);
        }
    } catch (e) {
        return createErrorResponse(`节点清理失败: ${e.message}`, 500);
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
                const isValidProtocol = ['ss:', 'ssr:', 'vmess:', 'vless:', 'trojan:', 'hysteria:', 'hysteria2:', 'tuic:', 'snell:'].includes(url.protocol);

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
