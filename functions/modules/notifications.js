/**
 * 通知功能模块
 * 处理业务层逻辑：订阅到期和流量预警，Cron 任务报告。
 * 核心发送逻辑已抽离至 functions/services/notification-service.js
 */

import { formatBytes } from './utils.js';
import { KV_KEY_SUBS, KV_KEY_SETTINGS, DEFAULT_SETTINGS, SYSTEM_CONSTANTS } from './config.js';
// 导入核心通知服务及工具
import { 
    sendTgNotification as sendCoreTg, 
    sendEnhancedTgNotification as sendCoreEnhancedTg, 
    tgEscape as coreTgEscape 
} from '../services/notification-service.js';

/**
 * 转义 Telegram HTML 特殊字符
 */
export function tgEscape(text) {
    return coreTgEscape(text);
}


/**
 * 发送Telegram基础通知 (兼容旧调用)
 */
export async function sendTgNotification(settings, message) {
    return sendCoreTg(settings, message);
}

/**
 * 增强版TG通知 (兼容旧调用)
 */
export async function sendEnhancedTgNotification(settings, type, clientIp, additionalData = '') {
    return sendCoreEnhancedTg(settings, type, clientIp, additionalData);
}

async function loadSubscriptionsForCron(storageAdapter) {
    if (typeof storageAdapter.getAllSubscriptions === 'function') {
        const subscriptions = await storageAdapter.getAllSubscriptions();
        if (Array.isArray(subscriptions)) {
            return subscriptions;
        }
    }

    const subscriptions = await storageAdapter.get(KV_KEY_SUBS);
    return Array.isArray(subscriptions) ? subscriptions : [];
}

async function persistSubscriptionsForCron(storageAdapter, subscriptions) {
    if (typeof storageAdapter.putAllSubscriptions === 'function') {
        await storageAdapter.putAllSubscriptions(subscriptions);
        return;
    }

    await storageAdapter.put(KV_KEY_SUBS, subscriptions);
}

/**
 * 检查并发送订阅到期和流量预警通知
 */
export async function checkAndNotify(sub, settings, env) {
    if (!sub.userInfo) return;

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 1. 检查订阅到期
    if (sub.userInfo.expire) {
        const expiryDate = new Date(sub.userInfo.expire * 1000);
        const daysRemaining = Math.ceil((expiryDate - now) / ONE_DAY_MS);

        if (daysRemaining <= (settings.NotifyThresholdDays || 7)) {
            if (!sub.lastNotifiedExpire || (now - sub.lastNotifiedExpire > ONE_DAY_MS)) {
                const message = `🗓️ <b>订阅临期提醒</b> 🗓️

<b>订阅名称:</b> <code>${tgEscape(sub.name || '未命名')}</code>
<b>状态:</b> <code>${tgEscape(daysRemaining < 0 ? '已过期' : `仅剩 ${daysRemaining} 天到期`)}</code>
<b>到期日期:</b> <code>${expiryDate.toLocaleDateString('zh-CN')}</code>`;
                
                const sent = await sendCoreTg(settings, message);
                if (sent) {
                    sub.lastNotifiedExpire = now;
                }
            }
        }
    }

    // 2. 检查流量使用
    const { upload, download, total } = sub.userInfo;
    if (total > 0) {
        const used = upload + download;
        const usagePercent = Math.round((used / total) * 100);

        if (usagePercent >= (settings.NotifyThresholdPercent || 90)) {
            if (!sub.lastNotifiedTraffic || (now - sub.lastNotifiedTraffic > ONE_DAY_MS)) {
                const message = `📈 <b>流量预警提醒</b> 📈

<b>订阅名称:</b> <code>${tgEscape(sub.name || '未命名')}</code>
<b>状态:</b> <code>已使用 ${usagePercent}%</code>
<b>详情:</b> <code>${tgEscape(formatBytes(used))} / ${tgEscape(formatBytes(total))}</code>`;
                
                const sent = await sendCoreTg(settings, message);
                if (sent) {
                    sub.lastNotifiedTraffic = now;
                }
            }
        }
    }
}

/**
 * 处理定时任务的通知更新（并行处理版本）
 */
