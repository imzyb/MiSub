


import { createJsonResponse, createErrorResponse } from '../utils.js';

const KV_KEY_CLIENTS = 'misub_clients_v1';
const MAX_ICON_DATA_URL_BYTES = 200 * 1024;

function getKV(env) {
    return env?.MISUB_KV || null;
}

function isStorageUnavailableError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('kv storage is paused')
        || message.includes('storage is paused')
        || message.includes('namespace is paused');
}

const LEGACY_CLIENT_ICONS = {
    'clash-verge-rev': '⚡️',
    'clash-party': '🎉',
    'v2rayn': '💻',
    'v2rayng': '📱',
    'shadowrocket': '🚀',
    'hiddify': '🛡️',
    'nekobox': '🐱',
    'stash': '📦',
    'loon': '🎈',
    'surge': '⚡️',
    'flclash': '🦋',
    'clashmi': 'Ⓜ️',
    'flyclash': '✈️',
    'karing': '🦌',
    'quantumultx': '❌',
    'clashbox': '📦'
};

const LEGACY_ICON_ALIASES = {
    '/icons/clients/clash-verge-rev.png': '/icons/clients/clash-verge-rev.svg',
    '/icons/clients/clash-party.png': '/icons/clients/clash-party.svg',
    '/icons/clients/v2rayn.ico': '/icons/clients/v2rayn.svg',
    '/icons/clients/v2rayng.png': '/icons/clients/v2rayng.svg',
    '/icons/clients/shadowrocket.jpg': '/icons/clients/shadowrocket.svg',
    '/icons/clients/hiddify.png': '/icons/clients/hiddify.svg',
    '/icons/clients/nekobox.png': '/icons/clients/nekobox.svg',
    '/icons/clients/stash.jpg': '/icons/clients/stash.svg',
    '/icons/clients/loon.jpg': '/icons/clients/loon.svg',
    '/icons/clients/surge.jpg': '/icons/clients/surge.svg',
    '/icons/clients/flclash.png': '/icons/clients/flclash.svg',
    '/icons/clients/clashmi.png': '/icons/clients/clashmi.svg',
    '/icons/clients/flyclash.png': '/icons/clients/flyclash.svg',
    '/icons/clients/karing.png': '/icons/clients/karing.svg',
    '/icons/clients/quantumultx.jpg': '/icons/clients/quantumultx.svg',
    '/icons/clients/clashbox.png': '/icons/clients/clashbox.svg'
};

