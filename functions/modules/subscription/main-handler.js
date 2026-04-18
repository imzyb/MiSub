import { StorageFactory } from '../../storage-adapter.js';
import { migrateConfigSettings, formatBytes, migrateProfileIds, base64EncodeUtf8 } from '../utils.js';
import { generateCombinedNodeList } from '../../services/subscription-service.js';
import { sendEnhancedTgNotification, tgEscape } from '../notifications.js';
import { KV_KEY_SUBS, KV_KEY_PROFILES, KV_KEY_SETTINGS, DEFAULT_SETTINGS as defaultSettings } from '../config.js';
import { createDisguiseResponse } from '../disguise-page.js';
import { generateCacheKey, setCache } from '../../services/node-cache-service.js';
import { resolveRequestContext } from './request-context.js';
import { resolveNodeListWithCache } from './cache-manager.js';
import { ProcessorService } from '../../services/processor-service.js';
import { logAccessSuccess, shouldSkipLogging as shouldSkipAccessLog } from './access-logger.js';
import { isBrowserAgent, determineTargetFormat, isMetaCore } from './user-agent-utils.js'; // [Added] Import centralized util
import { authMiddleware } from '../auth-middleware.js';
import { transformBuiltinSubscription } from './transformer-factory.js';
import { fetchTransformTemplate } from './transform-template-cache.js';
import { buildTransformTemplateContext, renderTransformTemplate } from './transform-template-renderer.js';
import { groupNodeLinesByRegion } from './region-groups.js';
import { groupNodeLinesByProtocol } from './protocol-groups.js';
import { shouldApplyExternalTemplateForTarget } from './template-compatibility.js';
import { renderClashFromIniTemplate, renderLoonFromIniTemplate, renderQuanxFromIniTemplate, renderSingboxFromIniTemplate, renderSurgeFromIniTemplate } from './template-pipeline.js';
import { getBuiltinTemplate } from './builtin-template-registry.js';

const PROFILE_DOWNLOAD_COUNT_PREFIX = 'misub_profile_download_count_';

function getProfileDownloadCountKey(profile) {
    return `${PROFILE_DOWNLOAD_COUNT_PREFIX}${profile.customId || profile.id}`;
}

function buildTemplateProxyBlock(nodeList) {
    return nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .join('\n');
}

function extractProxySectionFromBuiltin(content, targetFormat) {
    if (typeof content !== 'string' || content.trim() === '') return '';

    if (targetFormat === 'clash') {
        const match = content.match(/proxies:\s*\n([\s\S]*?)\n\nproxy-groups:/i);
        return match ? match[1].trim() : '';
    }

    if (targetFormat.startsWith('surge') || targetFormat === 'loon' || targetFormat === 'quanx') {
        const match = content.match(/\[Proxy\]\s*\n([\s\S]*?)(?:\n\n\[|$)/i);
        if (!match) return '';
        return match[1]
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !/^DIRECT\s*=\s*direct$/i.test(line))
            .join('\n');
    }

    if (targetFormat === 'singbox' || targetFormat === 'sing-box') {
        try {
            const config = JSON.parse(content);
            if (config.outbounds && Array.isArray(config.outbounds)) {
                // 过滤掉 direct, block, dns-out 等元 outbound
                const proxies = config.outbounds.filter(o => 
                    o.type !== 'direct' && o.type !== 'block' && o.type !== 'dns'
                );
                return JSON.stringify(proxies, null, 2);
            }
        } catch {
            return '';
        }
    }

    return '';
}

export function buildManagedConfigUrl(requestUrl) {
    const managedUrl = new URL(requestUrl);
    managedUrl.searchParams.delete('refresh');
    managedUrl.searchParams.delete('nocache');
    return managedUrl.toString();
}

export function resolveTemplateUrl(mode, value, fallbackUrl = '') {
    const normalizedMode = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    const normalizedFallback = typeof fallbackUrl === 'string' ? fallbackUrl.trim() : '';

    if (normalizedMode === 'builtin') return '';
    if (normalizedMode === 'global') return normalizedFallback;
    if (normalizedMode === 'preset' || normalizedMode === 'custom') return normalizedValue;

    return normalizedValue;
}

export function resolveTemplateSource(value) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue) return { kind: 'none', value: '' };
    if (normalizedValue.startsWith('builtin:')) {
        return { kind: 'builtin', value: normalizedValue.slice('builtin:'.length) };
    }
    return { kind: 'remote', value: normalizedValue };
}