export async function handleCronTrigger(env) {
    const { StorageFactory } = await import('../storage-adapter.js');

    const storageAdapter = await StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
    const originalSubs = await loadSubscriptionsForCron(storageAdapter);
    const allSubs = JSON.parse(JSON.stringify(originalSubs));
    const settings = await storageAdapter.get(KV_KEY_SETTINGS) || DEFAULT_SETTINGS;

    const httpSubscriptions = allSubs.filter(sub => sub.url.startsWith('http') && sub.enabled);

    console.info(`[Cron] Starting parallel update for ${httpSubscriptions.length} subscriptions`);
    const startTime = Date.now();

    const CONCURRENCY = 6;
    const TIMEOUT = 15000;

    const nodeRegex = /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5|socks):\/\//gm;
    let changesMade = false;
    let updatedCount = 0;
    let failedCount = 0;
    const failedSubscriptions = [];

    async function processSubscription(sub) {
        try {
            const fetchWithTimeout = (url, options) => {
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
                        const previousCount = originalSub.nodeCount;
                        const newCount = matches.length;
                        originalSub.nodeCount = newCount;

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

    const results = await runWithConcurrency(httpSubscriptions, CONCURRENCY, processSubscription);

    for (const result of results) {
        if (result.success) {
            updatedCount++;
            changesMade = true;
        } else if (result.error) {
            failedCount++;
            failedSubscriptions.push({ name: result.name, error: result.error });
        }
    }

    if (changesMade) {
        await persistSubscriptionsForCron(storageAdapter, allSubs);
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

    const nodeCountChanges = [];
    for (const sub of allSubs) {
        if (sub.nodeCountChange) {
            nodeCountChanges.push({
                name: sub.name,
                previous: sub.nodeCountChange.previous,
                current: sub.nodeCountChange.current,
                diff: sub.nodeCountChange.diff
            });
            delete sub.nodeCountChange;
        }
    }

    // 发送节点变化通知
    if (nodeCountChanges.length > 0 && settings.BotToken && settings.ChatID) {
        let nodeChangeMessage = `📉 <b>节点数量变化提醒</b>\n\n`;
        nodeChangeMessage += `检测到 ${nodeCountChanges.length} 个订阅的节点数量发生显著变化：\n\n`;

        nodeCountChanges.slice(0, 10).forEach(change => {
            const changeType = change.diff > 0 ? '增加' : '减少';
            const emoji = change.diff > 0 ? '📈' : '📉';
            nodeChangeMessage += `${emoji} <b>${tgEscape(change.name)}</b>\n`;
            nodeChangeMessage += `  ${tgEscape(changeType)} ${Math.abs(change.diff)} 个 (<code>${change.previous}</code> → <code>${change.current}</code>)\n`;
        });

        if (nodeCountChanges.length > 10) {
            nodeChangeMessage += `\n... 还有 ${nodeCountChanges.length - 10} 个订阅有变化`;
        }

        await sendCoreTg(settings, nodeChangeMessage);
    }

    // 发送更新摘要
    if (settings.BotToken && settings.ChatID) {
        let updateMessage = `🔄 <b>订阅自动更新完成</b>\n\n`;
        updateMessage += `📊 <b>统计信息</b>\n`;
        updateMessage += `• 总订阅数: <code>${httpSubscriptions.length}</code> 个\n`;
        updateMessage += `• 成功更新: <code>${updatedCount}</code> 个\n`;

        if (failedCount > 0) {
            updateMessage += `• 更新失败: <code>${failedCount}</code> 个\n`;
        }

        if (nodeCountChanges.length > 0) {
            updateMessage += `• 节点变化: <code>${nodeCountChanges.length}</code> 个订阅\n`;
        }

        updateMessage += `\n⏱️ 耗时: <code>${duration}ms</code>\n`;

        if (failedSubscriptions.length > 0) {
            updateMessage += `\n❌ <b>失败详情:</b>\n`;
            failedSubscriptions.slice(0, 5).forEach(f => {
                const errorShort = f.error.length > 30 ? f.error.substring(0, 30) + '...' : f.error;
                updateMessage += `• ${tgEscape(f.name)}: <code>${tgEscape(errorShort)}</code>\n`;
            });
        }

        await sendCoreTg(settings, updateMessage);
    }

    return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
