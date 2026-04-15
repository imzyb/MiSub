/**
 * 通知服务 (核心实现)
 * @author MiSub Team
 */

/**
 * 转义 Telegram HTML 模式下的特殊字符
 * @param {string} text - 待转义的文本
 * @returns {string} - 转义后的文本
 */
export function tgEscape(text) {
    if (typeof text !== 'string') return String(text || '');
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 发送基本的Telegram通知
 * @param {Object} settings - 设置对象
 * @param {string} message - 消息内容 (支持部分 HTML 标签: <b>, <i>, <code>, <a>)
 * @returns {Promise<boolean>} - 是否发送成功
 */
export async function sendTgNotification(settings, message) {
    if (!settings.BotToken || !settings.ChatID) {
        return false;
    }

    // 为所有消息添加时间戳
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const fullMessage = `${message}\n\n<b>时间:</b> <code>${now} (UTC+8)</code>`;

    const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
    const payload = {
        chat_id: settings.ChatID,
        text: fullMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[NotificationService] TG API Error:', response.status, errorData);
        }
        
        return response.ok;
    } catch (error) {
        console.error('[NotificationService] Network Error:', error);
        return false;
    }
}

/**
 * 增强版TG通知，包含IP地理位置信息
 * @param {Object} settings - 设置对象
 * @param {string} type - 通知类型 (支持 HTML)
 * @param {string} clientIp - 客户端IP
 * @param {string} additionalData - 额外数据 (支持 HTML)
 * @returns {Promise<boolean>} - 是否发送成功
 */
export async function sendEnhancedTgNotification(settings, type, clientIp, additionalData = '') {
    if (!settings.BotToken || !settings.ChatID) {
        return false;
    }

    let locationInfo = '';

    // 尝试获取IP地理位置信息 (使用 HTTPS 接口)
    try {
        const response = await fetch(`https://ipwho.is/${clientIp}`, {
            cf: { timeout: 3000 }
        });

        if (response.ok) {
            const ipInfo = await response.json();
            if (ipInfo.success) {
                locationInfo = `
<b>国家:</b> <code>${tgEscape(ipInfo.country || 'N/A')}</code>
<b>城市:</b> <code>${tgEscape(ipInfo.city || 'N/A')}</code>
<b>ISP:</b> <code>${tgEscape(ipInfo.connection?.org || ipInfo.connection?.isp || 'N/A')}</code>
<b>ASN:</b> <code>${tgEscape(ipInfo.connection?.asn ? 'AS' + ipInfo.connection.asn : 'N/A')}</code>`;
            }
        }
    } catch (error) {
        console.debug('[NotificationService] Failed to fetch IP geolocation:', error);
    }

    // 构建完整消息
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const message = `${type}

<b>IP 地址:</b> <code>${tgEscape(clientIp)}</code>${locationInfo}

${additionalData}

<b>时间:</b> <code>${now} (UTC+8)</code>`;

    const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
    const payload = {
        chat_id: settings.ChatID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[NotificationService] TG API Error (Enhanced):', response.status, errorData);
        }
        
        return response.ok;
    } catch (error) {
        console.error('[NotificationService] Network Error (Enhanced):', error);
        return false;
    }
}

/**
 * 调试发送Telegram通知（返回详细错误信息）
 */
export async function debugTgNotification(settings, message) {
    if (!settings.BotToken || !settings.ChatID) {
        return { success: false, error: 'BotToken or ChatID not configured' };
    }

    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const fullMessage = `${message}\n\n<b>时间:</b> <code>${now} (UTC+8)</code>`;

    const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
    const payload = {
        chat_id: settings.ChatID,
        text: fullMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            return { success: true, response: data };
        } else {
            return {
                success: false,
                error: `Telegram API Error: ${response.status} ${response.statusText}`,
                response: data
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Network/Fetch Error: ${error.message}`
        };
    }
}
