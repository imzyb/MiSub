/**
 * 调试处理器模块
 * 处理调试、订阅预览等开发相关API请求
 */

import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse, createErrorResponse } from '../utils.js';
import { handleSubscriptionNodesRequest } from '../subscription-handler.js';
import { debugTgNotification } from '../../services/notification-service.js';
import { parseNodeList, calculateProtocolStats, calculateRegionStats } from '../utils/node-parser.js';

/**
 * 调试订阅信息和节点内容
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleDebugSubscriptionRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await request.json();
        const {
            url: subscriptionUrl,
            subscriptionId,
            profileId,
            userAgent = 'MiSub-Debug/1.0'
        } = requestData;

        // 验证必需参数
        if (!subscriptionUrl && !subscriptionId && !profileId) {
            return createErrorResponse('请提供订阅URL、订阅ID或订阅组ID', 400);
        }

        // 使用订阅处理器获取节点信息
        const nodeRequest = new Request('https://debug.local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const nodeResult = await handleSubscriptionNodesRequest(nodeRequest, env);

        if (!nodeResult.success) {
            return createJsonResponse({
                error: '获取订阅信息失败',
                details: nodeResult.error
            }, 400);
        }

        // 生成详细的调试信息
        const debugInfo = {
            requestInfo: {
                providedUrl: !!subscriptionUrl,
                providedSubscriptionId: !!subscriptionId,
                providedProfileId: !!profileId,
                userAgent: userAgent
            },
            subscriptionInfo: {
                totalSubscriptions: nodeResult.subscriptions?.length || 0,
                successfulSubscriptions: nodeResult.subscriptions?.filter(s => s.success).length || 0,
                failedSubscriptions: nodeResult.subscriptions?.filter(s => !s.success).length || 0
            },
            nodeInfo: {
                totalNodes: nodeResult.totalCount || 0,
                protocols: nodeResult.stats?.protocols || {},
                regions: nodeResult.stats?.regions || {}
            },
            detailedSubscriptions: nodeResult.subscriptions?.map(sub => ({
                name: sub.subscriptionName,
                url: sub.url,
                success: sub.success,
                nodeCount: sub.nodes?.length || 0,
                error: sub.error,
                isManualNode: sub.isManualNode || false,
                protocols: sub.success ? calculateProtocolStats(sub.nodes || []) : {},
                regions: sub.success ? calculateRegionStats(sub.nodes || []) : {}
            })) || [],
            sampleNodes: (nodeResult.nodes || []).slice(0, 5).map(node => ({
                name: node.name,
                protocol: node.protocol,
                region: node.region,
                url: node.url.replace(/^(.+?):\/\/.+@/, '$1://***@') // 隐藏敏感信息
            }))
        };

        return createJsonResponse({
            success: true,
            debugInfo,
            fullResult: nodeResult
        });
    } catch (e) {
        return createJsonResponse({
            error: `调试失败: ${e.message}`,
            stack: e.stack
        }, 500);
    }
}

/**
 * 获取系统环境信息
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleSystemInfoRequest(request, env) {
    if (request.method !== 'GET') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const storageType = await StorageFactory.getStorageType(env);
        const storageAdapter = StorageFactory.createAdapter(env, storageType);

        // 获取基本统计信息
        const allSubscriptions = await storageAdapter.get('misub_subscriptions_v1') || [];
        const allProfiles = await storageAdapter.get('misub_profiles_v1') || [];

        const activeSubscriptions = allSubscriptions.filter(sub => sub.enabled).length;
        const activeProfiles = allProfiles.filter(profile => profile.enabled).length;

        const systemInfo = {
            environment: {
                storageType,
                availableFeatures: {
                    kv: storageType === 'kv',
                    d1: storageType === 'd1',
                    dual: StorageFactory.hasDualStorage(env)
                },
                bindings: {
                    hasKv: !!StorageFactory.resolveKV(env),
                    hasD1: !!env.MISUB_DB,
                    hasAdminPassword: !!env.ADMIN_PASSWORD,
                    hasCookieSecret: !!env.COOKIE_SECRET,
                    hasTelegramBot: !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_CHAT_ID
                }
            },
            statistics: {
                subscriptions: {
                    total: allSubscriptions.length,
                    active: activeSubscriptions,
                    inactive: allSubscriptions.length - activeSubscriptions
                },
                profiles: {
                    total: allProfiles.length,
                    active: activeProfiles,
                    inactive: allProfiles.length - activeProfiles
                }
            },
            timestamp: new Date().toISOString(),
            uptime: null // Cloudflare Workers 中没有 process.uptime
        };

        return createJsonResponse({
            success: true,
            systemInfo
        });
    } catch (e) {
        return createErrorResponse(`获取系统信息失败: ${e.message}`, 500);
    }
}

/**
 * 测试存储连接
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleStorageTestRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const storageType = await StorageFactory.getStorageType(env);
        const storageAdapter = StorageFactory.createAdapter(env, storageType);

        const testKey = `misub_test_${Date.now()}`;
        const testValue = {
            timestamp: new Date().toISOString(),
            test: true,
            storageType
        };

        // 测试写入
        const writeStart = Date.now();
        await storageAdapter.put(testKey, testValue);
        const writeTime = Date.now() - writeStart;

        // 测试读取
        const readStart = Date.now();
        const readValue = await storageAdapter.get(testKey);
        const readTime = Date.now() - readStart;

        // 测试删除
        const deleteStart = Date.now();
        await storageAdapter.delete(testKey);
        const deleteTime = Date.now() - deleteStart;

        const isSuccessful = JSON.stringify(readValue) === JSON.stringify(testValue);

        const testResults = {
            storageType,
            operations: {
                write: {
                    success: true,
                    time: writeTime
                },
                read: {
                    success: isSuccessful,
                    time: readTime
                },
                delete: {
                    success: true,
                    time: deleteTime
                }
            },
            overall: {
                success: isSuccessful,
                totalTime: writeTime + readTime + deleteTime
            },
            timestamp: new Date().toISOString()
        };

        return createJsonResponse({
            success: true,
            testResults
        });
    } catch (e) {
        return createJsonResponse({
            error: `存储测试失败: ${e.message}`,
            storageType: await StorageFactory.getStorageType(env)
        }, 500);
    }
}

/**
 * 导出数据（备份功能）
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleExportDataRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await request.json();
        const { includeSubscriptions = true, includeProfiles = true, includeSettings = false } = requestData;

        const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
        const exportData = {
            exportInfo: {
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                storageType: await StorageFactory.getStorageType(env)
            },
            data: {}
        };

        if (includeSubscriptions) {
            const subscriptions = await storageAdapter.get('misub_subscriptions_v1') || [];
            exportData.data.subscriptions = subscriptions;
        }

        if (includeProfiles) {
            const profiles = await storageAdapter.get('misub_profiles_v1') || [];
            exportData.data.profiles = profiles;
        }

        if (includeSettings) {
            const settings = await storageAdapter.get('misub_settings_v1') || {};
            exportData.data.settings = settings;
        }

        const exportSize = JSON.stringify(exportData).length;

        return createJsonResponse({
            success: true,
            exportData,
            metadata: {
                size: exportSize,
                subscriptionsCount: exportData.data.subscriptions?.length || 0,
                profilesCount: exportData.data.profiles?.length || 0,
                settingsCount: Object.keys(exportData.data.settings || {}).length
            }
        });
    } catch (e) {
        return createErrorResponse(`数据导出失败: ${e.message}`, 500);
    }
}

/**
 * 节点内容预览（不解析，只显示原始内容）
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handlePreviewContentRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await request.json();
        const { url, userAgent = 'MiSub-Preview/1.0', maxLength = 5000 } = requestData;

        if (!url) {
            return createJsonResponse({
                error: '请提供订阅URL'
            }, 400);
        }

        const response = await fetch(new Request(url, {
            headers: { 'User-Agent': userAgent },
            redirect: "follow"
        }), { cf: { insecureSkipVerify: true } });

        if (!response.ok) {
            return createJsonResponse({
                error: `HTTP ${response.status}: ${response.statusText}`
            }, 400);
        }

        const rawContent = await response.text();
        const contentLength = rawContent.length;

        // 检测内容类型
        const isBase64 = /^[A-Za-z0-9+\/=]+$/s.test(rawContent.replace(/\s/g, ''));
        let decodedContent = rawContent;
        let contentInfo = {
            originalLength: contentLength,
            isBase64,
            contentType: 'unknown'
        };

        if (isBase64) {
            try {
                const cleanedContent = rawContent.replace(/\s/g, '');
                const binaryString = atob(cleanedContent);
                decodedContent = new TextDecoder('utf-8').decode(new Uint8Array([...binaryString].map(c => c.charCodeAt(0))));
                contentInfo.decodedLength = decodedContent.length;
                contentInfo.decodeSuccess = true;
            } catch (e) {
                contentInfo.decodeError = e.message;
                contentInfo.decodeSuccess = false;
            }
        }

        // 检测内容格式
        if (decodedContent.includes('proxies:') && decodedContent.includes('rules:')) {
            contentInfo.contentType = 'clash-config';
        } else if (decodedContent.includes('outbounds') && decodedContent.includes('inbounds')) {
            contentInfo.contentType = 'singbox-config';
        } else {
            const nodeMatches = decodedContent.match(/^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5|socks):\/\//gm);
            if (nodeMatches) {
                contentInfo.contentType = 'node-list';
                contentInfo.nodeCount = nodeMatches.length;
            }
        }

        // 截取内容用于预览
        const previewContent = decodedContent.length > maxLength
            ? decodedContent.substring(0, maxLength) + '\n...[内容已截断]'
            : decodedContent;

        return createJsonResponse({
            success: true,
            contentInfo,
            previewContent,
            fullContent: request.fullExport ? decodedContent : null
        });
    } catch (e) {
        return createErrorResponse(`内容预览失败: ${e.message}`, 500);
    }
}

/**
 * 测试Telegram通知
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleTestNotificationRequest(request, env) {
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }

    try {
        const { botToken, chatId } = await request.json();
        const settings = { BotToken: botToken, ChatID: chatId };

        const result = await debugTgNotification(settings, '🔔 *通知测试* 🔔\n\n这是来自 MiSub 的测试消息，用于验证您的配置是否正确。');

        if (result.success) {
            return createJsonResponse({ success: true, detail: result.response });
        } else {
            return createJsonResponse({ success: false, error: result.error, detail: result.response }, 400);
        }

    } catch (e) {
        return createErrorResponse(e.message, 500);
    }
}

/**
 * 测试 SubConverter 后端可用性
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleTestSubconverterRequest(request, env) {
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }

    try {
        const { backend } = await request.json();

        if (!backend || typeof backend !== 'string' || backend.trim() === '') {
            return createJsonResponse({ success: false, error: '请提供 SubConverter 后端地址' }, 400);
        }

        const trimmed = backend.trim();
        const hasProtocol = /^https?:\/\//i.test(trimmed);
        const baseUrl = hasProtocol ? trimmed : `https://${trimmed}`;

        // 构建后端 URL (通常 SubConverter 的根路径或 /version 端点)
        let testUrl;
        try {
            const urlObj = new URL(baseUrl);
            // 尝试访问根路径来检测后端是否可用
            testUrl = urlObj.origin + '/version';
        } catch (err) {
            return createJsonResponse({ success: false, error: '无效的后端地址格式' }, 400);
        }

        const timeout = 10000; // 10秒超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let response;
        let responseTime;
        const startTime = Date.now();

        try {
            response = await fetch(testUrl, {
                method: 'GET',
                headers: { 'User-Agent': 'MiSub-Backend-Test/1.0' },
                signal: controller.signal
            });
            responseTime = Date.now() - startTime;
        } catch (fetchError) {
            clearTimeout(timeoutId);
            // 如果 /version 失败，尝试根路径
            try {
                const urlObj = new URL(baseUrl);
                testUrl = urlObj.origin;
                const fallbackStart = Date.now();
                response = await fetch(testUrl, {
                    method: 'GET',
                    headers: { 'User-Agent': 'MiSub-Backend-Test/1.0' },
                    signal: controller.signal
                });
                responseTime = Date.now() - fallbackStart;
            } catch (fallbackError) {
                if (fallbackError.name === 'AbortError') {
                    return createJsonResponse({
                        success: false,
                        error: `连接超时 (${timeout / 1000}秒)`,
                        detail: { timeout: true, backend: trimmed }
                    }, 408);
                }
                return createJsonResponse({
                    success: false,
                    error: `无法连接到后端: ${fallbackError.message}`,
                    detail: { network: true, backend: trimmed, originalError: fallbackError.message }
                }, 503);
            }
        } finally {
            clearTimeout(timeoutId);
        }

        // 检查响应
        if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            let versionInfo = null;

            try {
                const text = await response.text();
                // 尝试解析版本信息
                if (contentType.includes('application/json')) {
                    versionInfo = JSON.parse(text);
                } else if (text.length < 200) {
                    versionInfo = text.trim();
                }
            } catch (e) {
                // 忽略解析错误
            }

            return createJsonResponse({
                success: true,
                message: '后端可用',
                detail: {
                    backend: trimmed,
                    responseTime: `${responseTime}ms`,
                    status: response.status,
                    version: versionInfo
                }
            });
        } else {
            // 即使返回非 2xx，也可能是后端在线但路径不对
            // 对于 SubConverter，即使返回 404 也说明服务器在运行
            if (response.status === 404 || response.status === 405) {
                return createJsonResponse({
                    success: true,
                    message: '后端可用（但未找到版本信息端点）',
                    detail: {
                        backend: trimmed,
                        responseTime: `${responseTime}ms`,
                        status: response.status,
                        note: '服务器响应正常，订阅转换功能应可用'
                    }
                });
            }

            return createJsonResponse({
                success: false,
                error: `后端返回错误状态: HTTP ${response.status}`,
                detail: {
                    backend: trimmed,
                    status: response.status,
                    statusText: response.statusText
                }
            }, response.status >= 500 ? 502 : 400);
        }

    } catch (e) {
        return createErrorResponse(`测试失败: ${e.message}`, 500);
    }
}