const DEFAULT_CLIENTS = [
    {
        id: 'clash-verge-rev',
        name: 'Clash Verge Rev',
        icon: '/icons/clients/clash-verge-rev.svg',
        description: '现代化的 Clash 客户端，界面美观，功能强大，支持多平台。',
        platforms: ['windows', 'macos', 'linux'],
        url: 'https://github.com/clash-verge-rev/clash-verge-rev/releases',
        repo: 'clash-verge-rev/clash-verge-rev',
        version: null
    },
    {
        id: 'clash-party',
        name: 'Clash-Party',
        icon: '/icons/clients/clash-party.svg',
        description: '基于 Electron 的 Mihomo 图形客户端，专注于简单易用的体验。',
        platforms: ['windows', 'macos', 'linux'],
        url: 'https://github.com/mihomo-party-org/clash-party/releases',
        repo: 'mihomo-party-org/clash-party',
        version: null
    },
    {
        id: 'v2rayn',
        name: 'v2rayN',
        icon: '/icons/clients/v2rayn.svg',
        description: 'Windows 平台最流行的 V2Ray/Xray 客户端，功能强大且易于使用。',
        platforms: ['windows', 'linux'],
        url: 'https://github.com/2dust/v2rayN/releases',
        repo: '2dust/v2rayN',
        version: null
    },
    {
        id: 'v2rayng',
        name: 'v2rayNG',
        icon: '/icons/clients/v2rayng.svg',
        description: 'Android 平台上最流行的通用代理工具，支持多种协议。',
        platforms: ['android'],
        url: 'https://github.com/2dust/v2rayNG/releases',
        repo: '2dust/v2rayNG',
        version: null
    },
    {
        id: 'shadowrocket',
        name: 'Shadowrocket',
        icon: '/icons/clients/shadowrocket.svg',
        description: 'iOS 平台功能强大的网络工具，需使用非中国区 Apple ID 下载。',
        platforms: ['ios'],
        url: 'https://apps.apple.com/us/app/shadowrocket/id932747118',
        repo: null,
        version: null
    },
    {
        id: 'hiddify',
        name: 'Hiddify',
        icon: '/icons/clients/hiddify.svg',
        description: '新一代通用客户端，支持 Sing-box 核心，全平台兼容。',
        platforms: ['windows', 'macos', 'linux', 'android', 'ios'],
        url: 'https://github.com/hiddify/hiddify-next/releases',
        repo: 'hiddify/hiddify-next',
        version: null
    },
    {
        id: 'nekobox',
        name: 'NekoBox',
        icon: '/icons/clients/nekobox.svg',
        description: '功能丰富的全能代理客户端，支持 Sing-box 和 Xray 核心。',
        platforms: ['android', 'windows'],
        url: 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases',
        repo: 'MatsuriDayo/NekoBoxForAndroid',
        version: null
    },
    {
        id: 'stash',
        name: 'Stash',
        icon: '/icons/clients/stash.svg',
        description: 'iOS 平台上强大的基于规则的代理实用工具，支持多种协议。',
        platforms: ['ios', 'macos'],
        url: 'https://apps.apple.com/us/app/stash-rule-based-proxy/id1596063349',
        repo: null,
        version: null
    },
    {
        id: 'loon',
        name: 'Loon',
        icon: '/icons/clients/loon.svg',
        description: 'iOS 平台功能强大的网络工具，界面简洁优雅，支持插件扩展。',
        platforms: ['ios', 'macos'],
        url: 'https://apps.apple.com/us/app/loon/id1373567447',
        repo: null,
        version: null
    },
    {
        id: 'surge',
        name: 'Surge',
        icon: '/icons/clients/surge.svg',
        description: 'iOS/macOS 平台的高级网络工具，拥有强大的性能和丰富的功能。',
        platforms: ['ios', 'macos'],
        url: 'https://nssurge.com/',
        repo: null,
        version: null
    },
    {
        id: 'flclash',
        name: 'FlClash',
        icon: '/icons/clients/flclash.svg',
        description: '基于 Flutter 开发的多平台 Clash 客户端，界面美观流畅。',
        platforms: ['windows', 'linux', 'android'],
        url: 'https://github.com/chen08209/FlClash/releases',
        repo: 'chen08209/FlClash',
        version: null
    },
    {
        id: 'clashmi',
        name: 'ClashMI',
        icon: '/icons/clients/clashmi.svg',
        description: '基于 Mihomo 内核的多平台客户端，简单易用，支持全平台。',
        platforms: ['windows', 'macos', 'linux', 'android', 'ios'],
        url: 'https://github.com/KaringX/clashmi/releases',
        repo: 'KaringX/clashmi',
        version: null
    },
    {
        id: 'flyclash',
        name: 'FlyClash',
        icon: '/icons/clients/flyclash.svg',
        description: '基于 ClashMeta 内核的轻量级客户端，专注于速度和稳定性。',
        platforms: ['windows', 'android'],
        url: 'https://github.com/GtxFury/FlyClash/releases',
        repo: 'GtxFury/FlyClash',
        version: null
    },
    {
        id: 'karing',
        name: 'Karing',
        icon: '/icons/clients/karing.svg',
        description: '简单的兼容 Clash/V2ray/Sing-box 的全平台客户端。',
        platforms: ['windows', 'macos', 'linux', 'android', 'ios'],
        url: 'https://github.com/KaringX/karing/releases',
        repo: 'KaringX/karing',
        version: null
    },
    {
        id: 'quantumultx',
        name: 'Quantumult X',
        icon: '/icons/clients/quantumultx.svg',
        description: 'iOS 平台功能强大的网络工具，界面精美，支持脚本。',
        platforms: ['ios'],
        url: 'https://apps.apple.com/us/app/quantumult-x/id1443988620',
        repo: null,
        version: null
    },
    {
        id: 'clashbox',
        name: 'ClashBox',
        icon: '/icons/clients/clashbox.svg',
        description: 'HarmonyOS NEXT 平台的原生 Clash 客户端，界面美观，性能强大。',
        platforms: ['HarmonyOS'],
        url: 'https://github.com/xiaobaigroup/ClashBox/releases',
        repo: 'xiaobaigroup/ClashBox',
        version: null
    }
];

const DEFAULT_ICON_BY_ID = DEFAULT_CLIENTS.reduce((map, client) => {
    map[client.id] = client.icon;
    return map;
}, {});

