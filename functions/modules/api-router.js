/**
 * API路由处理模块
 * 处理所有API请求的路由分发
 */

import { StorageFactory, DataMigrator } from '../storage-adapter.js';
import { createJsonResponse, createErrorResponse, getAuthDebugInfo } from './utils.js';
import { authMiddleware, handleLogin, handleLogout, getAuthSessionDiagnostic, getLoginPasswordDiagnostic } from './auth-middleware.js';
import { handleDataRequest, handleMisubsSave, handleSettingsGet, handleSettingsSave, handlePublicProfilesRequest, handlePublicConfig, handleUpdatePassword } from './api-handler.js';
import { handleCronTrigger } from './notifications.js';
import {
    handleSubscriptionNodesRequest,
    handlePublicPreviewRequest
} from './subscription-handler.js';
import {
    handleDebugSubscriptionRequest,
    handleSystemInfoRequest,
    handleStorageTestRequest,
    handleExportDataRequest,
    handlePreviewContentRequest,
    handleTestNotificationRequest,
    handleTestSubconverterRequest
} from './handlers/debug-handler.js';
import {
    handleNodeCountRequest as handleLegacyNodeCountRequest,
    handleBatchUpdateNodesRequest,
    handleCleanNodesRequest,
    handleHealthCheckRequest
} from './handlers/node-handler.js';
import { handleClientRequest } from './handlers/client-handler.js';
import { handleErrorReportRequest } from './handlers/error-report-handler.js';
import {
    handleGuestbookGet,
    handleGuestbookPost,
    handleGuestbookManageGet,
    handleGuestbookManageAction
} from './handlers/guestbook-handler.js';
import { handleGithubReleaseRequest } from './handlers/github-proxy-handler.js'; // [NEW] Import handler
import { handleParseSubscription } from './parse-subscription-handler.js';
import {
    handleVpsReport,
    handleVpsNodesRequest,
    handleVpsNodeDetailRequest,
    handleVpsAlertsRequest,
    handleVpsInstallScript,
    handleVpsUninstallScript,
    handleVpsNetworkTargetsRequest,
    handleVpsNetworkCheck,
    handleVpsConfig,
    handleVpsPublicNodeDetailRequest
} from './handlers/vps-monitor-handler.js';

// 常量定义
const OLD_KV_KEY = 'misub_data_v1';
const KV_KEY_SUBS = 'misub_subscriptions_v1';
const KV_KEY_PROFILES = 'misub_profiles_v1'; // Ensure this is defined if used

