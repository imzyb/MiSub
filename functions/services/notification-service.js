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

function splitIpCnLocation(value) {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function isLikelyCarrier(value) {
    return /(?:移动|联通|电信|電信|广电|廣電|铁通|鐵通|教育网|教育網|宽带|寬帶|通信|通訊|网络|網絡|中华电信|中華電信|台湾大哥大|台灣大哥大|远传|遠傳|台湾之星|台灣之星|亚太电信|亞太電信)$/i.test(
        String(value || '').trim()
    );
}

function parseIpCnHtml(html) {
    const text = String(html || '');
    const description = text
        .match(
            /<meta\s+name=["']description["']\s+content=["'][^"']*?归属地为[：:]\s*([^，,"'<]+?)(?:，|提供|["'])/i
        )?.[1]
        ?.trim();
    const tableLocation = text
        .match(/所在地理位置[\s\S]*?<td[^>]*>[\s\S]*?<span[^>]*>\s*([^<]+?)\s*<\/span>/i)?.[1]
        ?.trim();
    const tableParts = splitIpCnLocation(tableLocation);
    const descriptionParts = splitIpCnLocation(description);

    if (tableParts.length > 0) {
        const result = {
            country: tableParts[0],
            city: tableParts.slice(1).join(' '),
        };
        const descriptionStartsWithTable = tableParts.every(
            (part, index) => descriptionParts[index] === part
        );
        const extraParts = descriptionStartsWithTable
            ? descriptionParts.slice(tableParts.length)
            : [];
        const carrier = extraParts.at(-1);

        if (isLikelyCarrier(carrier)) {
            const extraPlaceParts = extraParts.slice(0, -1);
            result.city = [...tableParts.slice(1), ...extraPlaceParts].join(' ');
            result.isp = carrier;
        }

        return result;
    }

    if (descriptionParts.length === 0) return null;
    const carrier = descriptionParts.at(-1);
    const hasCarrier = isLikelyCarrier(carrier);
    const placeParts = hasCarrier ? descriptionParts.slice(0, -1) : descriptionParts;
    return {
        country: placeParts[0],
        city: placeParts.slice(1).join(' '),
        isp: hasCarrier ? carrier : undefined,
    };
}

const IP_GEOLOCATION_PROVIDERS = [
    {
        name: 'ip.cn',
        supports: (ip) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip),
        buildUrl: (ip) => `https://ip.cn/ip/${encodeURIComponent(ip)}.html`,
        requestInit: {
            redirect: 'manual',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: 'https://ip.cn/',
            },
        },
        read: (response) => response.text(),
        parse: parseIpCnHtml,
    },
    {
        name: 'ipwho.is',
        buildUrl: (ip) => `https://ipwho.is/${encodeURIComponent(ip)}`,
        parse: (data) =>
            data?.success
                ? {
                      country: data.country,
                      city: data.city,
                      isp: data.connection?.org || data.connection?.isp,
                      asn: data.connection?.asn,
                  }
                : null,
    },
    {
        name: 'ipapi.co',
        buildUrl: (ip) => `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
        parse: (data) =>
            data?.error
                ? null
                : {
                      country: data.country_name || data.country,
                      city: data.city,
                      isp: data.org || data.network,
                      asn: data.asn,
                  },
    },
    {
        name: 'ipinfo.io',
        buildUrl: (ip) => `https://ipinfo.io/${encodeURIComponent(ip)}/json`,
        parse: (data) =>
            data?.bogon || data?.error
                ? null
                : {
                      country: data.country,
                      city: data.city,
                      isp: data.org,
                      asn: data.asn || String(data.org || '').match(/^AS\d+/)?.[0],
                  },
    },
];

function hasGeolocationValue(info) {
    return (
        info &&
        Object.values(info).some(
            (value) => value !== undefined && value !== null && String(value).trim() !== ''
        )
    );
}

function mergeMissingGeolocationValues(current = {}, incoming = {}) {
    const merged = { ...current };
    for (const key of ['country', 'city', 'isp', 'asn']) {
        if (!merged[key] && incoming?.[key]) merged[key] = incoming[key];
    }
    return merged;
}

async function fetchIpGeolocation(clientIp) {
    if (
        !clientIp ||
        clientIp === 'N/A' ||
        clientIp === 'Unknown' ||
        !/^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i.test(clientIp)
    )
        return null;

    let result = {};
    for (const provider of IP_GEOLOCATION_PROVIDERS) {
        if (provider.supports && !provider.supports(clientIp)) continue;
        try {
            const response = await fetch(provider.buildUrl(clientIp), {
                cf: { timeout: 3000 },
                ...(provider.requestInit || {}),
            });
            if (!response.ok) continue;
            const body = provider.read ? await provider.read(response) : await response.json();
            const info = provider.parse(body);
            if (!hasGeolocationValue(info)) continue;

            result = mergeMissingGeolocationValues(result, info);
            if (result.country && result.city && result.isp && result.asn) return result;
        } catch (error) {
            console.debug(`[NotificationService] ${provider.name} geolocation failed:`, error);
        }
    }

    return hasGeolocationValue(result) ? result : null;
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
        disable_web_page_preview: true,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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

    const ipInfo = await fetchIpGeolocation(clientIp);
    if (ipInfo) {
        const asn = ipInfo.asn
            ? String(ipInfo.asn).startsWith('AS')
                ? ipInfo.asn
                : `AS${ipInfo.asn}`
            : 'N/A';
        locationInfo = `
<b>国家:</b> <code>${tgEscape(ipInfo.country || 'N/A')}</code>
<b>城市:</b> <code>${tgEscape(ipInfo.city || 'N/A')}</code>
<b>ISP:</b> <code>${tgEscape(ipInfo.isp || 'N/A')}</code>
<b>ASN:</b> <code>${tgEscape(asn)}</code>`;
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
        disable_web_page_preview: true,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(
                '[NotificationService] TG API Error (Enhanced):',
                response.status,
                errorData
            );
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
        disable_web_page_preview: true,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
            return { success: true, response: data };
        } else {
            return {
                success: false,
                error: `Telegram API Error: ${response.status} ${response.statusText}`,
                response: data,
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Network/Fetch Error: ${error.message}`,
        };
    }
}
