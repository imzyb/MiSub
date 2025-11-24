/**
 * 调试处理器模块
 * 处理调试、订阅预览等开发相关API请求
 */

import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse } from '../utils.js';
import { handleSubscriptionNodesRequest } from './subscription-handler.js';
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
            return createJsonResponse({
                error: '请提供订阅URL、订阅ID或订阅组ID'
            }, 400);
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
                    hasKv: !!env.MISUB_KV,
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
        return createJsonResponse({
            error: `获取系统信息失败: ${e.message}`
        }, 500);
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
        await storageAdapter.delete ? storageAdapter.delete(testKey) : env.MISUB_KV.delete(testKey);
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
        return createJsonResponse({
            error: `数据导出失败: ${e.message}`
        }, 500);
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
            redirect: "follow",
            cf: {
                insecureSkipVerify: true,
                allowUntrusted: true,
                validateCertificate: false
            }
        }));

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
            const nodeMatches = decodedContent.match(/^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5):\/\//gm);
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
        return createJsonResponse({
            error: `内容预览失败: ${e.message}`
        }, 500);
    }
}

/**
 * 测试网络请求
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleNetworkTestRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await request.json();
        const { url, userAgent = 'v2rayN/7.23' } = requestData;

        if (!url) {
            return createJsonResponse({
                error: '请提供要测试的URL'
            }, 400);
        }

        console.log(`[Network Test] Testing URL: ${url}`);
        console.log(`[Network Test] User-Agent: ${userAgent}`);

        const startTime = Date.now();

        // 记录完整的请求信息
        const testResult = {
            url,
            userAgent,
            startTime: new Date().toISOString(),
            requestHeaders: {
                'User-Agent': userAgent,
                'Accept': '*/*',
                'Cache-Control': 'no-cache'
            },
            cfConfig: {
                insecureSkipVerify: true,
                allowUntrusted: true,
                validateCertificate: false
            }
        };

        try {
            // 执行网络请求
            const response = await fetch(new Request(url, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': '*/*',
                    'Cache-Control': 'no-cache'
                },
                redirect: "follow",
                cf: {
                    insecureSkipVerify: true,
                    allowUntrusted: true,
                    validateCertificate: false
                }
            }));

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // 获取响应头
            const responseHeaders = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            testResult.success = true;
            testResult.status = response.status;
            testResult.statusText = response.statusText;
            testResult.responseTime = responseTime;
            testResult.responseHeaders = responseHeaders;
            testResult.contentLength = response.headers.get('content-length') || 'unknown';

            // 读取部分内容用于分析
            const text = await response.text();
            testResult.contentLength = text.length;
            testResult.contentType = response.headers.get('content-type') || 'unknown';

            // 分析内容
            const trimmedText = text.substring(0, 1000);
            testResult.contentPreview = trimmedText;
            testResult.isBase64 = /^[A-Za-z0-9+\/=]+$/s.test(trimmedText.replace(/\s/g, ''));

            // 检测是否包含节点
            const nodeMatches = trimmedText.match(/^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5):\/\//gm);
            testResult.detectedNodes = nodeMatches ? nodeMatches.length : 0;

            console.log(`[Network Test] Success: ${response.status}, ${responseTime}ms, ${text.length} bytes`);

            return createJsonResponse(testResult);

        } catch (fetchError) {
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            testResult.success = false;
            testResult.responseTime = responseTime;
            testResult.error = fetchError.message;
            testResult.errorType = fetchError.constructor.name;

            console.log(`[Network Test] Failed: ${fetchError.message}`);

            return createJsonResponse(testResult);
        }

    } catch (e) {
        return createJsonResponse({
            error: `网络测试失败: ${e.message}`
        }, 500);
    }
}