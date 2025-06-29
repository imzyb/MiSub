import yaml from 'js-yaml';

const OLD_KV_KEY = 'misub_data_v1';
// --- 全局常量 ---
// [修改] 将主数据键拆分，为订阅组（profiles）预留空间
const KV_KEY_SUBS = 'misub_subscriptions_v1';
const KV_KEY_PROFILES = 'misub_profiles_v1'; // 新增：用于存储订阅组
const KV_KEY_SETTINGS = 'worker_settings_v1';
const COOKIE_NAME = 'auth_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000;

const defaultSettings = {
  FileName: 'MiSub',
  mytoken: 'auto',
  subConverter: 'subapi.cmliussss.net',
  subConfig: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini',
  prependSubName: true
};

// --- TG 通知函式 (无修改) ---
async function sendTgNotification(settings, message) {
  if (!settings.BotToken || !settings.ChatID) {
    console.log("TG BotToken or ChatID not set, skipping notification.");
    return;
  }
  const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
  const payload = { chat_id: settings.ChatID, text: message, parse_mode: 'Markdown' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      console.log("TG notification sent successfully.");
    } else {
      const errorData = await response.json();
      console.error("Failed to send TG notification:", errorData);
    }
  } catch (error) {
    console.error("Error sending TG notification:", error);
  }
}

