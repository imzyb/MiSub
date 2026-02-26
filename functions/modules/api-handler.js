/**
 * API处理模块
 * 处理各种API请求
 */

import { StorageFactory } from '../storage-adapter.js';
import { getCookieSecret, getAdminPassword, setAdminPassword, isUsingDefaultPassword, createJsonResponse, createErrorResponse, migrateProfileIds } from './utils.js';
import { authMiddleware, handleLogin, handleLogout, createUnauthorizedResponse } from './auth-middleware.js';
import { sendTgNotification, checkAndNotify } from './notifications.js';
import { clearAllNodeCaches } from '../services/node-cache-service.js';

import { KV_KEY_SUBS, KV_KEY_PROFILES, KV_KEY_SETTINGS, DEFAULT_SETTINGS as defaultSettings } from './config.js';

/**
 * 获取存储适配器实例
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Object>} 存储适配器实例
 */
async function getStorageAdapter(env) {
    const storageType = await StorageFactory.getStorageType(env);
    return StorageFactory.createAdapter(env, storageType);
}

/**
 * 处理数据获取API
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleDataRequest(env) {
    let storageType = 'unknown';
    try {
        storageType = await StorageFactory.getStorageType(env);
        if (storageType === 'd1' && !env.MISUB_DB) {
            console.error('[API Error /data] D1 binding missing while storageType=d1');
        }
        if (storageType === 'kv' && !env.MISUB_KV) {
            console.error('[API Error /data] KV binding missing while storageType=kv');
        }
        const storageAdapter = StorageFactory.createAdapter(env, storageType);
        const [misubs, profiles, settings] = await Promise.all([
            storageAdapter.get(KV_KEY_SUBS).then(res => res || []),
            storageAdapter.get(KV_KEY_PROFILES).then(res => res || []),
            storageAdapter.get(KV_KEY_SETTINGS).then(res => res || {})
        ]);

        // 自动迁移旧版 profile ID（去除 'profile_' 前缀）
        if (migrateProfileIds(profiles)) {
            storageAdapter.put(KV_KEY_PROFILES, profiles).catch(err =>
                console.error('[Migration] Failed to persist migrated profile IDs:', err)
            );
        }
        const config = {
            FileName: settings.FileName || 'MISUB',
            mytoken: settings.mytoken || 'auto',

            profileToken: settings.profileToken || 'profiles',
            isDefaultPassword: await isUsingDefaultPassword(env)
        };
        return createJsonResponse({ misubs, profiles, config });
    } catch (e) {
        console.error('[API Error /data] Failed to read from storage', {
            error: e?.message,
            storageType,
            hasKv: !!env?.MISUB_KV,
            hasD1: !!env?.MISUB_DB
        });
        return createErrorResponse(e, 500);
    }
}

/**
 * 处理订阅和配置保存API
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
import { applyPatch } from './patch-utils.js';

// ... (existing imports)

/**
 * 处理订阅和配置保存API
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleMisubsSave(request, env) {
    try {
        // 步骤1: 解析请求体
        let requestData;
        try {
            requestData = await request.json();
        } catch (parseError) {
            console.error('[API Error /misubs] JSON解析失败:', parseError);
            return createJsonResponse({
                success: false,
                message: '请求数据格式错误，请检查数据格式'
            }, 400);
        }

        const { misubs, profiles, diff } = requestData;
        const storageAdapter = await getStorageAdapter(env);

        let finalMisubs = misubs;
        let finalProfiles = profiles;

        // 步骤1.5: 检查是否为 Diff 模式
        if (diff) {
            console.info('[API] Processing Diff Patch...');
            // 获取当前数据
            const [currentMisubs, currentProfiles] = await Promise.all([
                storageAdapter.get(KV_KEY_SUBS).then(res => res || []),
                storageAdapter.get(KV_KEY_PROFILES).then(res => res || [])
            ]);

            // 应用补丁
            if (diff.subscriptions) {
                finalMisubs = applyPatch(currentMisubs, diff.subscriptions);
            } else {
                finalMisubs = currentMisubs; // 无变动
            }

            if (diff.profiles) {
                finalProfiles = applyPatch(currentProfiles, diff.profiles);
            } else {
                finalProfiles = currentProfiles; // 无变动
            }

            if (!Array.isArray(finalMisubs) || !Array.isArray(finalProfiles)) {
                return createJsonResponse({
                    success: false,
                    message: '增量更新结果格式错误，请检查补丁数据'
                }, 400);
            }
        } else {
            // 步骤2: 验证必需字段 (仅在非Diff模式下)
            if (typeof misubs === 'undefined' || typeof profiles === 'undefined') {
                return createJsonResponse({
                    success: false,
                    message: '请求体中缺少 misubs 或 profiles 字段'
                }, 400);
            }

            // 步骤3: 验证数据类型
            if (!Array.isArray(misubs) || !Array.isArray(profiles)) {
                return createJsonResponse({
                    success: false,
                    message: 'misubs 和 profiles 必须是数组格式'
                }, 400);
            }
        }

        // 步骤4: 获取设置（带错误处理）
        let settings;
        try {
            settings = await storageAdapter.get(KV_KEY_SETTINGS) || defaultSettings;
        } catch (settingsError) {
            settings = defaultSettings; // 使用默认设置继续
        }

        // 步骤5: 处理通知（非阻塞，错误不影响保存）
        // 仅在有订阅数据时处理
        if (finalMisubs && finalMisubs.length > 0) {
            try {
                const notificationPromises = finalMisubs
                    .filter(sub => sub && sub.url && sub.url.startsWith('http'))
                    .map(sub => checkAndNotify(sub, settings, env).catch(notifyError => {
                        console.warn('[API] Notification failed for subscription:', sub?.name || sub?.url, notifyError);
                    }));

                // 并行处理通知，但不等待完成
                Promise.all(notificationPromises).catch(e => {
                    console.warn('[API] Notification batch error:', e);
                });
            } catch (notificationError) {
                console.warn('[API] Notification system error:', notificationError);
            }
        }

        // 步骤6: 保存数据到存储（使用存储适配器）
        try {
            await Promise.all([
                storageAdapter.put(KV_KEY_SUBS, finalMisubs),
                storageAdapter.put(KV_KEY_PROFILES, finalProfiles)
            ]);
        } catch (storageError) {
            console.error('[API Error /misubs] Storage put failed:', storageError);
            return createJsonResponse({
                success: false,
                message: `数据保存失败: ${storageError.message || '存储服务暂时不可用，请稍后重试'}`
            }, 500);
        }

        // 步骤6.5: 清除节点缓存（订阅变动后确保拉取最新数据）
        try {
            const cacheResult = await clearAllNodeCaches(storageAdapter);
            console.info(`[API] Cleared ${cacheResult.cleared} node caches after subscription update`);
        } catch (cacheError) {
            // 缓存清除失败不影响保存结果
            console.warn('[API] Failed to clear node caches:', cacheError.message);
        }

        // 步骤7: 返回保存后的数据，确保前端能更新状态
        return createJsonResponse({
            success: true,
            message: diff ? '增量更新已保存' : '订阅源及订阅组已保存',
            data: {
                misubs: finalMisubs,
                profiles: finalProfiles
            }
        });

    } catch (e) {
        console.error('[API Error /misubs] Uncaught error:', e);
        return createJsonResponse({
            success: false,
            message: `保存失败: ${e.message || '服务器内部错误，请稍后重试'}`
        }, 500);
    }
}

/**
 * 处理设置获取API
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleSettingsGet(env) {
    try {
        const storageAdapter = await getStorageAdapter(env);
        const settings = await storageAdapter.get(KV_KEY_SETTINGS) || {};
        return createJsonResponse({ ...defaultSettings, ...settings });
    } catch (e) {
        return createErrorResponse('读取设置失败', 500);
    }
}

/**
 * 处理设置保存API
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleSettingsSave(request, env) {
    try {
        const newSettings = await request.json();

        // 校验 customLoginPath 是否为系统保留路径
        if (newSettings.customLoginPath) {
            const reservedPaths = ['settings', 'login', 'groups', 'nodes', 'subscriptions', 'dashboard', 'api', 'explore'];
            const pathSegment = newSettings.customLoginPath.replace(/^\/+/, '').split('/')[0].toLowerCase();
            if (reservedPaths.includes(pathSegment)) {
                return createJsonResponse({
                    success: false,
                    message: `"/${pathSegment}" 是系统保留路径，不可用作自定义登录路径`
                }, 400);
            }
        }

        const storageAdapter = await getStorageAdapter(env);
        const oldSettings = await storageAdapter.get(KV_KEY_SETTINGS) || {};
        const finalSettings = { ...oldSettings, ...newSettings };

        // 使用存储适配器保存设置
        await storageAdapter.put(KV_KEY_SETTINGS, finalSettings);

        // 清除节点缓存（设置变更可能影响节点处理逻辑）
        try {
            await clearAllNodeCaches(storageAdapter);
        } catch (cacheError) {
            console.warn('[API] Failed to clear node caches:', cacheError.message);
        }

        const message = `⚙️ *MiSub 设置更新* ⚙️\n\n您的 MiSub 应用设置已成功更新。`;
        await sendTgNotification(finalSettings, message);

        return createJsonResponse({ success: true, message: '设置已保存' });
    } catch (e) {
        return createErrorResponse('保存设置失败', 500);
    }
}

/**
 * 处理公开订阅组获取API
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handlePublicProfilesRequest(env) {
    try {
        const storageAdapter = await getStorageAdapter(env);
        const [profiles, settings] = await Promise.all([
            storageAdapter.get(KV_KEY_PROFILES).then(res => res || []),
            storageAdapter.get(KV_KEY_SETTINGS).then(res => res || {})
        ]);

        const profileToken = settings.profileToken || 'profiles';

        // 获取公告配置（仅当启用时返回）
        const announcement = settings.announcement?.enabled ? {
            enabled: true, // [修复] 必须包含此字段，否则前端 v-if 判断会失败
            title: settings.announcement.title || '',
            content: settings.announcement.content || '',
            type: settings.announcement.type || 'info',
            dismissible: settings.announcement.dismissible !== false,
            updatedAt: settings.announcement.updatedAt
        } : null;

        // Hero Configuration
        const hero = {
            title1: settings.heroTitle1 || '发现',
            title2: settings.heroTitle2 || '优质订阅',
            description: settings.heroDescription || '浏览并获取由管理员分享的精选订阅组合，一键导入到您的客户端。'
        };

        // Guestbook Config (Safe subset)
        const guestbook = {
            enabled: settings.guestbook?.enabled,
            requireAudit: settings.guestbook?.requireAudit,
            allowAnonymous: settings.guestbook?.allowAnonymous,
        };

        // 过滤出公开且启用的订阅组
        const publicProfiles = profiles
            .filter(p => p.isPublic && p.enabled)
            .map(p => ({
                id: p.id,
                name: p.name,
                description: p.description || '',
                customId: p.customId,
                updatedAt: p.updatedAt,
                subscriptionCount: (p.subscriptions || []).length,
                manualNodeCount: (p.manualNodes || []).length,
            }));

        return createJsonResponse({
            success: true,
            data: publicProfiles,
            config: {
                profileToken,
                announcement,
                hero,
                guestbook
            }
        });
    } catch (e) {
        console.error('[API Error /public/profiles]', e);
        return createErrorResponse('获取公开订阅组失败', 500);
    }
}

/**
 * 处理公开配置获取API
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handlePublicConfig(env) {
    try {
        const storageAdapter = await getStorageAdapter(env);
        const settings = await storageAdapter.get(KV_KEY_SETTINGS) || {};

        // Merge with default settings to ensure enablePublicPage exists
        const mergedSettings = { ...defaultSettings, ...settings };

        return createJsonResponse({
            enablePublicPage: mergedSettings.enablePublicPage,
            customLoginPath: mergedSettings.customLoginPath
        });
    } catch (e) {
        console.error('[API Error /public/config]', e);
        return createErrorResponse('获取公开配置失败', 500);
    }
}

/**
 * 处理密码更新API
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleUpdatePassword(request, env) {
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }

    try {
        const { password } = await request.json();

        if (!password || typeof password !== 'string' || password.length < 6) {
            return createErrorResponse('密码必须至少6位字符', 400);
        }

        await setAdminPassword(env, password);
        return createJsonResponse({ success: true, message: '密码已更新' });

    } catch (e) {
        console.error('[API Error /settings/password]', e);
        return createErrorResponse('Failed to update password', 500);
    }
}
