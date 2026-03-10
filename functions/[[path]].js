/**
 * MiSub Cloudflare Pages Functions - 主入口文件
 * 负责路由分发和请求协调
 *
 * 模块化架构v2:
 * - utils.js: 工具函数
 * - auth-middleware.js: 认证中间件
 * - notifications.js: 通知功能
 * - subscription-handler.js: 订阅请求处理
 * - api-handler.js: API处理
 * - api-router.js: API路由
 * - handlers/: 功能处理器模块
 *   - subscription-handler.js: 订阅相关处理
 *   - node-handler.js: 节点相关处理
 *   - debug-handler.js: 调试相关处理
 * - utils/: 工具模块
 *   - geo-utils.js: 地理识别工具
 *   - node-parser.js: 节点解析工具
 */

import { handleMisubRequest } from './modules/subscription-handler.js';
import { handleApiRequest } from './modules/api-router.js';
import { createJsonResponse } from './modules/utils.js';
import { corsMiddleware, securityHeadersMiddleware } from './middleware/cors.js';
import { handleDisguiseRequest } from './modules/handlers/disguise-handler.js';

// 静态导入核心依赖以优化冷加载
import { StorageFactory, SettingsCache } from './storage-adapter.js';
import { KV_KEY_SETTINGS } from './modules/config.js';
import { handleCronTrigger } from './modules/notifications.js';
import { authMiddleware } from './modules/auth-middleware.js';

