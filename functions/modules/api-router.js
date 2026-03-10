/**
 * API路由处理模块
 * 处理所有API请求的路由分发
 */

import { StorageFactory, DataMigrator } from '../storage-adapter.js';
import { createJsonResponse, createErrorResponse } from './utils.js';
import { authMiddleware, handleLogin, handleLogout } from './auth-middleware.js';
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
            const oldData = await env.MISUB_KV.get(OLD_KV_KEY, 'json');
            const newDataExists = await env.MISUB_KV.get(KV_KEY_SUBS) !== null;

            if (newDataExists) {
                return createJsonResponse({ success: true, message: '无需迁移，数据已是最新结构。' }, 200);
            }
            if (!oldData) {
                return createJsonResponse({ success: false, message: '未找到需要迁移的旧数据。' }, 404);
            }

            await env.MISUB_KV.put(KV_KEY_SUBS, JSON.stringify(oldData));
            await env.MISUB_KV.put(KV_KEY_PROFILES, JSON.stringify([]));
            await env.MISUB_KV.put(OLD_KV_KEY + '_migrated_on_' + new Date().toISOString(), JSON.stringify(oldData));
            await env.MISUB_KV.delete(OLD_KV_KEY);

            return createJsonResponse({ success: true, message: '数据迁移成功！' }, 200);
        } catch (e) {
            console.error('[API Error /migrate]', e);
            return createErrorResponse(e, 500);
        }
    }

    if (path === '/login') {
        return await handleLogin(request, env);
    }

    if (path === '/public_config') {
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

    // Public GET access for clients
    if (path.startsWith('/clients') && request.method === 'GET') {
        return await handleClientRequest(request, env);
    }

    // Special handling for /data to return 200 OK for unauthenticated requests
    if (path === '/data') {
        if (!env?.MISUB_KV) {
            return createErrorResponse('KV 绑定 MISUB_KV 缺失', 500);
        }
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

    if (!await authMiddleware(request, env)) {
        return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Auth-only route for client management (POST, DELETE, etc.)
    if (path.startsWith('/clients')) {
        return await handleClientRequest(request, env);
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
        }), {
            cf: {
                insecureSkipVerify: true,
                timeout: timeout / 1000 // Cloudflare timeout in seconds
            }
        });

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