// --- 认证与API处理的核心函数 (无修改) ---
async function createSignedToken(key, data) {
    if (!key || !data) throw new Error("Key and data are required for signing.");
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const dataToSign = encoder.encode(data);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
    return `${data}.${Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}
async function verifySignedToken(key, token) {
    if (!key || !token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data] = parts;
    const expectedToken = await createSignedToken(key, data);
    return token === expectedToken ? data : null;
}
async function authMiddleware(request, env) {
    if (!env.COOKIE_SECRET) return false;
    const cookie = request.headers.get('Cookie');
    const sessionCookie = cookie?.split(';').find(c => c.trim().startsWith(`${COOKIE_NAME}=`));
    if (!sessionCookie) return false;
    const token = sessionCookie.split('=')[1];
    const verifiedData = await verifySignedToken(env.COOKIE_SECRET, token);
    return verifiedData && (Date.now() - parseInt(verifiedData, 10) < SESSION_DURATION);
}

// --- 主要 API 請求處理 ---
async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');
    // [新增] 安全的、可重复执行的迁移接口
    if (path === '/migrate') {
        if (!await authMiddleware(request, env)) { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
        try {
            const oldData = await env.MISUB_KV.get(OLD_KV_KEY, 'json');
            const newDataExists = await env.MISUB_KV.get(KV_KEY_SUBS) !== null;

            if (newDataExists) {
                return new Response(JSON.stringify({ success: true, message: '无需迁移，数据已是最新结构。' }), { status: 200 });
            }

            if (!oldData) {
                return new Response(JSON.stringify({ success: false, message: '未找到需要迁移的旧数据。' }), { status: 404 });
            }
            
            await env.MISUB_KV.put(KV_KEY_SUBS, JSON.stringify(oldData));
            await env.MISUB_KV.put(KV_KEY_PROFILES, JSON.stringify([]));
            
            // 将旧键重命名，防止重复迁移
            await env.MISUB_KV.put(OLD_KV_KEY + '_migrated_on_' + new Date().toISOString(), JSON.stringify(oldData));
            await env.MISUB_KV.delete(OLD_KV_KEY);

            return new Response(JSON.stringify({ success: true, message: '数据迁移成功！' }), { status: 200 });

        } catch (e) {
            return new Response(JSON.stringify({ success: false, message: `迁移失败: ${e.message}` }), { status: 500 });
        }
    }


    if (path !== '/login') {
        if (!await authMiddleware(request, env)) { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
    }

    try {
        switch (path) {
            case '/login': {
                if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
                const { password } = await request.json();
                if (password === env.ADMIN_PASSWORD) {
                    const token = await createSignedToken(env.COOKIE_SECRET, String(Date.now()));
                    const headers = new Headers({ 'Content-Type': 'application/json' });
                    headers.append('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DURATION / 1000}`);
                    return new Response(JSON.stringify({ success: true }), { headers });
                }
                return new Response(JSON.stringify({ error: '密码错误' }), { status: 401 });
            }
            case '/logout': {
                const headers = new Headers({ 'Content-Type': 'application/json' });
                headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
                return new Response(JSON.stringify({ success: true }), { headers });
            }
            // [修改] /data 接口，现在需要读取多个KV值
            case '/data': {
                // [最终修正] 如果 KV.get 返回 null (键不存在), 则使用 `|| []` 来确保得到的是一个空数组，防止崩溃
                const [misubs, profiles, settings] = await Promise.all([
                    env.MISUB_KV.get(KV_KEY_SUBS, 'json').then(res => res || []),
                    env.MISUB_KV.get(KV_KEY_PROFILES, 'json').then(res => res || []),
                    env.MISUB_KV.get(KV_KEY_SETTINGS, 'json').then(res => res || {})
                ]);
                const config = { FileName: settings.FileName || 'MISUB', mytoken: settings.mytoken || 'auto' };
                return new Response(JSON.stringify({ misubs, profiles, config }), { headers: { 'Content-Type': 'application/json' } });
            }
            case '/misubs': {
                const { misubs, profiles } = await request.json();
                if (typeof misubs === 'undefined' || typeof profiles === 'undefined') {
                    return new Response(JSON.stringify({ success: false, message: '请求体中缺少 misubs 或 profiles 字段' }), { status: 400 });
                }
                await Promise.all([
                    env.MISUB_KV.put(KV_KEY_SUBS, JSON.stringify(misubs)),
                    env.MISUB_KV.put(KV_KEY_PROFILES, JSON.stringify(profiles))
                ]);
                return new Response(JSON.stringify({ success: true, message: '订阅源及订阅组已保存' }));
            }
            case '/node_count': {
                 if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
                const { url: subUrl } = await request.json();
                if (!subUrl || typeof subUrl !== 'string' || !/^https?:\/\//.test(subUrl)) {
                    return new Response(JSON.stringify({ error: 'Invalid or missing url' }), { status: 400 });
                }
                const result = { count: 0, userInfo: null };
                try {
                    const trafficRequest = fetch(new Request(subUrl, { headers: { 'User-Agent': 'Clash for Windows/0.20.39' }, redirect: "follow" }));
                    const nodeCountRequest = fetch(new Request(subUrl, { headers: { 'User-Agent': 'MiSub-Node-Counter/2.0' }, redirect: "follow" }));
                    const [trafficResponse, nodeCountResponse] = await Promise.all([trafficRequest, nodeCountRequest]);
                    if (trafficResponse.ok) {
                        const userInfoHeader = trafficResponse.headers.get('subscription-userinfo');
                        if (userInfoHeader) {
                            const info = {};
                            userInfoHeader.split(';').forEach(part => {
                                const [key, value] = part.trim().split('=');
                                if (key && value) info[key] = /^\d+$/.test(value) ? Number(value) : value;
                            });
                            result.userInfo = info;
                        }
                    }
                    if (nodeCountResponse.ok) {
                        const text = await nodeCountResponse.text();
                        let decoded = '';
                        try {
                            decoded = atob(text.replace(/\s/g, ''));
                        } catch {
                            decoded = text;
                        }
                        const lineMatches = decoded.match(/^(ss|ssr|vmess|vless|trojan|hysteria2?):\/\//gm);
                        if (lineMatches) {
                            result.count = lineMatches.length;
                        }
                    }
                } catch (e) {
                    console.error('Failed to fetch subscription with dual-request method:', e);
                }
                return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
            }
            case '/settings': {
                if (request.method === 'GET') {
                    const settings = await env.MISUB_KV.get(KV_KEY_SETTINGS, 'json') || {};
                    return new Response(JSON.stringify({ ...defaultSettings, ...settings }), { headers: { 'Content-Type': 'application/json' } });
                }
                if (request.method === 'POST') {
                    const newSettings = await request.json();
                    const oldSettings = await env.MISUB_KV.get(KV_KEY_SETTINGS, 'json') || {};
                    const finalSettings = { ...oldSettings, ...newSettings };
                    await env.MISUB_KV.put(KV_KEY_SETTINGS, JSON.stringify(finalSettings));
                    const message = `🎉 MiSub 設定已成功更新！`;
                    await sendTgNotification(finalSettings, message);
                    return new Response(JSON.stringify({ success: true, message: '设置已保存' }));
                }
                return new Response('Method Not Allowed', { status: 405 });
            }
        }
    } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 }); }
    return new Response('API route not found', { status: 404 });
}

