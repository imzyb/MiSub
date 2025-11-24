/**
 * 通知功能模块
 * 处理Telegram通知和流量提醒
 */

import { formatBytes } from './utils.js';

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

    // 尝试获取IP地理位置信息
    try {
        const response = await fetch(`http://ip-api.com/json/${clientIp}?lang=zh-CN`, {
            cf: {
                // 设置较短的超时时间，避免影响主请求
                timeout: 3000
            }
        });

        if (response.ok) {
            const ipInfo = await response.json();
            if (ipInfo.status === 'success') {
                locationInfo = `
*国家:* \`${ipInfo.country || 'N/A'}\`
*城市:* \`${ipInfo.city || 'N/A'}\`
*ISP:* \`${ipInfo.org || 'N/A'}\`
*ASN:* \`${ipInfo.as || 'N/A'}\``;
            }
        }
    } catch (error) {
        // 获取IP位置信息失败，忽略错误
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
 * 处理定时任务的通知更新
 * @param {Object} env - Cloudflare环境
 * @returns {Promise<Response>}
 */
export async function handleCronTrigger(env) {
    const { StorageFactory } = await import('../storage-adapter.js');
    const { checkAndNotify } = await import('./notifications.js');

    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
    const originalSubs = await storageAdapter.get('misub_subscriptions_v1') || [];
    const allSubs = JSON.parse(JSON.stringify(originalSubs)); // 深拷贝以便比较
    const defaultSettings = {
        NotifyThresholdDays: 3,
        NotifyThresholdPercent: 90,
        BotToken: '',
        ChatID: ''
    };
    const settings = await storageAdapter.get('worker_settings_v1') || defaultSettings;

    const nodeRegex = /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5):\/\//gm;
    let changesMade = false;
    let updatedCount = 0;
    let failedCount = 0;
    const failedSubscriptions = [];

    console.log(`[Cron] Starting update for ${allSubs.length} subscriptions`);

    for (const sub of allSubs) {
        if (sub.url.startsWith('http') && sub.enabled) {
            try {
                // 並行請求流量和節點內容
                const trafficRequest = fetch(new Request(sub.url, {
                    headers: { 'User-Agent': 'clash-verge/v2.4.3' },
                    redirect: "follow",
                    cf: { insecureSkipVerify: true }
                }));
                const nodeCountRequest = fetch(new Request(sub.url, {
                    headers: { 'User-Agent': 'v2rayN/7.23' },
                    redirect: "follow",
                    cf: { insecureSkipVerify: true }
                }));
                const [trafficResult, nodeCountResult] = await Promise.allSettled([
                    Promise.race([trafficRequest, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))]),
                    Promise.race([nodeCountRequest, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))])
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
                        sub.userInfo = info; // 更新流量資訊
                        await checkAndNotify(sub, settings, env); // 檢查並發送通知
                        hasTrafficUpdate = true;
                    }
                } else if (trafficResult.status === 'rejected') {
                    console.error(`[Cron] Traffic request failed for ${sub.name}:`, trafficResult.reason.message);
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
                        sub.nodeCount = matches.length; // 更新節點數量
                        hasNodeCountUpdate = true;
                    }
                } else if (nodeCountResult.status === 'rejected') {
                    console.error(`[Cron] Node count request failed for ${sub.name}:`, nodeCountResult.reason.message);
                }

                if (hasTrafficUpdate || hasNodeCountUpdate) {
                    updatedCount++;
                    changesMade = true;
                    console.log(`[Cron] Updated ${sub.name}: traffic=${hasTrafficUpdate}, nodes=${hasNodeCountUpdate}`);
                }

            } catch (e) {
                failedCount++;
                const errorInfo = {
                    name: sub.name || '未命名',
                    url: sub.url,
                    error: e.message,
                    timestamp: new Date().toISOString()
                };

                console.error(`[Cron] Failed to update subscription:`, errorInfo);
                failedSubscriptions.push(errorInfo);
            }
        }
    }

    if (changesMade) {
        try {
            await storageAdapter.put('misub_subscriptions_v1', allSubs);
            console.log(`[Cron] Successfully saved updated subscriptions`);
        } catch (saveError) {
            console.error(`[Cron] Failed to save subscriptions:`, saveError);
            return new Response(JSON.stringify({
                success: false,
                error: "Failed to save subscriptions",
                details: saveError.message,
                summary: {
                    total: allSubs.length,
                    updated: updatedCount,
                    failed: failedCount,
                    saveError: true
                }
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    const summary = {
        success: true,
        summary: {
            total: allSubs.length,
            updated: updatedCount,
            failed: failedCount,
            changes: changesMade,
            failed_subscriptions: failedSubscriptions
        }
    };

    console.log(`[Cron] Completed:`, summary.summary);

    return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}