/**
 * 处理MiSub订阅请求
 * @param {Object} context - Cloudflare上下文
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleMisubRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userAgentHeader = request.headers.get('User-Agent') || "Unknown";

    console.log(`\n[MiSub Request] ${request.method} ${url.pathname}${url.search}`);
    console.log(`[MiSub UA] ${userAgentHeader}`);

    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
    const [settingsData, allMisubs, allProfiles] = await Promise.all([
        storageAdapter.get(KV_KEY_SETTINGS),
        storageAdapter.getAllSubscriptions(),
        storageAdapter.getAllProfiles()
    ]);
    const settings = settingsData || {};

    // 自动迁移旧版 profile ID（去除 'profile_' 前缀）
    if (migrateProfileIds(allProfiles)) {
        storageAdapter.put(KV_KEY_PROFILES, allProfiles).catch(err =>
            console.error('[Migration] Failed to persist migrated profile IDs:', err)
        );
    }
    // 关键：我们在这里定义了 `config`，后续都应该使用它
    const config = migrateConfigSettings({ ...defaultSettings, ...settings });
    context.accessLogPersistenceMode = config.accessLogPersistenceMode || 'light';

    // [Subconverter API] 提取 URL 控制参数，用于覆盖默认设置
    const urlInclude = url.searchParams.get('include');
    const urlExclude = url.searchParams.get('exclude');
    const urlRename = url.searchParams.get('rename');
    const urlEmoji = url.searchParams.get('emoji'); // true/false
    const urlUdp = url.searchParams.get('udp');     // true/false
    const urlTfo = url.searchParams.get('tfo');     // true/false
    const urlScv = url.searchParams.get('scv');     // true/false (skip-cert-verify)
    const urlList = url.searchParams.get('list') === 'true';

    const isBrowser = isBrowserAgent(userAgentHeader);

    console.log(`[MiSub Logic] isBrowser: ${isBrowser}, Disguise: ${config.disguise?.enabled}`);

    const isAuthenticated = await authMiddleware(request, env);

    if (config.disguise?.enabled && isBrowser && !url.searchParams.has('callback_token') && !isAuthenticated) {
        // [Smart Camouflage]
        // If disguise is enabled and it's a browser request (not a known client),
        // show the disguise page unless the user is authenticated.
        return createDisguiseResponse(config.disguise, request.url);
    }

    context.url = url; // [核心修复] 将 url 挂载到 context，确保后续服务能获取到 debug 参数
    const { token, profileIdentifier } = resolveRequestContext(url, config, allProfiles);

    console.log(`[MiSub Parse] Token: ${token}, Profile: ${profileIdentifier}`);
    const shouldSkipLogging = shouldSkipAccessLog(userAgentHeader);

    let targetMisubs;
    let subName = config.FileName;
    let isProfileExpired = false; // Moved declaration here

    const DEFAULT_EXPIRED_NODE = `trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#${encodeURIComponent('您的订阅已失效')}`;

    let currentProfile = null;

    if (profileIdentifier) {
        // [修正] 使用 config 變量
        if (!token || token !== config.profileToken) {
            return new Response('Invalid Profile Token', { status: 403 });
        }
        currentProfile = allProfiles.find(p => (p.customId && p.customId === profileIdentifier) || p.id === profileIdentifier);
        const profile = currentProfile;
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
                const relatedIds = [
                    ...(Array.isArray(profile.subscriptions) ? profile.subscriptions.map(item => typeof item === 'object' ? item.id : item) : []),
                    ...(Array.isArray(profile.manualNodes) ? profile.manualNodes : [])
                ].filter(Boolean);
                const relatedSubs = typeof storageAdapter.getSubscriptionsByIds === 'function'
                    ? await storageAdapter.getSubscriptionsByIds(Array.from(new Set(relatedIds)))
                    : allMisubs;
                const misubMap = new Map(relatedSubs.map(item => [item.id, item]));

                // 1. Add subscriptions in order defined by profile
                const profileSubIds = profile.subscriptions || [];
                if (Array.isArray(profileSubIds)) {
                    profileSubIds.forEach(item => {
                        // 支持两种格式：纯字符串 ID 或 带有覆盖配置的对象 { id, exclude, operators, ... }
                        const isObject = item && typeof item === 'object';
                        const id = isObject ? item.id : item;
                        
                        const baseSub = misubMap.get(id);
                        if (baseSub && baseSub.enabled && typeof baseSub.url === 'string' && baseSub.url.startsWith('http')) {
                            // 如果是对象，则合并覆盖配置（Profile 级别的设置优先级更高）
                            const sub = isObject ? { ...baseSub, ...item } : baseSub;
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
            // [新增] 增加订阅组下载计数
            // 仅在非回调请求时及非内部请求时增加计数(避免重复计数)
            // 且仅当开启访问日志时才计数
            if (!url.searchParams.has('callback_token') && !shouldSkipLogging && config.enableAccessLog) {
                try {
                    const downloadCountKey = getProfileDownloadCountKey(profile);
                    const currentCount = Number(await storageAdapter.get(downloadCountKey)) || 0;
                    context.waitUntil(
                        storageAdapter.put(downloadCountKey, currentCount + 1)
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
    }

    const shouldSkipCertificateVerify = Boolean(config.builtinSkipCertVerify);
    const shouldEnableUdp = Boolean(config.builtinEnableUdp);

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

    // [Subconverter Engine Selection] Priority: URL Parameter > Profile Settings > Global Settings
    const profileSub = currentProfile?.subconverter || {};
    const globalSub = config.subconverter || {};
    
    const builtinParam = (url.searchParams.get('builtin') || '').toLowerCase();
    const engineParam = (url.searchParams.get('engine') || '').toLowerCase();
    // [Optimization] Respect user defined engine mode while preventing loops for non-browser agents (backend fetchers)
    const defaultEngineMode = profileSub.engineMode || globalSub.engineMode || 'builtin';
    
    const effectiveEngine = engineParam || (builtinParam === 'external' ? 'external' : (builtinParam === 'true' ? 'builtin' : '')) || defaultEngineMode;
    const isExternalMode = effectiveEngine === 'external';
    const useBuiltin = !isExternalMode;

    
    const globalTemplateUrl = resolveTemplateUrl(config.transformConfigMode, config.transformConfig, '');
    const templateUrl = currentProfile
        ? resolveTemplateUrl(currentProfile.transformConfigMode, currentProfile.transformConfig, globalTemplateUrl)
        : globalTemplateUrl;
    const templateSource = resolveTemplateSource(templateUrl);

    // [逻辑统一] 规则等级：URL 参数 > 订阅组设置 > 全局设置 > 默认值 (std)
    // [重要变更] 如果使用了远程自定义配置 (templateSource.kind === 'remote')，则完全禁用内置等级 (强制为 none)
    const resolvedProfileLevel = currentProfile?.ruleLevel || currentProfile?.clashRuleLevel || '';
    const resolvedGlobalLevel = config.ruleLevel || config.clashRuleLevel || 'std';
    
    let ruleLevel;
    if (templateSource.kind === 'remote') {
        ruleLevel = 'none';
    } else {
        ruleLevel = url.searchParams.get('level') || url.searchParams.get('ruleLevel') || resolvedProfileLevel || resolvedGlobalLevel;
    }

    // === 缓存机制：快速响应客户端请求 ===
    const cacheKey = generateCacheKey(
        profileIdentifier ? 'profile' : 'token',
        profileIdentifier || token
    );

    // 检查是否强制刷新（通过 URL 参数）
    const forceRefresh = url.searchParams.has('refresh') || url.searchParams.has('nocache') || url.searchParams.has('debug');

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

        const activeProfile = profileIdentifier ? allProfiles.find(p => (p.customId && p.customId === profileIdentifier) || p.id === profileIdentifier) : null;

        // 设置优先级：订阅组设置 > 全局设置 > 内置默认值
        // prefixSettings 回退逻辑
        const globalPrefixSettings = config.defaultPrefixSettings || {};
        const profilePrefixSettings = activeProfile?.prefixSettings || null;
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
        const globalNodeTransformPresets = Array.isArray(config.nodeTransformPresets) ? config.nodeTransformPresets : [];
        const profileNodeTransform = activeProfile?.nodeTransform ?? null;
        const profileNodeTransformPresetId = activeProfile?.nodeTransformPresetId || '';
        const profilePresetNodeTransform = profileNodeTransformPresetId
            ? (globalNodeTransformPresets.find(item => item?.id === profileNodeTransformPresetId)?.config || null)
            : null;
        const hasProfileNodeTransform =
            profileNodeTransform && Object.keys(profileNodeTransform).length > 0;

        // nodeTransform 使用整体覆盖逻辑
        const effectiveNodeTransform = hasProfileNodeTransform
            ? profileNodeTransform
            : profilePresetNodeTransform
            || globalNodeTransform;

        const generationSettings = {
            ...effectivePrefixSettings,
            nodeTransform: { ...effectiveNodeTransform },
            name: subName,
            operators: Array.isArray(activeProfile?.operators) ? [...activeProfile.operators] : [],
            exclude: urlExclude || activeProfile?.exclude,
            include: urlInclude || activeProfile?.include
        };

        // [Subconverter API] 动态注入更名算子 (rename=old@new|A@B)
        if (urlRename) {
            const renameGroups = urlRename.split('|');
            renameGroups.forEach(group => {
                const [regex, replace] = group.split('@');
                if (regex) {
                    generationSettings.operators.push({
                        type: 'rename',
                        enabled: true,
                        params: {
                            regex: {
                                enabled: true,
                                rules: [{
                                    pattern: regex,
                                    replacement: replace || '',
                                    flags: 'gi'
                                }]
                            }
                        }
                    });
                }
            });
        }

        // [Subconverter API] 控制 Emoji 注入
        if (urlEmoji === 'false') {
            generationSettings.nodeTransform.addFlagEmoji = false;
            generationSettings.nodeTransform.removeFlagEmoji = true;
        } else if (urlEmoji === 'true') {
            generationSettings.nodeTransform.addFlagEmoji = true;
        }

        const freshNodes = await generateCombinedNodeList(
            context, // 传入完整 context
            { ...config, enableAccessLog: false }, // [Deferred Logging] Disable service-side logging, we will log manually in handler
            userAgentHeader,
            targetMisubs,
            prependedContentForSubconverter,
            {
                ...generationSettings,
                // [强制透传] 确保 ruleLevel 在订阅组内能够生效
                ruleLevel: ruleLevel || generationSettings.ruleLevel
            }
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

    console.log(`[MiSub Nodes] Count/Length: ${combinedNodeList ? combinedNodeList.length : 0}`);

    const domain = url.hostname;

    // [Support] External Subconverter Logic
    // 1. If 'nodes' format requested, return plain text nodes (DataSource for external converters)
    if (targetFormat === 'nodes') {
        const contentToReturn = isProfileExpired ? (DEFAULT_EXPIRED_NODE + '\n') : combinedNodeList;
        // [兼容性优化] 第三方转换后端对明文列表的支持通常比 Base64 更好。
        // 同时对于 Cloudflare 而言，明文输出更有利于其边缘节点的流式处理。
        return new Response(contentToReturn, { 
            headers: { 
                "Content-Type": "text/plain; charset=utf-8", 
                'Cache-Control': 'no-store, no-cache',
                'X-MiSub-Mode': 'node-export-plain'
            } 
        });
    }

    // 2. If external mode active, build the redirect URL and return 302
    if (isExternalMode && targetFormat !== 'base64') {
        let backend = url.searchParams.get('backend') || profileSub.backend || globalSub.defaultBackend || "https://sub.id9.cc/sub?";
        
        // [加固] 防止 UI 标签泄漏到配置中
        if (typeof backend === 'string' && (backend.includes('后端') || backend.includes('参数'))) {
            backend = "https://subapi.cmliussss.net/sub?";
        }

        // [自动纠错] 如果地址不带 http/https 协议，自动补全
        if (backend && typeof backend === 'string' && !backend.startsWith('http://') && !backend.startsWith('https://')) {
            backend = 'http://' + backend;
        }

        const externalUrl = new URL(backend);

        // [Fix] Automatically append '/sub' if the backend URL only has a root path.
        // Most subconverter backends (FatSheep, subapi, etc.) use /sub as the conversion endpoint.
        if (externalUrl.pathname === '/' || !externalUrl.pathname) {
            externalUrl.pathname = '/sub';
        }
        // [优化] 解析 targetFormat，支持带参数的格式（如 surge&ver=4）
        const [targetBase, ...targetParams] = targetFormat.split('&');
        externalUrl.searchParams.set('target', targetBase);
        targetParams.forEach(p => {
            const [k, v] = p.split('=');
            if (k && v) externalUrl.searchParams.set(k, v);
        });
        
        // Data source is THIS worker, but forcing builtin and nodes format
        const dataSourceUrl = new URL(request.url);
        
        // [加固] 彻底清理 URL 参数，防止参数污染导致后端返回 400 错误
        // [优化] 不再强制注入 target=nodes，因为非浏览器请求已默认使用内置引擎
        // [关键] 显式注入 builtin=true 确保后端拉取数据时强制走内置逻辑，打破重定向环
        const paramsToClear = ['target', 'engine', 'builtin', 'clash', 'singbox', 'surge', 'loon', 'quanx', 'egern', 'base64', 'v2ray', 'trojan', 'list', 'include', 'exclude'];
        paramsToClear.forEach(p => dataSourceUrl.searchParams.delete(p));
        dataSourceUrl.searchParams.set('builtin', 'true');

        // [关键修复] 确保后端拉取数据时包含身份令牌
        // 只有当 URL 路径中不包含令牌时，才在查询参数中显式注入
        const pathSegments = dataSourceUrl.pathname.split('/').filter(Boolean);
        const hasTokenInPath = pathSegments.some(seg => seg === config.mytoken || seg === config.profileToken);

        if (!hasTokenInPath && !dataSourceUrl.searchParams.has('token')) {
            const authToken = token || currentProfile?.token || config.mytoken;
            if (authToken) dataSourceUrl.searchParams.set('token', authToken);
        }

        externalUrl.searchParams.set('url', dataSourceUrl.toString());
        
        // Map Boolean Flags
        const effectiveOptions = { ...globalSub.defaultOptions, ...profileSub.options };
        const flagMap = { udp: 'udp', emoji: 'emoji', scv: 'scv', sort: 'sort', tfo: 'tfo', list: 'list' };
        
        // [元数据核心支持] 如果是 Meta 核心，告知第三方转换后端使用 Meta 语法
        if (isMetaCore(userAgentHeader, url.searchParams)) {
            externalUrl.searchParams.set('meta', 'true');
        }

        Object.entries(flagMap).forEach(([key, paramName]) => {
            const val = url.searchParams.has(paramName) 
                ? url.searchParams.get(paramName) === 'true' 
                : effectiveOptions[key];
            externalUrl.searchParams.set(paramName, val ? 'true' : 'false');
        });

        // Pass Remote Config if applicable
        if (templateUrl && templateSource.kind === 'remote') {
            // [回滚] 恢复使用 URL 传递配置。虽然 Base64 更可靠，但并非所有后端都支持 base64: 前缀
            externalUrl.searchParams.set('config', templateSource.value);
        }

        // Add File Name
        externalUrl.searchParams.set('filename', subName);

        // [Access Log] Send notification for external redirection
        if (!url.searchParams.has('callback_token') && !shouldSkipLogging && config.enableAccessLog) {
            const clientIp = request.headers.get('CF-Connecting-IP')
                || request.headers.get('X-Real-IP')
                || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
                || 'N/A';
            context.waitUntil(
                sendEnhancedTgNotification(
                    config,
                    '🛰️ <b>订阅被访问</b> (第三方转换)',
                    clientIp,
                    `<b>域名:</b> <code>${tgEscape(domain)}</code>\n<b>客户端:</b> <code>${tgEscape(userAgentHeader)}</code>\n<b>请求格式:</b> <code>${tgEscape(targetFormat)}</code>\n<b>订阅组:</b> <code>${tgEscape(subName)}</code>`
                )
            );
        }

        // [重要修复] 使用手动构建出的 302 响应，以确保头部是可变的 (Mutable)
        return new Response(null, {
            status: 302,
            headers: {
                'Location': externalUrl.toString(),
                'Cache-Control': 'no-store, no-cache',
                'X-MiSub-Mode': 'external-redirect-v2'
            }
        });
    }

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
                    '🛰️ <b>订阅被访问</b>',
                    clientIp,
                    `<b>域名:</b> <code>${tgEscape(domain)}</code>\n<b>客户端:</b> <code>${tgEscape(userAgentHeader)}</code>\n<b>请求格式:</b> <code>${tgEscape(targetFormat)}</code>\n<b>订阅组:</b> <code>${tgEscape(subName)}</code>`
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

        return new Response(base64EncodeUtf8(contentToEncode), { headers });
    }


    // [Subconverter API] URL 参数优先级高于全局/Profile 设置
    const finalSkipCertVerify = urlScv !== null ? (urlScv === 'true' || urlScv === '1') : shouldSkipCertificateVerify;
    const finalEnableUdp = urlUdp !== null ? (urlUdp === 'true' || urlUdp === '1') : shouldEnableUdp;
    const finalEnableTfo = urlTfo === 'true' || urlTfo === '1';

    const builtinOptions = {
        fileName: subName,
        managedConfigUrl: '',
        interval: config.UpdateInterval || 86400,
        skipCertVerify: finalSkipCertVerify,
        enableUdp: finalEnableUdp,
        enableTfo: finalEnableTfo,
        ruleLevel: ruleLevel, // 统一后的规则等级
        isMeta: isMetaCore(userAgentHeader, url.searchParams)
    };

    const managedConfigUrl = buildManagedConfigUrl(request.url);

    const shouldUseBuiltin = useBuiltin && (
        targetFormat === 'clash' ||
        targetFormat === 'egern' ||
        targetFormat.startsWith('surge') ||
        targetFormat === 'loon' ||
        targetFormat === 'quanx' ||
        targetFormat === 'singbox' ||
        targetFormat === 'sing-box'
    );

    if (shouldUseBuiltin) {
        try {
            const totalUserInfo = targetMisubs.reduce((acc, sub) => {
                if (sub.enabled && sub.userInfo) {
                    return {
                        upload: (acc.upload || 0) + (sub.userInfo.upload || 0),
                        download: (acc.download || 0) + (sub.userInfo.download || 0),
                        total: (acc.total || 0) + (sub.userInfo.total || 0),
                        expire: Math.max(acc.expire || 0, sub.userInfo.expire || 0)
                    };
                }
                return acc;
            }, { upload: 0, download: 0, total: 0, expire: 0 });

            const userInfoHeader = totalUserInfo.total > 0 
                ? `upload=${totalUserInfo.upload}; download=${totalUserInfo.download}; total=${totalUserInfo.total}; expire=${totalUserInfo.expire}`
                : null;

            let { content: finalContent, contentType, headers: resultHeaders } = await ProcessorService.renderOutput({
                targetFormat,
                combinedNodeList,
                subName,
                config,
                builtinOptions,
                templateSource,
                managedConfigUrl,
                storageAdapter,
                userInfoHeader
            });

            // [Subconverter API] 处理 list=true 逻辑：仅输出节点片段
            if (urlList) {
                const extracted = extractProxySectionFromBuiltin(finalContent, targetFormat);
                if (extracted) {
                    finalContent = extracted;
                    contentType = 'text/plain; charset=utf-8';
                }
            }

            const isJson = targetFormat === 'singbox' || targetFormat === 'sing-box';
            const responseHeaders = new Headers({
                "Content-Disposition": `attachment; filename="${encodeURIComponent(subName)}"; filename*=utf-8''${encodeURIComponent(subName)}`,
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache',
                'X-MiSub-Mode': `builtin-${targetFormat}`,
                'Access-Control-Allow-Origin': '*'
            });

            if (userInfoHeader) {
                responseHeaders.set('Subscription-Userinfo', userInfoHeader);
                responseHeaders.set('Profile-Update-Interval', String(config.UpdateInterval || 24));
            }

            Object.entries(resultHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
            Object.entries(cacheHeaders).forEach(([key, value]) => responseHeaders.set(key, value));

            if (!url.searchParams.has('callback_token') && !shouldSkipLogging) {
                const clientIp = request.headers.get('CF-Connecting-IP')
                    || request.headers.get('X-Real-IP')
                    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
                    || 'N/A';
                context.waitUntil(
                    sendEnhancedTgNotification(
                        config,
                        '🛰️ <b>订阅被访问</b> (内置转换)',
                        clientIp,
                        `<b>域名:</b> <code>${tgEscape(domain)}</code>\n<b>客户端:</b> <code>${tgEscape(userAgentHeader)}</code>\n<b>请求格式:</b> <code>${tgEscape(targetFormat)}</code>\n<b>订阅组:</b> <code>${tgEscape(subName)}</code>`
                    )
                );

                if (config.enableAccessLog) {
                    logAccessSuccess({
                        context,
                        env,
                        request,
                        userAgentHeader,
                        targetFormat: `builtin-${targetFormat}`,
                        token,
                        profileIdentifier,
                        subName,
                        domain
                    });
                }
            }

            return new Response(finalContent, { headers: responseHeaders });

        } catch (e) {
            console.error(`[Builtin${targetFormat}] Generation failed:`, e);
        }
    }

    const base64Headers = { "Content-Type": "text/plain; charset=utf-8", 'Cache-Control': 'no-store, no-cache' };
    Object.entries(cacheHeaders).forEach(([key, value]) => {
        base64Headers[key] = value;
    });

    return new Response(base64EncodeUtf8(combinedNodeList), { headers: base64Headers });
}