// --- 名称前缀辅助函数 (无修改) ---
function prependNodeName(link, prefix) {
  if (!prefix) return link;
  const appendToFragment = (baseLink, namePrefix) => {
    const hashIndex = baseLink.lastIndexOf('#');
    const originalName = hashIndex !== -1 ? decodeURIComponent(baseLink.substring(hashIndex + 1)) : '';
    const base = hashIndex !== -1 ? baseLink.substring(0, hashIndex) : baseLink;
    if (originalName.startsWith(namePrefix)) {
        return baseLink;
    }
    const newName = originalName ? `${namePrefix} - ${originalName}` : namePrefix;
    return `${base}#${encodeURIComponent(newName)}`;
  }
  if (link.startsWith('vmess://')) {
    try {
      const base64Part = link.substring('vmess://'.length);
      const binaryString = atob(base64Part);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      const jsonString = new TextDecoder('utf-8').decode(bytes);
      const nodeConfig = JSON.parse(jsonString);
      const originalPs = nodeConfig.ps || '';
      if (!originalPs.startsWith(prefix)) {
        nodeConfig.ps = originalPs ? `${prefix} - ${originalPs}` : prefix;
      }
      const newJsonString = JSON.stringify(nodeConfig);
      const newBase64Part = btoa(unescape(encodeURIComponent(newJsonString)));
      return 'vmess://' + newBase64Part;
    } catch (e) {
      console.error("为 vmess 节点添加名称前缀失败，将回退到通用方法。", e);
      return appendToFragment(link, prefix);
    }
  }
  return appendToFragment(link, prefix);
}

// --- 节点列表生成函数 (无修改) ---
async function generateCombinedNodeList(context, config, userAgent, misubs) {
    const enabledMisubs = misubs.filter(sub => sub.enabled);
    const nodeRegex = /^(ss|ssr|vmess|vless|trojan|hysteria2?):\/\//;
    let manualNodesContent = '';
    const normalizeVmessLink = (link) => {
        if (!link.startsWith('vmess://')) {
            return link;
        }
        try {
            const base64Part = link.substring('vmess://'.length);
            const binaryString = atob(base64Part);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const jsonString = new TextDecoder('utf-8').decode(bytes);
            const compactJsonString = JSON.stringify(JSON.parse(jsonString));
            const newBase64Part = btoa(unescape(encodeURIComponent(compactJsonString)));
            return 'vmess://' + newBase64Part;
        } catch (e) {
            console.error("标准化 vmess 链接失败，将使用原始链接:", link, e);
            return link;
        }
    };
    const httpSubs = enabledMisubs.filter(sub => {
        if (sub.url.toLowerCase().startsWith('http')) return true;
        manualNodesContent += sub.url + '\n';
        return false;
    });
    const processedManualNodes = manualNodesContent.split('\n')
        .map(line => line.trim())
        .filter(line => nodeRegex.test(line))
        .map(normalizeVmessLink)
        .map(node => (config.prependSubName) ? prependNodeName(node, '手动节点') : node)
        .join('\n');
    const subPromises = httpSubs.map(async (sub) => {
        try {
            const requestHeaders = { 'User-Agent': userAgent };
            const response = await Promise.race([
                fetch(new Request(sub.url, { headers: requestHeaders, redirect: "follow", cf: { insecureSkipVerify: true } })),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 10000))
            ]);
            if (!response.ok) {
                console.error(`Failed to fetch sub: ${sub.url}, status: ${response.status}`);
                return '';
            }
            let text = await response.text();
            try {
                const cleanedText = text.replace(/\s/g, '');
                if (cleanedText.length > 20 && /^[A-Za-z0-9+/=]+$/.test(cleanedText)) {
                    const binaryString = atob(cleanedText);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
                    text = new TextDecoder('utf-8').decode(bytes);
                }
            } catch (e) {}
            let validNodes = text.replace(/\r\n/g, '\n').split('\n')
                .map(line => line.trim()).filter(line => nodeRegex.test(line));
            validNodes = validNodes.filter(nodeLink => {
                try {
                    const hashIndex = nodeLink.lastIndexOf('#');
                    if (hashIndex === -1) return true;
                    const nodeName = decodeURIComponent(nodeLink.substring(hashIndex + 1));
                    return !nodeName.includes('https://');
                } catch (e) {
                    console.error(`Failed to decode node name, filtering it out: ${nodeLink}`, e);
                    return false;
                }
            });
            return (config.prependSubName && sub.name)
                ? validNodes.map(node => prependNodeName(node, sub.name)).join('\n')
                : validNodes.join('\n');
        } catch (e) {
            console.error(`Failed to fetch sub: ${sub.url}`, e);
            return '';
        }
    });
    const processedSubContents = await Promise.all(subPromises);
    const combinedContent = (processedManualNodes + '\n' + processedSubContents.join('\n'));
    return [...new Set(combinedContent.split('\n').map(line => line.trim()).filter(line => line))].join('\n');
}

