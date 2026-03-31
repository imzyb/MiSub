import { StorageFactory } from '../../storage-adapter.js';
import { migrateConfigSettings, formatBytes, getCallbackToken, getPublicBaseUrl, migrateProfileIds } from '../utils.js';
import { generateCombinedNodeList } from '../../services/subscription-service.js';
import { sendEnhancedTgNotification } from '../notifications.js';
import { KV_KEY_SUBS, KV_KEY_PROFILES, KV_KEY_SETTINGS, DEFAULT_SETTINGS as defaultSettings } from '../config.js';
import { createDisguiseResponse } from '../disguise-page.js';
import { generateCacheKey, setCache } from '../../services/node-cache-service.js';
import { resolveRequestContext } from './request-context.js';
import { buildSubconverterUrlVariants, getSubconverterCandidates, fetchFromSubconverter } from './subconverter-client.js';
import { resolveNodeListWithCache } from './cache-manager.js';
import { logAccessError, logAccessSuccess, shouldSkipLogging as shouldSkipAccessLog } from './access-logger.js';
import { isBrowserAgent, determineTargetFormat } from './user-agent-utils.js'; // [Added] Import centralized util
import { authMiddleware } from '../auth-middleware.js';
import { generateBuiltinClashConfig } from './builtin-clash-generator.js'; // [Added] 内置 Clash 生成器
import { generateBuiltinSurgeConfig } from './builtin-surge-generator.js'; // [Added] 内置 Surge 生成器
import { generateBuiltinLoonConfig } from './builtin-loon-generator.js'; // [Added] 内置 Loon 生成器