/**
 * 处理主要的API请求
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');

    // [新增] 数据存储迁移接口 (KV -> D1)
    if (path === '/migrate_to_d1') {
        if (!await authMiddleware(request, env)) {
            return createJsonResponse({ error: 'Unauthorized' }, 401);
        }
        try {
            if (!env.MISUB_DB) {
                return createJsonResponse({
                    success: false,
                    message: 'D1 数据库未配置，请检查 wrangler.toml 配置'
                }, 400);
            }
            const migrationResult = await DataMigrator.migrateKVToD1(env);
            if (migrationResult.errors.length > 0) {
                return createJsonResponse({
                    success: false,
                    message: '迁移过程中出现错误',
                    details: migrationResult.errors,
                    partialSuccess: migrationResult
                }, 500);
            }
            return createJsonResponse({
                success: true,
                message: '数据已成功迁移到 D1 数据库',
                details: migrationResult
            });

        } catch (error) {
            console.error('[API Error /migrate_to_d1]', error);
            return createErrorResponse(error, 500);
        }
    }

    // [新增] 安全的、可重复执行的迁移接口
    if (path === '/migrate') {
        if (!await authMiddleware(request, env)) {
            return createJsonResponse({ error: 'Unauthorized' }, 401);
        }
        try {
            const kv = StorageFactory.resolveKV(env);
            if (!kv) {
                return createJsonResponse({ success: false, message: 'KV 未绑定' }, 400);
            }
            const oldData = await kv.get(OLD_KV_KEY).then(r => r ? JSON.parse(r) : null);
            const newDataRaw = await kv.get(KV_KEY_SUBS);
            const newDataExists = newDataRaw !== null;

            if (newDataExists) {
                return createJsonResponse({ success: true, message: '无需迁移，数据已是最新结构。' }, 200);
            }
            if (!oldData) {
                return createJsonResponse({ success: false, message: '未找到需要迁移的旧数据。' }, 404);
            }

            await kv.put(KV_KEY_SUBS, JSON.stringify(oldData));
            await kv.put(KV_KEY_PROFILES, JSON.stringify([]));
            await kv.put(OLD_KV_KEY + '_migrated_on_' + new Date().toISOString(), JSON.stringify(oldData));
            await kv.delete(OLD_KV_KEY);

            return createJsonResponse({ success: true, message: '数据迁移成功！' }, 200);
        } catch (e) {
            console.error('[API Error /migrate]', e);
            return createErrorResponse(e, 500);
        }
    }

    if (path === '/login') {
        return await handleLogin(request, env);
    }

    if (path === '/public_config' || path === '/config') {
        return await handlePublicConfig(env);
    }

    if (path === '/public/profiles') {
        return await handlePublicProfilesRequest(env);
    }

    if (path === '/public/preview') {
        return await handlePublicPreviewRequest(request, env);
    }

    // 留言板公开接口
    if (path === '/public/guestbook') {
        if (request.method === 'GET') {
            return await handleGuestbookGet(env);
        }
        if (request.method === 'POST') {
            return await handleGuestbookPost(request, env);
        }
        return createErrorResponse('Method Not Allowed', 405);
    }

    // Telegram Push Bot Webhook (公开接口，内部验证)
    if (path === '/telegram/webhook') {
        const { handleTelegramWebhook } = await import('./handlers/telegram-webhook-handler.js');
        return await handleTelegramWebhook(request, env);
    }

    // Error report endpoint (public)
    if (path === '/system/error_report') {
        return await handleErrorReportRequest(request, env);
    }

    // VPS monitor public report endpoint
    if (path === '/vps/report') {
        return await handleVpsReport(request, env);
    }

    // VPS monitor install/uninstall script endpoint (public)
    if (path === '/vps/install') {
        return await handleVpsInstallScript(request, env);
    }
    if (path === '/vps/uninstall') {
        return await handleVpsUninstallScript(request, env);
    }

    if (path === '/vps/config') {
        return await handleVpsConfig(request, env);
    }

    if (path === '/vps/public') {
        const { handleVpsPublicSnapshotRequest } = await import('./handlers/vps-monitor-handler.js');
        return await handleVpsPublicSnapshotRequest(request, env);
    }
    
    if (path.startsWith('/vps/public/nodes/')) {
        return await handleVpsPublicNodeDetailRequest(request, env);
    }

    // Public GET access for clients
    if (path.startsWith('/clients') && request.method === 'GET') {
        return await handleClientRequest(request, env);
    }

    // Special handling for /data to return 200 OK for unauthenticated requests
    if (path === '/data') {
        if (!await authMiddleware(request, env)) {
            return createJsonResponse({
                authenticated: false,
                message: 'Not logged in'
            });
        }


        return await handleDataRequest(env);
    }

    // [New] GitHub Proxy Route (Public)
    if (path === '/github/release') {
        return await handleGithubReleaseRequest(request, env);
    }

    // Logout 无需认证（cookie 过期时也需能正常登出）
    if (path === '/logout') {
        return await handleLogout(request);
    }

    // 认证调试端点（公开，不返回敏感值）
    if (path === '/auth_debug') {
        const debugInfo = await getAuthDebugInfo(env);
        const authDiagnostic = await getAuthSessionDiagnostic(request, env);

        return createJsonResponse({
            success: true,
            auth: authDiagnostic,
            runtime: debugInfo
        });
    }

    // 登录密码调试端点（公开，不返回敏感值）
    if (path === '/auth_check') {
        if (request.method !== 'POST') {
            return createJsonResponse({ error: 'Method Not Allowed' }, 405);
        }
        const diagnostic = await getLoginPasswordDiagnostic(request, env);
        return createJsonResponse(diagnostic, diagnostic.success ? 200 : 400);
    }

    if (!await authMiddleware(request, env)) {
        return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Auth-only route for client management (POST, DELETE, etc.)
    if (path.startsWith('/clients')) {
        return await handleClientRequest(request, env);
    }

    if (path === '/vps/nodes') {
        return await handleVpsNodesRequest(request, env);
    }

    if (path.startsWith('/vps/nodes/')) {
        return await handleVpsNodeDetailRequest(request, env);
    }

    if (path === '/vps/network_targets') {
        return await handleVpsNetworkTargetsRequest(request, env);
    }

    if (path === '/vps/network_check') {
        return await handleVpsNetworkCheck(request, env);
    }

    if (path === '/test_notification') {
        if (!await authMiddleware(request, env)) {
            return createJsonResponse({ error: 'Unauthorized' }, 401);
        }
        return await handleTestNotificationRequest(request, env);
    }

    if (path === '/test_subconverter') {
        if (!await authMiddleware(request, env)) {
            return createJsonResponse({ error: 'Unauthorized' }, 401);
        }
        return await handleTestSubconverterRequest(request, env);
    }

    // KV 诊断端点：测试 KV 读写是否正常（需登录）
    if (path === '/kv_test') {
        try {
            const kv = StorageFactory.resolveKV(env);
            if (!kv) {
                // 列出 env 中所有 key 及其类型，帮助诊断绑定情况
                const envKeys = env ? Object.keys(env).map(k => {
                    const v = env[k];
                    const t = typeof v;
                    const isKVLike = v && t === 'object' && typeof v.get === 'function';
                    return `${k}(${t}${isKVLike ? ',KV-like' : ''})`;
                }) : [];
                return createJsonResponse({ success: false, error: 'KV 未绑定', envKeys });
            }
            const testKey = '__kv_test_' + Date.now();
            const testValue = 'test_' + Math.random().toString(36).slice(2);

            // 写入
            let putError = null;
            try {
                await kv.put(testKey, testValue);
            } catch (e) {
                putError = e.message;
            }

            // 读回
            let readBack = null;
            let getError = null;
            try {
                readBack = await kv.get(testKey);
            } catch (e) {
                getError = e.message;
            }

            // 清理
            try { await kv.delete(testKey); } catch (_) {}

            // 读取实际数据键
            let subsRaw = null;
            let subsError = null;
            try {
                subsRaw = await kv.get('misub_subscriptions_v1');
            } catch (e) {
                subsError = e.message;
            }

            let settingsRaw = null;
            try {
                settingsRaw = await kv.get('worker_settings_v1');
            } catch (_) {}

            return createJsonResponse({
                success: true,
                kvBound: true,
                writeTest: {
                    wrote: testValue,
                    readBack,
                    match: readBack === testValue,
                    putError,
                    getError
                },
                actualData: {
                    subscriptions: subsRaw ? `存在，长度=${subsRaw.length}` : 'null（空）',
                    settings: settingsRaw ? `存在，长度=${settingsRaw.length}` : 'null（空）',
                    subsError
                }
            });
        } catch (e) {
            return createJsonResponse({ success: false, error: e.message });
        }
    }

    switch (path) {
        case '/misubs':
            return await handleMisubsSave(request, env);

        case '/node_count':
            return await handleLegacyNodeCountRequest(request, env);

        case '/nodes/health':
            return await handleHealthCheckRequest(request, env);

        case '/nodes/clean':
            return await handleCleanNodesRequest(request, env);

        case '/fetch_external_url':
            return await handleExternalFetchRequest(request);

        case '/batch_update_nodes':
            return await handleBatchUpdateNodesRequest(request, env);

        case '/subscription_nodes':
            return await handleSubscriptionNodesRequest(request, env);

        case '/debug_subscription':
            return await handleDebugSubscriptionRequest(request, env);

        case '/system/info':
            return await handleSystemInfoRequest(request, env);

        case '/system/storage_test':
            return await handleStorageTestRequest(request, env);

        case '/system/export':
            return await handleExportDataRequest(request, env);

        case '/preview/content':
            return await handlePreviewContentRequest(request, env);

        case '/parse_subscription':
            return await handleParseSubscription(request, env);

        case '/logs':
            if (request.method === 'GET') {
                const { LogService } = await import('../services/log-service.js');
                const logs = await LogService.getLogs(env);
                return createJsonResponse({ success: true, data: logs }, 200, {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
                });
            }
            if (request.method === 'DELETE') {
                const { LogService } = await import('../services/log-service.js');
                await LogService.clearLogs(env);
                return createJsonResponse({ success: true });
            }
            return createErrorResponse('Method Not Allowed', 405);

        case '/vps/alerts':
            return await handleVpsAlertsRequest(request, env);

        case '/settings':
            if (request.method === 'GET') {
                return await handleSettingsGet(env);
            }
            if (request.method === 'POST') {
                return await handleSettingsSave(request, env);
            }
            return createJsonResponse('Method Not Allowed', 405);

        case '/settings/password':
            return await handleUpdatePassword(request, env);

        case '/guestbook/manage':
            if (request.method === 'GET') {
                return await handleGuestbookManageGet(env);
            }
            if (request.method === 'POST') {
                return await handleGuestbookManageAction(request, env);
            }
            return createErrorResponse('Method Not Allowed', 405);

        default:
            return createErrorResponse('API route not found', 404);
    }
}

/**
 * 处理外部URL获取请求
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
async function handleExternalFetchRequest(request, env) {
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }

    let requestData;
    try {
        requestData = await request.json();
    } catch (e) {
        return createErrorResponse('Invalid JSON format', 400);
    }

    const { url: externalUrl, timeout = 15000 } = requestData;

    if (!externalUrl || typeof externalUrl !== 'string' || !/^https?:\/\/.+/.test(externalUrl)) {
        return createErrorResponse('Invalid or missing URL parameter. Must be a valid HTTP/HTTPS URL.', 400);
    }

    // 检查URL长度限制
    if (externalUrl.length > 2048) {
        return createErrorResponse('URL too long (max 2048 characters)', 400);
    }


    try {
        // 创建带超时的请求
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(new Request(externalUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'v2rayN/7.23',
                'Accept': '*/*',
                'Cache-Control': 'no-cache'
            },
            redirect: "follow",
            signal: controller.signal
        }));

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[External Fetch] HTTP ${response.status}: ${errorText.substring(0, 200)}`);

            return createJsonResponse({
                error: `Failed to fetch external URL: HTTP ${response.status} ${response.statusText}`,
                status: response.status,
                statusText: response.statusText
            }, response.status);
        }

        // 检查内容类型和大小
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
            return createErrorResponse('Content too large (max 10MB limit)', 413);
        }

        const contentType = response.headers.get('content-type') || '';

        // 读取响应体并生成 Base64 兜底内容
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 10 * 1024 * 1024) { // 10MB limit
            return createErrorResponse('Response content too large (max 10MB limit)', 413);
        }

        const content = new TextDecoder('utf-8').decode(buffer);
        const contentBase64 = encodeArrayBufferToBase64(buffer);


        // 返回包含原文与 Base64 的结果
        return new Response(JSON.stringify({
            content,
            contentBase64,
            contentType,
            size: buffer.byteLength,
            url: externalUrl,
            success: true
        }), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

    } catch (error) {
        let errorMessage = 'Unknown error occurred';
        let errorDetails = {};

        if (error.name === 'AbortError') {
            errorMessage = `Request timeout after ${timeout}ms`;
            errorDetails = { type: 'timeout', timeout };
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Network error - unable to reach the server';
            errorDetails = { type: 'network', originalError: error.message };
        } else if (error.message.includes('DNS')) {
            errorMessage = 'DNS resolution failed';
            errorDetails = { type: 'dns', originalError: error.message };
        } else {
            errorMessage = `Request failed: ${error.message}`;
            errorDetails = { type: 'unknown', originalError: error.message };
        }

        console.error(`[External Fetch] Error:`, {
            url: externalUrl,
            error: error.message,
            errorType: errorDetails.type
        });

        return createErrorResponse(errorMessage, 500);
    }
}

/**
 * ArrayBuffer -> Base64 ??
 */
function encodeArrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}