// --- [核心修改] 订阅处理函数 ---
async function handleMisubRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userAgentHeader = request.headers.get('User-Agent') || "Unknown";

    // 并行读取所有需要的数据
    const [settingsData, misubsData, profilesData] = await Promise.all([
        env.MISUB_KV.get(KV_KEY_SETTINGS, 'json'),
        env.MISUB_KV.get(KV_KEY_SUBS, 'json'),
        env.MISUB_KV.get(KV_KEY_PROFILES, 'json')
    ]);
    const settings = settingsData || {};
    const allMisubs = misubsData || [];
    const allProfiles = profilesData || [];

    const config = { ...defaultSettings, ...settings };

    // --- [核心修改] 订阅链接解析逻辑 ---
    let token = '';
    let profileId = null;
    const pathSegments = url.pathname.split('/').filter(Boolean); // e.g., ['sub', 'my_token', 'profile_123']

    // 格式: /sub/{token} 或 /sub/{token}/{profileId}
    if (pathSegments.length > 1 && pathSegments[0] === 'sub') {
        token = pathSegments[1];
        if (pathSegments.length > 2) {
            profileId = pathSegments[2];
        }
    } else {
         // 兼容旧格式 ?token=...
        token = url.searchParams.get('token');
    }

    // 验证 Token
    if (!token || token !== config.mytoken) {
        // ... (省略了 callback_token 逻辑，因为它与新功能无关)
        return new Response('Invalid token', { status: 403 });
    }
    // --- 链接解析结束 ---

    let targetMisubs;
    let subName = config.FileName; // 默认文件名

    // 如果有 profileId，则根据 profile 筛选节点
    if (profileId) {
        const profile = allProfiles.find(p => p.id === profileId && p.enabled);
        if (profile) {
            subName = profile.name; // 使用订阅组的名称作为文件名
            const profileSubIds = new Set(profile.subscriptions);
            const profileNodeIds = new Set(profile.manualNodes);

            targetMisubs = allMisubs.filter(item => {
                return (item.url.startsWith('http') ? profileSubIds.has(item.id) : profileNodeIds.has(item.id));
            });
        } else {
            return new Response('Profile not found or disabled', { status: 404 });
        }
    } else {
        // 如果没有 profileId，则使用所有启用的节点
        targetMisubs = allMisubs.filter(s => s.enabled);
    }


    let targetFormat = url.searchParams.get('target') || 'base64';
    if (!url.searchParams.has('target')) {
        const ua = userAgentHeader.toLowerCase();
        if (ua.includes('clash')) targetFormat = 'clash';
        if (ua.includes('sing-box')) targetFormat = 'singbox';
    }

    if (!url.searchParams.has('callback_token')) {
        const clientIp = request.headers.get('CF-Connecting-IP') || 'N/A';
        const message = `🚀 *MiSub 訂閱被存取* 🚀\n\n*客戶端 (User-Agent):*\n\`${userAgentHeader}\`\n\n*請求 IP:*\n\`${clientIp}\`\n*請求格式:*\n\`${targetFormat}\`${profileId ? `\n*訂閱組:*\n\`${subName}\`` : ''}`;
        context.waitUntil(sendTgNotification(config, message));
    }

    // 将筛选后的列表传递给处理函数
    const combinedNodeList = await generateCombinedNodeList(context, config, userAgentHeader, targetMisubs);
    const base64Content = btoa(unescape(encodeURIComponent(combinedNodeList)));

    if (targetFormat === 'base64') {
        const headers = { "Content-Type": "text/plain; charset=utf-8", 'Cache-Control': 'no-store, no-cache' };
        return new Response(base64Content, { headers });
    }

    const callbackToken = await getCallbackToken(env);
    // [重要修改] 回调 URL 现在也需要包含 profileId (如果存在)
    const callbackPath = profileId ? `/sub/${token}/${profileId}` : `/sub/${token}`;
    const callbackUrl = `${url.protocol}//${url.host}${callbackPath}?target=base64&callback_token=${callbackToken}`;
    
    // 如果是 subconverter 的回调请求，直接返回 base64 内容
    if (url.searchParams.get('callback_token') === callbackToken) {
         const headers = { "Content-Type": "text/plain; charset=utf-8", 'Cache-Control': 'no-store, no-cache' };
        return new Response(base64Content, { headers });
    }

    const subconverterUrl = new URL(`https://${config.subConverter}/sub`);
    subconverterUrl.searchParams.set('target', targetFormat);
    subconverterUrl.searchParams.set('url', callbackUrl);
    subconverterUrl.searchParams.set('config', config.subConfig);
    subconverterUrl.searchParams.set('new_name', 'true');

    try {
        const subconverterResponse = await fetch(subconverterUrl.toString(), {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!subconverterResponse.ok) {
            const errorBody = await subconverterResponse.text();
            throw new Error(`Subconverter service returned status: ${subconverterResponse.status}. Body: ${errorBody}`);
        }
        let originalText = await subconverterResponse.text();
        const correctedText = originalText
            .replace(/^Proxy:/m, 'proxies:')
            .replace(/^Proxy Group:/m, 'proxy-groups:')
            .replace(/^Rule:/m, 'rules:');
        const responseHeaders = new Headers(subconverterResponse.headers);
        // [重要修改] 文件名现在是动态的 (订阅组名或默认名)
        responseHeaders.set("Content-Disposition", `attachment; filename*=utf-8''${encodeURIComponent(subName)}`);
        responseHeaders.set('Content-Type', 'text/plain; charset=utf-8');
        responseHeaders.set('Cache-Control', 'no-store, no-cache');
        return new Response(correctedText, {
            status: subconverterResponse.status,
            statusText: subconverterResponse.statusText,
            headers: responseHeaders
        });
    } catch (error) {
        console.error(`[MiSub Final Error] ${error.message}`);
        return new Response(`Error connecting to subconverter: ${error.message}`, { status: 502 });
    }
}


// --- 回调Token辅助函数 (无修改) ---
async function getCallbackToken(env) {
    const secret = env.COOKIE_SECRET || 'default-callback-secret';
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode('callback-static-data'));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}


// --- [核心修改] Cloudflare Pages Functions 主入口 ---
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    try {
        if (url.pathname.startsWith('/api/')) {
            return handleApiRequest(request, env);
        }
        if (url.pathname.startsWith('/sub/')) {
            return handleMisubRequest(context);
        }
        if (url.pathname !== '/' && !url.pathname.includes('.') && !url.pathname.startsWith('/assets')) {
            const newPath = `/sub${url.pathname}`;
            const newUrl = new URL(newPath + url.search, url.origin);
            const newRequest = new Request(newUrl, request);
            const newContext = { ...context, request: newRequest };
            return handleMisubRequest(newContext);
        }
        return next();
    } catch (e) {
        console.error("Critical error in onRequest:", e);
        return new Response("Internal Server Error", { status: 500 });
    }
}