/**
 * 处理MiSub订阅请求
 * @param {Object} context - Cloudflare上下文
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleMisubRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userAgentHeader = request.headers.get('User-Agent') || "Unknown";

    // [Debug Logging Entry]
    if (!env.workers) {
        console.log(`\n[MiSub Request] ${request.method} ${url.pathname}${url.search}`);
        console.log(`[MiSub UA] ${userAgentHeader}`);
    }

    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
    const [settingsData, misubsData, profilesData] = await Promise.all([
        storageAdapter.get(KV_KEY_SETTINGS),
        storageAdapter.get(KV_KEY_SUBS),
        storageAdapter.get(KV_KEY_PROFILES)
    ]);
    const settings = settingsData || {};
    const allMisubs = misubsData || [];
    const allProfiles = profilesData || [];

    // 自动迁移旧版 profile ID（去除 'profile_' 前缀）
    if (migrateProfileIds(allProfiles)) {
        storageAdapter.put(KV_KEY_PROFILES, allProfiles).catch(err =>
            console.error('[Migration] Failed to persist migrated profile IDs:', err)
        );
    }
    // 关键：我们在这里定义了 `config`，后续都应该使用它
    const config = migrateConfigSettings({ ...defaultSettings, ...settings });



    const isBrowser = isBrowserAgent(userAgentHeader);

    // [Debug Logging Logic]
    if (!env.workers) {
        console.log(`[MiSub Logic] isBrowser: ${isBrowser}, Disguise: ${config.disguise?.enabled}`);
    }

    const isAuthenticated = await authMiddleware(request, env);

    if (config.disguise?.enabled && isBrowser && !url.searchParams.has('callback_token') && !isAuthenticated) {
        // [Smart Camouflage]
        // If disguise is enabled and it's a browser request (not a known client),
        // show the disguise page unless the user is authenticated.
        return createDisguiseResponse(config.disguise, request.url);
    }

    const { token, profileIdentifier } = resolveRequestContext(url, config, allProfiles);

    // [Debug Logging Parse]
    if (!env.workers) {
        console.log(`[MiSub Parse] Token: ${token}, Profile: ${profileIdentifier}`);
    }
    const shouldSkipLogging = shouldSkipAccessLog(userAgentHeader);

    let targetMisubs;
    let subName = config.FileName;
    let effectiveSubConverter;
    let effectiveSubConfig;
    let isProfileExpired = false; // Moved declaration here
    let shouldUseEmoji = false;   // 是否在 subconverter 请求中启用 emoji

    const DEFAULT_EXPIRED_NODE = `trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#${encodeURIComponent('您的订阅已失效')}`;

    if (profileIdentifier) {
        // [修正] 使用 config 變量
        if (!token || token !== config.profileToken) {
            return new Response('Invalid Profile Token', { status: 403 });
        }
        const profile = allProfiles.find(p => (p.customId && p.customId === profileIdentifier) || p.id === profileIdentifier);
        if (profile && profile.enabled) {
            // Check if the profile has an expiration date and if it's expired
            if (profile.expiresAt) {
                const expiryDate = new Date(profile.expiresAt);
                const now = new Date();
                if (now > expiryDate) {
                    isProfileExpired = true;
                }
            }

            if (isProfileExpired) {
                subName = profile.name; // Still use profile name for filename
                targetMisubs = [{ id: 'expired-node', url: DEFAULT_EXPIRED_NODE, name: '您的订阅已到期', isExpiredNode: true }]; // Set expired node as the only targetMisub
            } else {
                subName = profile.name;
                targetMisubs = [];
                // Create a map for quick lookup
                const misubMap = new Map(allMisubs.map(item => [item.id, item]));

                // 1. Add subscriptions in order defined by profile
                const profileSubIds = profile.subscriptions || [];
                if (Array.isArray(profileSubIds)) {
                    profileSubIds.forEach(id => {
                        const sub = misubMap.get(id);
                        if (sub && sub.enabled && typeof sub.url === 'string' && sub.url.startsWith('http')) {
                            targetMisubs.push(sub);
                        }
                    });
                }

                // 2. Add manual nodes in order defined by profile
                const profileNodeIds = profile.manualNodes || [];
                if (Array.isArray(profileNodeIds)) {
                    profileNodeIds.forEach(id => {
                        const node = misubMap.get(id);
                        if (node && node.enabled && typeof node.url === 'string' && !node.url.startsWith('http')) {
                            targetMisubs.push(node);
                        }
                    });
                }
            }
            effectiveSubConverter = profile.subConverter && profile.subConverter.trim() !== '' ? profile.subConverter : config.subConverter;
            effectiveSubConfig = profile.subConfig && profile.subConfig.trim() !== '' ? profile.subConfig : config.subConfig;

            // 判断是否需要在 subconverter 中启用 emoji：使用回退逻辑（订阅组 > 全局 > 默认）
            const defaultTemplate = '{emoji}{region}-{protocol}-{index}';
            const globalNodeTransform = config.defaultNodeTransform || {};
            const profileNodeTransform = profile.nodeTransform ?? null;
            const hasProfileNodeTransform =
                profileNodeTransform && Object.keys(profileNodeTransform).length > 0;

            // 确定有效的 nodeTransform 配置（全局 vs 订阅组完整覆盖）
            const effectiveTransform = hasProfileNodeTransform
                ? profileNodeTransform
                : globalNodeTransform;

            const userTemplate = effectiveTransform?.rename?.template?.template || defaultTemplate;
            const templateEnabled = effectiveTransform?.enabled && effectiveTransform?.rename?.template?.enabled;
            shouldUseEmoji = templateEnabled && userTemplate.includes('{emoji}');

            // [新增] 增加订阅组下载计数
            // 仅在非回调请求时及非内部请求时增加计数(避免重复计数)
            // 且仅当开启访问日志时才计数
            if (!url.searchParams.has('callback_token') && !shouldSkipLogging && config.enableAccessLog) {
                try {
                    // 初始化下载计数(如果不存在)
                    if (typeof profile.downloadCount !== 'number') {
                        profile.downloadCount = 0;
                    }
                    // 增加计数
                    profile.downloadCount += 1;

                    // 更新存储中的订阅组数据
                    const updatedProfiles = allProfiles.map(p =>
                        ((p.customId && p.customId === profileIdentifier) || p.id === profileIdentifier)
                            ? profile
                            : p
                    );

                    // 异步保存,不阻塞响应
                    context.waitUntil(
                        storageAdapter.put(KV_KEY_PROFILES, updatedProfiles)
                            .catch(err => console.error('[Download Count] Failed to update:', err))
                    );

                } catch (err) {
                    // 计数失败不影响订阅服务
                    console.error('[Download Count] Error:', err);
                }
            }
        } else {
            return new Response('Profile not found or disabled', { status: 404 });
        }
    } else {
        // [修正] 使用 config 變量
        if (!token || token !== config.mytoken) {
            return new Response('Invalid Token', { status: 403 });
        }
        targetMisubs = allMisubs.filter(s => s.enabled);
        // [修正] 使用 config 變量
        effectiveSubConverter = config.subConverter;
        effectiveSubConfig = config.subConfig;
    }

    if (!effectiveSubConverter || effectiveSubConverter.trim() === '') {
        return new Response('Subconverter backend is not configured.', { status: 500 });
    }

    const shouldSkipCertificateVerify = Boolean(config.subConverterScv);
    const shouldSkipCertificateVerifyLoon = config.builtinLoonSkipCertVerify === true;
    const shouldEnableUdp = Boolean(config.subConverterUdp);

    // 使用统一的确定目标格式的方法（此方法中包含了处理各类客户端如 Surge 等对应版本的最新支持规则）
    let targetFormat = determineTargetFormat(userAgentHeader, url.searchParams);

    // [Access Log] Record access log and stats if enabled
    if (!url.searchParams.has('callback_token') && !shouldSkipLogging && config.enableAccessLog) {
        // [Log Deduplication]
        // Removed the premature LogService.addLog here.
        // We will pass the log metadata to generateCombinedNodeList (or log manually for cache hits)
        // to ensure we have the correct stats and avoid duplicates.
    }

    let prependedContentForSubconverter = '';

    if (isProfileExpired) { // Use the flag set earlier
        prependedContentForSubconverter = ''; // Expired node is now in targetMisubs
    } else {
        // Otherwise, add traffic remaining info if applicable
        const totalRemainingBytes = targetMisubs.reduce((acc, sub) => {
            if (sub.enabled && sub.userInfo && sub.userInfo.total > 0) {
                const used = (sub.userInfo.upload || 0) + (sub.userInfo.download || 0);
                const remaining = sub.userInfo.total - used;
                return acc + Math.max(0, remaining);
            }
            return acc;
        }, 0);
        if (config.enableTrafficNode !== false && totalRemainingBytes > 0) {
            const formattedTraffic = formatBytes(totalRemainingBytes);
            const fakeNodeName = `流量剩余 ≫ ${formattedTraffic}`;
            prependedContentForSubconverter = `trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#${encodeURIComponent(fakeNodeName)}`;
        }
    }

    // === 缓存机制：快速响应客户端请求 ===
    const cacheKey = generateCacheKey(
        profileIdentifier ? 'profile' : 'token',
        profileIdentifier || token
    );

    // 检查是否强制刷新（通过 URL 参数）
    const forceRefresh = url.searchParams.has('refresh') || url.searchParams.has('nocache');

    // 定义刷新函数（用于后台刷新）
    const refreshNodes = async (isBackground = false) => {
        const isDebugToken = (token === 'b0b422857bb46aba65da8234c84f38c6');
        // 组合节点列表
        // 传递 context 对象以获取请求信息用于日志记录
        context.startTime = Date.now();

        // Prepare log metadata to pass down
        const clientIp = request.headers.get('CF-Connecting-IP')
            || request.headers.get('X-Real-IP')
            || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
            || 'N/A';
        const country = request.headers.get('CF-IPCountry') || 'N/A';
        const domain = url.hostname;

        context.logMetadata = {
            clientIp,
            geoInfo: { country, city: request.cf?.city, isp: request.cf?.asOrganization, asn: request.cf?.asn },
            format: targetFormat,
            token: profileIdentifier ? (profileIdentifier) : token,
            type: profileIdentifier ? 'profile' : 'token',
            domain
        };

        const currentProfile = profileIdentifier ? allProfiles.find(p => (p.customId && p.customId === profileIdentifier) || p.id === profileIdentifier) : null;

        // 设置优先级：订阅组设置 > 全局设置 > 内置默认值
        // prefixSettings 回退逻辑
        const globalPrefixSettings = config.defaultPrefixSettings || {};
        const profilePrefixSettings = currentProfile?.prefixSettings || null;
        const effectivePrefixSettings = { ...globalPrefixSettings };

        if (profilePrefixSettings && typeof profilePrefixSettings === 'object') {
            if (profilePrefixSettings.enableManualNodes !== null && profilePrefixSettings.enableManualNodes !== undefined) {
                effectivePrefixSettings.enableManualNodes = profilePrefixSettings.enableManualNodes;
            }
            if (profilePrefixSettings.enableSubscriptions !== null && profilePrefixSettings.enableSubscriptions !== undefined) {
                effectivePrefixSettings.enableSubscriptions = profilePrefixSettings.enableSubscriptions;
            }
            if (profilePrefixSettings.manualNodePrefix && profilePrefixSettings.manualNodePrefix.trim() !== '') {
                effectivePrefixSettings.manualNodePrefix = profilePrefixSettings.manualNodePrefix;
            }
        }

        // nodeTransform 回退逻辑
        const globalNodeTransform = config.defaultNodeTransform || {};
        const profileNodeTransform = currentProfile?.nodeTransform ?? null;
        const hasProfileNodeTransform =
            profileNodeTransform && Object.keys(profileNodeTransform).length > 0;

        // nodeTransform 使用整体覆盖逻辑
        const effectiveNodeTransform = hasProfileNodeTransform
            ? profileNodeTransform
            : globalNodeTransform;

        const generationSettings = {
            ...effectivePrefixSettings,
            nodeTransform: effectiveNodeTransform,
            name: subName
        };

        const freshNodes = await generateCombinedNodeList(
            context, // 传入完整 context
            { ...config, enableAccessLog: false }, // [Deferred Logging] Disable service-side logging, we will log manually in handler
            userAgentHeader,
            targetMisubs,
            prependedContentForSubconverter,
            generationSettings,
            isDebugToken,
            shouldSkipCertificateVerify
        );
        const sourceNames = targetMisubs
            .filter(s => typeof s?.url === 'string' && s.url.startsWith('http'))
            .map(s => s.name || s.url);
        await setCache(storageAdapter, cacheKey, freshNodes, sourceNames);
        return freshNodes;
    };

    const { combinedNodeList, cacheHeaders } = await resolveNodeListWithCache({
        storageAdapter,
        cacheKey,
        forceRefresh,
        refreshNodes,
        context,
        targetMisubsCount: targetMisubs.length
    });

    if (!env.workers) {
        console.log(`[MiSub Nodes] Count/Length: ${combinedNodeList ? combinedNodeList.length : 0}`);
    }

    const domain = url.hostname;

    if (targetFormat === 'base64') {
        let contentToEncode;
        if (isProfileExpired) {
            contentToEncode = DEFAULT_EXPIRED_NODE + '\n';
        } else {
            contentToEncode = combinedNodeList;
        }
        const headers = { "Content-Type": "text/plain; charset=utf-8", 'Cache-Control': 'no-store, no-cache' };
        Object.entries(cacheHeaders).forEach(([key, value]) => {
            headers[key] = value;
        });

        // [Deferred Logging] Log Success for Base64 (Direct Return)
        if (!url.searchParams.has('callback_token') && !shouldSkipLogging) {
            // 发送 Telegram 通知（独立于访问日志开关，只需配置 BotToken 和 ChatID）
            const clientIp = request.headers.get('CF-Connecting-IP')
                || request.headers.get('X-Real-IP')
                || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
                || 'N/A';
            context.waitUntil(
                sendEnhancedTgNotification(
                    config,
                    '🛰️ *订阅被访问*',
                    clientIp,
                    `*域名:* \`${domain}\`\n*客户端:* \`${userAgentHeader}\`\n*请求格式:* \`${targetFormat}\`\n*订阅组:* \`${subName}\``
                )
            );

            // 访问日志（需要 enableAccessLog 开关）
            if (config.enableAccessLog) {
                logAccessSuccess({
                    context,
                    env,
                    request,
                    userAgentHeader,
                    targetFormat,
                    token,
                    profileIdentifier,
                    subName,
                    domain
                });
            }
        }

        return new Response(btoa(unescape(encodeURIComponent(contentToEncode))), { headers });
    }

    const base64Content = btoa(unescape(encodeURIComponent(combinedNodeList)));

    const callbackToken = await getCallbackToken(env);
    const callbackPath = profileIdentifier ? `/${token}/${profileIdentifier}` : `/${token}`;
    const publicBaseUrl = getPublicBaseUrl(env, url);
    const callbackUrl = `${publicBaseUrl.origin}${callbackPath}?target=base64&callback_token=${callbackToken}`;

    // [Debug Logging for Docker/Zeabur]
    if (!env.workers) { // 简单判断非 Workers 环境（Docker 环境通常没有 env.workers 属性，或者可以凭其他特征判断）
        console.log(`[MiSub Debug] Profile: ${profileIdentifier}, Token: ${token}`);
        console.log(`[MiSub Debug] Callback URL: ${callbackUrl}`);
    }
    if (url.searchParams.get('callback_token') === callbackToken) {
        const headers = { "Content-Type": "text/plain; charset=utf-8", 'Cache-Control': 'no-store, no-cache' };
        return new Response(base64Content, { headers });
    }

    // [新增] 内置 Clash 生成器 - 当 builtin=1 或 builtin=clash 时使用
    // 优势：完整保留 dialer-proxy、reality-opts 等特殊参数
    const useBuiltinClash = url.searchParams.get('builtin') === '1' ||
        url.searchParams.get('builtin') === 'clash' ||
        url.searchParams.get('native') === '1';

    if (useBuiltinClash && targetFormat === 'clash') {
        try {
            const clashConfig = generateBuiltinClashConfig(combinedNodeList, {
                fileName: subName,
                enableUdp: shouldEnableUdp,
                skipCertVerify: shouldSkipCertificateVerify
            });

            const responseHeaders = new Headers({
                "Content-Disposition": `attachment; filename*=utf-8''${encodeURIComponent(subName)}`,
                'Content-Type': 'text/yaml; charset=utf-8',
                'Cache-Control': 'no-store, no-cache',
                'X-MiSub-Mode': 'builtin-clash'
            });

            // 添加缓存状态头
            Object.entries(cacheHeaders).forEach(([key, value]) => {
                responseHeaders.set(key, value);
            });

            // 发送通知和日志
            if (!url.searchParams.has('callback_token') && !shouldSkipLogging) {
                const clientIp = request.headers.get('CF-Connecting-IP')
                    || request.headers.get('X-Real-IP')
                    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
                    || 'N/A';
                context.waitUntil(
                    sendEnhancedTgNotification(
                        config,
                        '🛰️ *订阅被访问* (内置转换)',
                        clientIp,
                        `*域名:* \`${domain}\`\n*客户端:* \`${userAgentHeader}\`\n*请求格式:* \`${targetFormat}\`\n*订阅组:* \`${subName}\``
                    )
                );

                if (config.enableAccessLog) {
                    logAccessSuccess({
                        context,
                        env,
                        request,
                        userAgentHeader,
                        targetFormat: 'clash (builtin)',
                        token,
                        profileIdentifier,
                        subName,
                        domain
                    });
                }
            }

            return new Response(clashConfig, { headers: responseHeaders });
        } catch (e) {
            console.error('[BuiltinClash] Generation failed:', e);
            // 回退到 subconverter
        }
    }

    // [修改] 内置 Surge 生成器 - 仅在显式请求时使用，默认走 subconverter
    const useBuiltinSurge = url.searchParams.get('builtin') === '1' ||
        url.searchParams.get('builtin') === 'surge' ||
        url.searchParams.get('native') === '1';


    const buildBuiltinSurgeResponse = () => {
        const publicBaseUrl = getPublicBaseUrl(env, url);
        const callbackPath = profileIdentifier ? `/${token}/${profileIdentifier}` : `/${token}`;
        const managedUrl = `${publicBaseUrl.origin}${callbackPath}?surge`;

        const surgeConfig = generateBuiltinSurgeConfig(combinedNodeList, {
            fileName: subName,
            managedConfigUrl: managedUrl,
            skipCertVerify: shouldSkipCertificateVerify,
            enableUdp: shouldEnableUdp
        });

        const responseHeaders = new Headers({
            "Content-Disposition": `attachment; filename*=utf-8''${encodeURIComponent(subName)}`,
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store, no-cache',
            'X-MiSub-Mode': 'builtin-surge'
        });

        Object.entries(cacheHeaders).forEach(([key, value]) => {
            responseHeaders.set(key, value);
        });

        if (!url.searchParams.has('callback_token') && !shouldSkipLogging) {
            const clientIp = request.headers.get('CF-Connecting-IP')
                || request.headers.get('X-Real-IP')
                || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
                || 'N/A';
            context.waitUntil(
                sendEnhancedTgNotification(
                    config,
                    '🛰️ *订阅被访问* (内置Surge转换)',
                    clientIp,
                    `*域名:* \`${domain}\`\n*客户端:* \`${userAgentHeader}\`\n*请求格式:* \`${targetFormat}\`\n*订阅组:* \`${subName}\``
                )
            );

            if (config.enableAccessLog) {
                logAccessSuccess({
                    context,
                    env,
                    request,
                    userAgentHeader,
                    targetFormat: 'surge (builtin)',
                    token,
                    profileIdentifier,
                    subName,
                    domain
                });
            }
        }

        return new Response(surgeConfig, { headers: responseHeaders });
    };

    if (useBuiltinSurge && targetFormat.startsWith('surge')) {
        try {
            return buildBuiltinSurgeResponse();
        } catch (e) {
            console.error('[BuiltinSurge] Generation failed, falling back to subconverter:', e);
            // 回退到 subconverter
        }
    }

    const useBuiltinLoon = url.searchParams.get('builtin') === '1' ||
        url.searchParams.get('builtin') === 'loon' ||
        url.searchParams.get('native') === '1';

    const buildBuiltinLoonResponse = () => {
        const publicBaseUrl = getPublicBaseUrl(env, url);
        const callbackPath = profileIdentifier ? `/${token}/${profileIdentifier}` : `/${token}`;
        const managedUrl = `${publicBaseUrl.origin}${callbackPath}?loon`;

        const loonConfig = generateBuiltinLoonConfig(combinedNodeList, {
            fileName: subName,
            managedConfigUrl: managedUrl,
            interval: config.UpdateInterval || 86400,
            skipCertVerify: shouldSkipCertificateVerifyLoon
        });

        const responseHeaders = new Headers({
            "Content-Disposition": `attachment; filename*=utf-8''${encodeURIComponent(subName)}`,
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store, no-cache',
            'X-MiSub-Mode': 'builtin-loon'
        });

        Object.entries(cacheHeaders).forEach(([key, value]) => {
            responseHeaders.set(key, value);
        });

        if (!url.searchParams.has('callback_token') && !shouldSkipLogging) {
            const clientIp = request.headers.get('CF-Connecting-IP')
                || request.headers.get('X-Real-IP')
                || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
                || 'N/A';
            context.waitUntil(
                sendEnhancedTgNotification(
                    config,
                    '🛰️ *订阅被访问* (内置Loon转换)',
                    clientIp,
                    `*域名:* \`${domain}\`\n*客户端:* \`${userAgentHeader}\`\n*请求格式:* \`${targetFormat}\`\n*订阅组:* \`${subName}\``
                )
            );

            if (config.enableAccessLog) {
                logAccessSuccess({
                    context,
                    env,
                    request,
                    userAgentHeader,
                    targetFormat: 'loon (builtin)',
                    token,
                    profileIdentifier,
                    subName,
                    domain
                });
            }
        }

        return new Response(loonConfig, { headers: responseHeaders });
    };

    // [新增] 内置 Loon 生成器 - 仅在显式请求时使用，默认走 subconverter
    if (useBuiltinLoon && targetFormat === 'loon') {
        try {
            return buildBuiltinLoonResponse();
        } catch (e) {
            console.error('[BuiltinLoon] Generation failed, falling back to subconverter:', e);
            // 回退到 subconverter
        }
    }

    const candidates = getSubconverterCandidates(effectiveSubConverter);
    let lastError = null;

    try {
        // [New Implementation] Use centralized client
        const result = await fetchFromSubconverter(candidates, {
            targetFormat,
            callbackUrl,
            subConfig: effectiveSubConfig,
            subName,
            cacheHeaders,
            enableScv: shouldSkipCertificateVerify,
            enableUdp: shouldEnableUdp,
            enableEmoji: shouldUseEmoji,
            timeout: 30000 // 30s timeout
        });

        // [Success Logic]
        if (!url.searchParams.has('callback_token') && !shouldSkipLogging) {
            const clientIp = request.headers.get('CF-Connecting-IP')
                || request.headers.get('X-Real-IP')
                || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
                || 'N/A';
            context.waitUntil(
                sendEnhancedTgNotification(
                    config,
                    '🛰️ *订阅被访问*',
                    clientIp,
                    `*域名:* \`${domain}\`\n*客户端:* \`${userAgentHeader}\`\n*请求格式:* \`${targetFormat}\`\n*订阅组:* \`${subName}\``
                )
            );

            if (config.enableAccessLog) {
                logAccessSuccess({
                    context,
                    env,
                    request,
                    userAgentHeader,
                    targetFormat,
                    token,
                    profileIdentifier,
                    subName,
                    domain
                });
            }
        }

        return result.response;

    } catch (e) {
        lastError = e;
        console.error('[MiSub] Subconverter call failed:', e);
        // Surge 内置兜底
        if (targetFormat.startsWith('surge') && !useBuiltinSurge) {
            try {
                return buildBuiltinSurgeResponse();
            } catch (fallbackError) {
                console.error('[BuiltinSurge] Fallback generation failed:', fallbackError);
            }
        }
        // Loon 内置兜底
        if (targetFormat === 'loon' && !useBuiltinLoon) {
            try {
                return buildBuiltinLoonResponse();
            } catch (fallbackError) {
                console.error('[BuiltinLoon] Fallback generation failed:', fallbackError);
            }
        }
    }

    // 净化错误信息（移除换行符和双引号），防止 header 异常和 YAML 语法错误
    const safeErrorMessage = (lastError ? lastError.message : 'Unknown subconverter error')
        .replace(/[\r\n]+/g, ' ')
        .replace(/"/g, "'")
        .trim();
    console.error(`[MiSub Final Error] ${safeErrorMessage}`);

    // [Deferred Logging] Log Error for Subconverter Failures (Timeout/Error)
    if (!url.searchParams.has('callback_token') && !shouldSkipLogging && config.enableAccessLog) {
        logAccessError({
            context,
            env,
            request,
            userAgentHeader,
            targetFormat,
            token,
            profileIdentifier,
            subName,
            domain,
            errorMessage: safeErrorMessage
        });
    }

    // 提供回退的 Base64 输出，避免客户端直接收到 502
    if (combinedNodeList) {
        const fallbackHeaders = new Headers({
            "Content-Type": "text/plain; charset=utf-8",
            'Cache-Control': 'no-store, no-cache',
            'X-MiSub-Fallback': 'base64'
        });

        // 保留缓存状态提示，便于客户端诊断
        Object.entries(cacheHeaders).forEach(([key, value]) => {
            fallbackHeaders.set(key, value);
        });

        // 附带简短错误信息，防止 header 过长
        fallbackHeaders.set('X-MiSub-Error', safeErrorMessage.slice(0, 200));

        // [Fallback Success] 也发送 Telegram 通知，因为用户仍获取了订阅内容
        if (!url.searchParams.has('callback_token') && !shouldSkipLogging) {
            const clientIp = request.headers.get('CF-Connecting-IP')
                || request.headers.get('X-Real-IP')
                || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
                || 'N/A';
            context.waitUntil(
                sendEnhancedTgNotification(
                    config,
                    '🛰️ *订阅被访问* (Fallback)',
                    clientIp,
                    `*域名:* \`${domain}\`\n*客户端:* \`${userAgentHeader}\`\n*请求格式:* \`base64\`\n*订阅组:* \`${subName}\`\n*错误:* \`${safeErrorMessage}\``
                )
            );
        }

        // [Improved Fallback] 为不同客户端提供更友好的错误展示
        // [Improved Fallback] 为不同客户端提供更友好的错误展示
        if (targetFormat === 'clash') {
            const fallbackYaml = `
proxies:
  - name: "❌ 生成失败: ${safeErrorMessage.slice(0, 50).replace(/:/g, ' ')}"
    type: trojan
    server: 127.0.0.1
    port: 443
    password: error
    sni: error.com
    skip-cert-verify: true
    udp: false

proxy-groups:
  - name: "⚠️ 错误节点"
    type: select
    proxies:
      - "❌ 生成失败: ${safeErrorMessage.slice(0, 50).replace(/:/g, ' ')}"

rules:
  - MATCH,DIRECT
`;
            return new Response(fallbackYaml, {
                headers: {
                    "Content-Type": "text/yaml; charset=utf-8",
                    'Cache-Control': 'no-store, no-cache',
                    'X-MiSub-Fallback': 'yaml',
                    'X-MiSub-Error': safeErrorMessage.slice(0, 200)
                },
                status: 200
            });
        }

        if (targetFormat.startsWith('surge') || targetFormat === 'loon') {
            const fallbackIni = `
[Proxy]
❌ 生成失败 = trojan, 127.0.0.1, 443, password=error, skip-cert-verify=true

[Proxy Group]
⚠️ 错误节点 = select, ❌ 生成失败

[Rule]
MATCH,DIRECT
`;
            return new Response(fallbackIni.trim() + '\n', {
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    'Cache-Control': 'no-store, no-cache',
                    'X-MiSub-Fallback': 'ini',
                    'X-MiSub-Error': safeErrorMessage.slice(0, 200)
                },
                status: 200
            });
        }

        const fallbackContent = btoa(unescape(encodeURIComponent(combinedNodeList)));
        return new Response(fallbackContent, { headers: fallbackHeaders, status: 200 });
    }

    return new Response(`Error connecting to subconverter: ${safeErrorMessage}`, { status: 502 });
}
