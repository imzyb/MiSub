/**
 * 通知功能模块
 * 处理Telegram通知和流量提醒
 */

import { formatBytes } from './utils.js';
import { KV_KEY_SUBS, KV_KEY_SETTINGS, DEFAULT_SETTINGS, SYSTEM_CONSTANTS } from './config.js';

/**
 * 发送Telegram基础通知
 * @param {Object} settings - 设置对象
 * @param {string} message - 通知消息
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendTgNotification(settings, message) {
    if (!settings.BotToken || !settings.ChatID) {
        return false;
    }

    // 为所有消息添加时间戳
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const fullMessage = `${message}\n\n*时间:* \`${now} (UTC+8)\``;

    const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
    const payload = {
        chat_id: settings.ChatID,
        text: fullMessage,
        parse_mode: 'Markdown',
        disable_web_page_preview: true // 禁用链接预览，使消息更紧凑
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * 增强版TG通知，包含IP地理位置信息
 * @param {Object} settings - 设置对象
 * @param {string} type - 通知类型
 * @param {string} clientIp - 客户端IP
 * @param {string} additionalData - 额外数据
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendEnhancedTgNotification(settings, type, clientIp, additionalData = '') {
    if (!settings.BotToken || !settings.ChatID) {
        return false;
    }

    let locationInfo = '';

    // 尝试获取IP地理位置信息（使用HTTPS安全接口）
    try {
        const response = await fetch(`https://ipwho.is/${clientIp}`, {
            cf: {
                // 设置较短的超时时间，避免影响主请求
                timeout: 3000
            }
        });

        if (response.ok) {
            const ipInfo = await response.json();
            if (ipInfo.success !== false) {
                locationInfo = `
*国家:* \`${ipInfo.country || 'N/A'}\`
*城市:* \`${ipInfo.city || 'N/A'}\`
*ISP:* \`${ipInfo.connection?.org || ipInfo.connection?.isp || 'N/A'}\`
*ASN:* \`${ipInfo.connection?.asn ? 'AS' + ipInfo.connection.asn : 'N/A'}\``;
            }
        }
    } catch (error) {
        console.debug('[Notifications] Failed to fetch IP geolocation:', error);
    }

    // 构建完整消息
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const message = `${type}

*IP 地址:* \`${clientIp}\`${locationInfo}

${additionalData}

*时间:* \`${now} (UTC+8)\``;

    const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
    const payload = {
        chat_id: settings.ChatID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * 检查并发送订阅到期和流量预警通知
 * @param {Object} sub - 订阅对象
 * @param {Object} settings - 全局设置
 * @param {Object} env - Cloudflare 环境
 * @returns {Promise<void>}
 */
export async function checkAndNotify(sub, settings, env) {
    if (!sub.userInfo) return; // 没有流量信息，无法检查

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 1. 检查订阅到期
    if (sub.userInfo.expire) {
        const expiryDate = new Date(sub.userInfo.expire * 1000);
        const daysRemaining = Math.ceil((expiryDate - now) / ONE_DAY_MS);

        // 检查是否满足通知条件：剩余天数 <= 阈值
        if (daysRemaining <= (settings.NotifyThresholdDays || 7)) {
            // 检查上次通知时间，防止24小时内重复通知
            if (!sub.lastNotifiedExpire || (now - sub.lastNotifiedExpire > ONE_DAY_MS)) {
                const message = `🗓️ *订阅临期提醒* 🗓️

*订阅名称:* \`${sub.name || '未命名'}\`
*状态:* \`${daysRemaining < 0 ? '已过期' : `仅剩 ${daysRemaining} 天到期`}\`
*到期日期:* \`${expiryDate.toLocaleDateString('zh-CN')}\``;
                const sent = await sendTgNotification(settings, message);
                if (sent) {
                    sub.lastNotifiedExpire = now; // 更新通知时间戳
                }
            }
        }
    }

    // 2. 检查流量使用
    const { upload, download, total } = sub.userInfo;
    if (total > 0) {
        const used = upload + download;
        const usagePercent = Math.round((used / total) * 100);

        // 检查是否满足通知条件：已用百分比 >= 阈值
        if (usagePercent >= (settings.NotifyThresholdPercent || 90)) {
            // 检查上次通知时间，防止24小时内重复通知
            if (!sub.lastNotifiedTraffic || (now - sub.lastNotifiedTraffic > ONE_DAY_MS)) {
                const message = `📈 *流量预警提醒* 📈

*订阅名称:* \`${sub.name || '未命名'}\`
*状态:* \`已使用 ${usagePercent}%\`
*详情:* \`${formatBytes(used)} / ${formatBytes(total)}\``;
                const sent = await sendTgNotification(settings, message);
                if (sent) {
                    sub.lastNotifiedTraffic = now; // 更新通知时间戳
                }
            }
        }
    }
}

