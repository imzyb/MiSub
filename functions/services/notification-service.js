/**
 * 通知服务
 * @author MiSub Team
 */

/**
 * 发送基本的Telegram通知
 * @param {Object} settings - 设置对象
 * @param {string} message - 消息内容
 * @returns {Promise<boolean>} - 是否发送成功
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
        if (response.ok) {
            return true;
        } else {
            return false;
        }
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
 * @returns {Promise<boolean>} - 是否发送成功
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
        console.debug('[NotificationService] Failed to fetch IP geolocation:', error);
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
        if (response.ok) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

/**
 * 调试发送Telegram通知（返回详细错误信息）
 * @param {Object} settings - 设置对象
 * @param {string} message - 消息内容
 * @returns {Promise<Object>} - { success: boolean, error?: string, response?: any }
 */
export async function debugTgNotification(settings, message) {
    if (!settings.BotToken || !settings.ChatID) {
        return { success: false, error: 'BotToken or ChatID not configured' };
    }

    // 为所有消息添加时间戳
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const fullMessage = `${message}\n\n*时间:* \`${now} (UTC+8)\``;

    const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
    const payload = {
        chat_id: settings.ChatID,
        text: fullMessage,
        parse_mode: 'Markdown',
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