function parseCorsOrigins(env, requestUrl) {
    const configured = (env?.CORS_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    const origins = configured.length ? configured : [requestUrl.origin];
    if (['localhost', '127.0.0.1'].includes(requestUrl.hostname)) {
        origins.push('http://localhost:5173', 'http://127.0.0.1:5173');
    }
    return Array.from(new Set(origins));
}

function applyNoStoreToHtmlResponse(response) {
    if (!response || !response.headers) {
        return response;
    }
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('text/html')) {
        return response;
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

/**
 * 主要的请求处理函数
 * @param {Object} context - Cloudflare上下文对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    try {
        const handleRequest = async () => {
            // 路由分发
            if (url.pathname.startsWith('/api/')) {
                // API 路由
                return await handleApiRequest(request, env);
            } else if (url.pathname.startsWith('/sub/')) {
                // MiSub 订阅路由
                return await handleMisubRequest(context);
            } else if (url.pathname === '/cron') {
                // 定时任务路由 (需要认证)
                // 使用设置中的 cronSecret 进行验证
                const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
                const settings = await storageAdapter.get(KV_KEY_SETTINGS) || {};

                const expectedSecret = settings.cronSecret;

                if (!expectedSecret) {
                    return createJsonResponse({
                        error: 'Cron Secret 未配置',
                        hint: '请在设置页面的「自动任务配置」中设置 Cron Secret'
                    }, 500);
                }

                const cronAuthHeader = request.headers.get('Authorization');
                const cronSecretParam = url.searchParams.get('secret');
                const isAuthorized =
                    cronAuthHeader === `Bearer ${expectedSecret}` ||
                    cronSecretParam === expectedSecret;

                if (!isAuthorized) {
                    return createJsonResponse({ error: 'Unauthorized' }, 401);
                }

                return await handleCronTrigger(env);
            } else {
                const isLocalhost = ['localhost', '127.0.0.1'].includes(url.hostname);

                // 本地 wrangler pages dev 调试兜底：优先返回静态资源，避免函数逻辑影响 SPA 首屏
                if (isLocalhost) {
                    let localResponse = await next();
                    const isLikelySpaPath = !/\.\w+$/.test(url.pathname)
                        && !url.pathname.startsWith('/api/')
                        && !url.pathname.startsWith('/sub/')
                        && url.pathname !== '/cron';

                    if (localResponse.status === 404 && isLikelySpaPath) {
                        const indexUrl = new URL('/', request.url);
                        const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
                        if (indexResponse.status === 200) {
                            localResponse = indexResponse;
                        }
                    }

                    return applyNoStoreToHtmlResponse(localResponse);
                }
                // 静态文件处理
                const isStaticAsset = /^\/(assets|@vite|src)\/./.test(url.pathname) || /\.\w+$/.test(url.pathname);

                // 需要提前读取 Settings 来获取 customLoginPath
                // 为了性能，只有在非静态资源且可能是 SPA 路由时才读取
                let settings = {};
                if (!isStaticAsset) {
                    settings = await SettingsCache.get(env) || {};
                }

                const customLoginPath = settings.customLoginPath ? '/' + settings.customLoginPath.replace(/^\//, '') : '/login';

                // SPA 路由白名单：这些请求应该交由前端路由处理，而不是作为订阅请求
                // [修复] 增加更多可能的SPA路由，防止被误判为订阅请求
                // [新增] 动态包含自定义登录路径
                const isSpaRoute = [
                    '/groups',
                    '/nodes',
                    '/subscriptions',
                    '/settings',
                    '/login', // 默认 login 仍然需要保留，以便前端处理 "入口" 逻辑
                    '/dashboard',
                    '/profile',
                    '/explore', // [新增] 公开页面
                    '/offline',  // [修复] PWA 离线页面
                    customLoginPath // [新增] 自定义登录路径
                ].some(route => url.pathname === route || url.pathname.startsWith(route + '/'));

                const isProtectedSpaRoute = isSpaRoute
                    && url.pathname !== '/login'
                    && url.pathname !== customLoginPath
                    && !url.pathname.startsWith('/explore')
                    && url.pathname !== '/offline';

                // Route protection for SPA pages
                // If accessing a protected route without auth, redirect to login
                // [Fix] Exclude /explore from auth check
                // [Fix] Skip auth check on localhost to avoid port 8787/5173 sync issues during dev
                // [修复] 排除 /offline 路由的认证检查
                if (isProtectedSpaRoute && !isLocalhost) {
                    const isAuthenticated = await authMiddleware(request, env);
                    if (!isAuthenticated) {
                        // Redirect to login page
                        return new Response(null, {
                            status: 302,
                            headers: { Location: '/login' }
                        });
                    }
                }

                // [Smart Disguise] Check if we need to disguise the SPA/Root
                // Only applies to non-static assets
                if ((url.pathname === '/' || isSpaRoute) && !isStaticAsset) {
                    // Pass settings to avoid double fetch
                    const disguiseResponse = await handleDisguiseRequest(context, settings);
                    if (disguiseResponse) {
                        return disguiseResponse;
                    }
                }


                if (!isStaticAsset && !isSpaRoute && url.pathname !== '/') {
                    // 如果是浏览器请求且看起来像是一个页面访问，优先尝试返回 SPA
                    // fix: 解决经典模式下可能的路由冲突
                    const acceptHeader = request.headers.get('Accept') || '';
                    if (acceptHeader.includes('text/html')) {
                        // 既然它不是静态资源，也不是已知的SPA路由，但请求的是HTML
                        // 我们可以选择:
                        // 1. 仍然尝试作为订阅处理 (如果用户在浏览器直接访问 shortlink)
                        // 2. 返回 next() 让前端处理 404

                        // 这里保持现有逻辑，但添加注释备忘。
                        // 既然目前通过 ui.js 强制跳转回 / 解决了经典模式的问题，
                        // 这里我们可以保留对短链接的支持。
                        // return next(); 
                    }
                    return await handleMisubRequest(context);
                }

                // Continue to static assets or root
                let response = await next();

                // [Fix] SPA Fallback: If asset not found (404) and it's an SPA route OR it's an HTML request, serve index.html
                const acceptHeader = request.headers.get('Accept') || '';
                const fetchMode = request.headers.get('Sec-Fetch-Mode') || '';
                const fetchDest = request.headers.get('Sec-Fetch-Dest') || '';
                const isNavigationRequest = fetchMode === 'navigate' || fetchDest === 'document';
                const isHtmlRequest = isNavigationRequest && acceptHeader.includes('text/html');

                if (response.status === 404 && (isSpaRoute || isHtmlRequest)) {
                    // Clone the request to fetch index.html
                    const indexUrl = new URL('/', request.url);
                    const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));

                    // If index.html exists (e.g. in production or after build), return it
                    if (indexResponse.status === 200) {
                        response = indexResponse;
                    } else {
                        // If index.html is missing (likely local dev serving 'public' dir), redirect to Vite dev server
                        // This assumes standard Vite port 5173.
                        return new Response(`Redirecting to frontend dev server...`, {
                            status: 302,
                            headers: {
                                'Location': `http://localhost:5173${url.pathname}${url.search}`,
                                'Content-Type': 'text/plain'
                            }
                        });
                    }

                }

                return applyNoStoreToHtmlResponse(response);
            }
        };

        const corsOptions = {
            origins: parseCorsOrigins(env, url),
            allowCredentials: true
        };
        return corsMiddleware(request, () => securityHeadersMiddleware(request, handleRequest), corsOptions);
    } catch (error) {
        // 全局错误处理
        console.error('[Main Handler Error]', error);
        return createJsonResponse({
            error: 'Internal Server Error',
            message: error.message
        }, 500);
    }
}

/**
 * 调试信息导出 (仅开发环境)
 */
export const debugInfo = {
    version: '2.0.0-modular-v2',
    modules: [
        'utils',
        'auth-middleware',
        'notifications',
        'subscription',
        'subscription-handler',
        'api-handler',
        'api-router',
        'handlers/subscription-handler',
        'handlers/node-handler',
        'handlers/debug-handler',
        'utils/geo-utils',
        'utils/node-parser'
    ],
    architecture: 'modular-refactor-v2-domain-split'
};