/**
 * 处理定时任务的通知更新（并行处理版本）
 * @param {Object} env - Cloudflare环境
 * @returns {Promise<Response>}
 */
export async function handleCronTrigger(env) {
    const { StorageFactory } = await import('../storage-adapter.js');
    const { checkAndNotify } = await import('./notifications.js');

    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
    const originalSubs = await storageAdapter.get(KV_KEY_SUBS) || [];
    const allSubs = JSON.parse(JSON.stringify(originalSubs)); // 深拷贝以便比较
    const settings = await storageAdapter.get(KV_KEY_SETTINGS) || DEFAULT_SETTINGS;

    // 只处理 HTTP 订阅源（排除手动节点）
    const httpSubscriptions = allSubs.filter(sub => sub.url.startsWith('http') && sub.enabled);

    console.info(`[Cron] Starting parallel update for ${httpSubscriptions.length} subscriptions`);
    const startTime = Date.now();

    // 并行处理配置
    const CONCURRENCY = 6;  // 最大并发数
    const TIMEOUT = 15000;   // 单个请求超时时间（15秒）

    const nodeRegex = /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5|socks):\/\//gm;
    let changesMade = false;
    let updatedCount = 0;
    let failedCount = 0;
    const failedSubscriptions = [];

    /**
     * 处理单个订阅
     */
    async function processSubscription(sub) {
        try {
            // 并行请求流量和节点内容（使用更短的超时）
            const fetchWithTimeout = (url, options) => {
                // 分离 cf 选项：cf 应传给 fetch() 而非 Request()
                const { cf, ...requestInit } = options;
                const fetchCall = cf
                    ? fetch(new Request(url, requestInit), { cf })
                    : fetch(new Request(url, requestInit));
                return Promise.race([
                    fetchCall,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT))
                ]);
            };

            const [trafficResult, nodeCountResult] = await Promise.allSettled([
                fetchWithTimeout(sub.url, {
                    headers: { 'User-Agent': 'clash-verge/v2.4.3' },
                    redirect: "follow",
                    cf: { insecureSkipVerify: true }
                }),
                fetchWithTimeout(sub.url, {
                    headers: { 'User-Agent': SYSTEM_CONSTANTS.FETCHER_USER_AGENT },
                    redirect: "follow",
                    cf: { insecureSkipVerify: true }
                })
            ]);

            let hasTrafficUpdate = false;
            let hasNodeCountUpdate = false;

            // 处理流量信息
            if (trafficResult.status === 'fulfilled' && trafficResult.value.ok) {
                const userInfoHeader = trafficResult.value.headers.get('subscription-userinfo');
                if (userInfoHeader) {
                    const info = {};
                    userInfoHeader.split(';').forEach(part => {
                        const [key, value] = part.trim().split('=');
                        if (key && value) info[key] = /^\d+$/.test(value) ? Number(value) : value;
                    });
                    const originalSub = allSubs.find(s => s.id === sub.id);
                    if (originalSub) {
                        originalSub.userInfo = info;
                        await checkAndNotify(originalSub, settings, env);
                    }
                    hasTrafficUpdate = true;
                }
            }