function migrateClientIcons(clients) {
    let updated = false;
    const nextClients = clients.map((client) => {
        const legacyIcon = LEGACY_CLIENT_ICONS[client.id];
        const defaultIcon = DEFAULT_ICON_BY_ID[client.id];
        if (!defaultIcon) return client;
        const aliasIcon = LEGACY_ICON_ALIASES[client.icon];
        if (client.icon === legacyIcon) {
            updated = true;
            return { ...client, icon: defaultIcon };
        }
        if (aliasIcon) {
            updated = true;
            return { ...client, icon: aliasIcon };
        }
        return client;
    });

    return { updated, clients: nextClients };
}

/**
 * Robust UUID generator
 * Falls back to Math.random if crypto.randomUUID is not available
 */
function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Handle client management requests
 * @param {Request} request 
 * @param {Object} env 
 */
export async function handleClientRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const kv = getKV(env);

    try {
        if (request.method === 'GET') {
            if (!kv) {
                return createJsonResponse({ success: true, data: DEFAULT_CLIENTS, storageUnavailable: true });
            }
            try {
                const raw = await kv.get(KV_KEY_CLIENTS);
                const data = raw ? JSON.parse(raw) : null;
                if (Array.isArray(data) && data.length > 0) {
                    const migration = migrateClientIcons(data);
                    if (migration.updated) {
                        try {
                            await kv.put(KV_KEY_CLIENTS, JSON.stringify(migration.clients));
                        } catch (writeError) {
                            if (!isStorageUnavailableError(writeError)) {
                                throw writeError;
                            }
                        }
                        return createJsonResponse({
                            success: true,
                            data: migration.clients,
                            storageUnavailable: false
                        });
                    }
                }
                return createJsonResponse({
                    success: true,
                    data: data || DEFAULT_CLIENTS,
                    storageUnavailable: false
                });
            } catch (readError) {
                if (isStorageUnavailableError(readError)) {
                    return createJsonResponse({
                        success: true,
                        data: DEFAULT_CLIENTS,
                        storageUnavailable: true,
                        message: 'KV 存储已暂停，客户端列表已回退为内置默认值。'
                    });
                }
                throw readError;
            }
        }

        if (!kv) {
            return createErrorResponse('KV 未绑定，写操作不可用', 503);
        }

        if (request.method === 'POST') {
            if (path.endsWith('/init')) {
                await kv.put(KV_KEY_CLIENTS, JSON.stringify(DEFAULT_CLIENTS));
                return createJsonResponse({
                    success: true,
                    message: 'Clients initialized',
                    data: DEFAULT_CLIENTS
                });
            }

            let body;
            try {
                body = await request.json();
            } catch (e) {
                return createErrorResponse('Invalid JSON body', 400);
            }

            let clients = await kv.get(KV_KEY_CLIENTS).then(r => r ? JSON.parse(r) : null) || [];

            if (Array.isArray(body)) {
                clients = body;
            } else {
                if (!body.name) {
                    return createErrorResponse('Client name is required', 400);
                }
                if (typeof body.icon === 'string' && body.icon.startsWith('data:')) {
                    if (body.icon.length > MAX_ICON_DATA_URL_BYTES) {
                        return createErrorResponse('Icon data URL is too large (max 200KB)', 400);
                    }
                }
                const index = clients.findIndex(c => c.id === body.id);
                if (index !== -1) {
                    clients[index] = { ...clients[index], ...body };
                } else {
                    if (!body.id) body.id = generateUUID();
                    clients.push(body);
                }
            }

            await kv.put(KV_KEY_CLIENTS, JSON.stringify(clients));
            return createJsonResponse({ success: true, data: clients });
        }

        if (request.method === 'DELETE') {
            const id = url.searchParams.get('id');
            if (!id) {
                return createErrorResponse('Client ID is required', 400);
            }

            let clients = await kv.get(KV_KEY_CLIENTS).then(r => r ? JSON.parse(r) : null) || [];
            const originalLength = clients.length;
            clients = clients.filter(c => c.id !== id);

            if (clients.length === originalLength) {
                return createErrorResponse('Client not found', 404);
            }

            await kv.put(KV_KEY_CLIENTS, JSON.stringify(clients));
            return createJsonResponse({ success: true, data: clients });
        }

        return createErrorResponse('Method Not Allowed', 405);
    } catch (e) {
        console.error('[Client Handler Error]', e);
        if (isStorageUnavailableError(e)) {
            return createErrorResponse('KV 存储已暂停，客户端配置当前无法保存。请先恢复 KV 绑定，或改用 D1。', 503);
        }
        return createErrorResponse(`Operation failed: ${e.message}`, 500);
    }
}