// 处理节点数量
if (nodeCountResult.status === 'fulfilled' && nodeCountResult.value.ok) {
const text = await nodeCountResult.value.text();
let decoded = '';
try {
decoded = atob(text.replace(/\s/g, ''));
} catch {
decoded = text;
}
const matches = decoded.match(nodeRegex);
if (matches) {
const originalSub = allSubs.find(s => s.id === sub.id);
if (originalSub) {
// 记录节点数量变化
const previousCount = originalSub.nodeCount;
const newCount = matches.length;
originalSub.nodeCount = newCount;

// 检测节点数量显著变化（超过 10 个或变化比例超过 20%）
if (previousCount && previousCount > 0) {
const diff = newCount - previousCount;
const changePercent = Math.abs(diff) / previousCount;
const significantChange = Math.abs(diff) >= 10 || changePercent >= 0.2;

if (significantChange) {
originalSub.nodeCountChange = {
previous: previousCount,
current: newCount,
diff: diff,
timestamp: Date.now()
};
}
}
}
hasNodeCountUpdate = true;
}
}

            return {
                name: sub.name,
                success: hasTrafficUpdate || hasNodeCountUpdate,
                traffic: hasTrafficUpdate,
                nodes: hasNodeCountUpdate
            };
        } catch (e) {
            return {
                name: sub.name,
                success: false,
                error: e.message
            };
        }
    }

    /**
     * 并发池：限制并发数执行所有任务
     */
    async function runWithConcurrency(items, concurrency, fn) {
        const results = [];
        const executing = new Set();

        for (const item of items) {
            const promise = fn(item).then(result => {
                executing.delete(promise);
                return result;
            });
            executing.add(promise);
            results.push(promise);

            if (executing.size >= concurrency) {
                await Promise.race(executing);
            }
        }

        return Promise.all(results);
    }

    // 并行处理所有订阅（控制并发数）
    const results = await runWithConcurrency(httpSubscriptions, CONCURRENCY, processSubscription);

    // 统计结果
    for (const result of results) {
        if (result.success) {
            updatedCount++;
            changesMade = true;
            console.info(`[Cron] Updated ${result.name}: traffic=${result.traffic}, nodes=${result.nodes}`);
        } else if (result.error) {
            failedCount++;
            failedSubscriptions.push({
                name: result.name,
                error: result.error
            });
            console.error(`[Cron] Failed ${result.name}: ${result.error}`);
        }
    }

    // 保存更新
    if (changesMade) {
        try {
            await storageAdapter.put(KV_KEY_SUBS, allSubs);
            console.info(`[Cron] Successfully saved updated subscriptions`);
        } catch (saveError) {
            console.error(`[Cron] Failed to save subscriptions:`, saveError);
            return new Response(JSON.stringify({
                success: false,
                error: "Failed to save subscriptions",
                details: saveError.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

const duration = Date.now() - startTime;
const summary = {
success: true,
summary: {
total: httpSubscriptions.length,
updated: updatedCount,
failed: failedCount,
changes: changesMade,
duration: `${duration}ms`,
failed_subscriptions: failedSubscriptions
}
};

console.info(`[Cron] Completed in ${duration}ms:`, summary.summary);

// [新增] 检测并发送节点数量变化通知
const nodeCountChanges = [];
for (const sub of allSubs) {
if (sub.nodeCountChange) {
nodeCountChanges.push({
name: sub.name,
previous: sub.nodeCountChange.previous,
current: sub.nodeCountChange.current,
diff: sub.nodeCountChange.diff
});
// 清除变化标记，避免重复通知
delete sub.nodeCountChange;
}
}

// 如果有节点数量变化，发送单独通知
if (nodeCountChanges.length > 0 && settings.BotToken && settings.ChatID) {
let nodeChangeMessage = `📉 *节点数量变化提醒*\n\n`;
nodeChangeMessage += `检测到 ${nodeCountChanges.length} 个订阅的节点数量发生显著变化：\n\n`;

nodeCountChanges.slice(0, 10).forEach(change => {
const changeType = change.diff > 0 ? '增加' : '减少';
const emoji = change.diff > 0 ? '📈' : '📉';
nodeChangeMessage += `${emoji} *${change.name}*\n`;
nodeChangeMessage += `  ${changeType} ${Math.abs(change.diff)} 个 (${change.previous} → ${change.current})\n`;
});

if (nodeCountChanges.length > 10) {
nodeChangeMessage += `\n... 还有 ${nodeCountChanges.length - 10} 个订阅有变化`;
}

try {
await sendTgNotification(settings, nodeChangeMessage);
console.info('[Cron] Node count change notification sent');
} catch (notifyError) {
console.error('[Cron] Failed to send node change notification:', notifyError);
}

// 更新存储（清除变化标记后）
if (changesMade) {
try {
await storageAdapter.put(KV_KEY_SUBS, allSubs);
} catch (saveError) {
console.error('[Cron] Failed to update subs after clearing change flags:', saveError);
}
}
}

// [新增] 发送订阅更新摘要通知到 TG Bot
if (settings.BotToken && settings.ChatID) {
let updateMessage = `🔄 *订阅自动更新完成*\n\n`;
updateMessage += `📊 *统计信息*\n`;
updateMessage += `• 总订阅数: ${httpSubscriptions.length} 个\n`;
updateMessage += `• 成功更新: ${updatedCount} 个\n`;

if (failedCount > 0) {
updateMessage += `• 更新失败: ${failedCount} 个\n`;
}

if (nodeCountChanges.length > 0) {
updateMessage += `• 节点变化: ${nodeCountChanges.length} 个订阅\n`;
}

updateMessage += `\n⏱️ 耗时: ${duration}ms\n`;

// 如果有失败的订阅，列出详情
if (failedSubscriptions.length > 0) {
updateMessage += `\n❌ *失败详情:*\n`;
failedSubscriptions.slice(0, 5).forEach(f => {
const errorShort = f.error.length > 30 ? f.error.substring(0, 30) + '...' : f.error;
updateMessage += `• ${f.name}: \`${errorShort}\`\n`;
});
if (failedSubscriptions.length > 5) {
updateMessage += `... 还有 ${failedSubscriptions.length - 5} 个失败`;
}
}

try {
await sendTgNotification(settings, updateMessage);
console.info('[Cron] Update summary notification sent to TG Bot');
} catch (notifyError) {
console.error('[Cron] Failed to send TG notification:', notifyError);
}
}

return new Response(JSON.stringify(summary), {
status: 200,
headers: { 'Content-Type': 'application/json' }
});
}
