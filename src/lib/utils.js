//
// src/lib/utils.js
//
const isDev = import.meta.env.DEV;

export function extractNodeName(url) {
    if (!url) return '';
    url = url.trim();
    try {
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1 && hashIndex < url.length - 1) {
            return decodeURIComponent(url.substring(hashIndex + 1)).trim();
        }
        const protocolIndex = url.indexOf('://');
        if (protocolIndex === -1) return '';
        const protocol = url.substring(0, protocolIndex);
        const mainPart = url.substring(protocolIndex + 3).split('#')[0];
        switch (protocol) {
            case 'vmess': {
                // 修正：使用现代方法正确解码包含UTF-8字符的Base64
                let padded = mainPart.padEnd(mainPart.length + (4 - mainPart.length % 4) % 4, '=');
                let ps = '';
                try {
                    // 1. 使用 atob 将 Base64 解码为二进制字符串
                    const binaryString = atob(padded);

                    // 2. 将二进制字符串转换为 Uint8Array 字节数组
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    // 3. 使用 TextDecoder 将字节解码为正确的 UTF-8 字符串
                    const jsonString = new TextDecoder('utf-8').decode(bytes);

                    // 4. 解析 JSON
                    const node = JSON.parse(jsonString);

                    // 5. 直接获取节点名称，此时已是正确解码的字符串，无需再次处理
                    ps = node.ps || '';
                } catch (e) {
                    // 如果解码失败，可以保留一个回退逻辑，或者直接返回空字符串
                    console.error("Failed to decode vmess link:", e);
                }
                return ps;
            }
            case 'trojan':
            case 'vless': return mainPart.substring(mainPart.indexOf('@') + 1).split(':')[0] || '';
            case 'ss':
                const atIndexSS = mainPart.indexOf('@');
                if (atIndexSS !== -1) return mainPart.substring(atIndexSS + 1).split(':')[0] || '';
                try {
                    // 处理URL编码的base64部分
                    let base64Part = mainPart;
                    if (base64Part.includes('%')) {
                        base64Part = decodeURIComponent(base64Part);
                    }
                    const decodedSS = atob(base64Part);
                    const ssDecodedAtIndex = decodedSS.indexOf('@');
                    if (ssDecodedAtIndex !== -1) return decodedSS.substring(ssDecodedAtIndex + 1).split(':')[0] || '';
                } catch (e) {
                    if (isDev) {
                        console.debug('[Utils] Failed to decode SS base64, using raw text:', e);
                    }
                }
                return '';
            default:
                if (url.startsWith('http')) return new URL(url).hostname;
                return '';
        }
    } catch (e) { return url.substring(0, 50); }
}


/**
 * 为节点链接添加名称前缀
 * @param {string} link - 原始节点链接
 * @param {string} prefix - 要添加的前缀 (通常是订阅名)
 * @returns {string} - 添加了前缀的新链接
 */
export function prependNodeName(link, prefix) {
    if (!prefix) return link; // 如果没有前缀，直接返回原链接

    const hashIndex = link.lastIndexOf('#');

    // 如果链接没有 #fragment
    if (hashIndex === -1) {
        return `${link}#${encodeURIComponent(prefix)}`;
    }

    const baseLink = link.substring(0, hashIndex);
    const originalName = decodeURIComponent(link.substring(hashIndex + 1));

    // 如果原始名称已经包含了前缀，则不再重复添加
    if (originalName.startsWith(prefix)) {
        return link;
    }

    const newName = `${prefix} - ${originalName}`;
    return `${baseLink}#${encodeURIComponent(newName)}`;
}

/**
 * [新增] 从节点链接中提取主机和端口
 * 支持 VMess 的 JSON Base64、SS/SSR 的编码片段等特殊格式，
 * 如果无法解析会返回包含回退文本的对象。
 * @param {string} url - 节点链接
 * @returns {{host: string, port: string}} - 解析失败时返回 { host: '解析失败', port: 'N/A' }
 */
export function extractHostAndPort(url) {
    if (!url) return { host: '', port: '' };

    try {
        const protocolEndIndex = url.indexOf('://');
        if (protocolEndIndex === -1) throw new Error('无效的 URL：缺少协议头');

        const protocol = url.substring(0, protocolEndIndex);

        const fragmentStartIndex = url.indexOf('#');
        const mainPartEndIndex = fragmentStartIndex === -1 ? url.length : fragmentStartIndex;
        let mainPart = url.substring(protocolEndIndex + 3, mainPartEndIndex);

        // --- VMess 专用处理 ---
        if (protocol === 'vmess') {
            const decodedString = atob(mainPart);
            const nodeConfig = JSON.parse(decodedString);
            return { host: nodeConfig.add || '', port: String(nodeConfig.port || '') };
        }

        let decoded = false;
        // --- SS/SSR Base64 解码处理 ---
        if ((protocol === 'ss' || protocol === 'ssr') && mainPart.indexOf('@') === -1) {
            try {
                // 处理URL编码的base64部分
                let base64Part = mainPart;
                if (base64Part.includes('%')) {
                    base64Part = decodeURIComponent(base64Part);
                }
                mainPart = atob(base64Part);
                decoded = true;
            } catch (e) {
                if (isDev) {
                    console.debug('[Utils] Failed to decode base64 host segment, using raw text:', e);
                }
            }
        }

        // --- SSR 解码后专门处理 ---
        if (protocol === 'ssr' && decoded) {
            const parts = mainPart.split(':');
            if (parts.length >= 2) {
                return { host: parts[0], port: parts[1] };
            }
        }

        // --- 通用解析逻辑 (适用于 VLESS, Trojan, SS原文, 解码后的SS等) ---
        const atIndex = mainPart.lastIndexOf('@');
        let serverPart = atIndex !== -1 ? mainPart.substring(atIndex + 1) : mainPart;

        const queryIndex = serverPart.indexOf('?');
        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        }
        const pathIndex = serverPart.indexOf('/');
        if (pathIndex !== -1) {
            serverPart = serverPart.substring(0, pathIndex);
        }

        const lastColonIndex = serverPart.lastIndexOf(':');

        if (serverPart.startsWith('[') && serverPart.includes(']')) {
            const bracketEndIndex = serverPart.lastIndexOf(']');
            const host = serverPart.substring(1, bracketEndIndex);
            if (lastColonIndex > bracketEndIndex) {
                return { host, port: serverPart.substring(lastColonIndex + 1) };
            }
            return { host, port: '' };
        }

        if (lastColonIndex !== -1) {
            const potentialHost = serverPart.substring(0, lastColonIndex);
            const potentialPort = serverPart.substring(lastColonIndex + 1);
            if (potentialHost.includes(':')) { // 处理无端口的 IPv6
                return { host: serverPart, port: '' };
            }
            return { host: potentialHost, port: potentialPort };
        }

        if (serverPart) {
            return { host: serverPart, port: '' };
        }

        throw new Error('自定义解析失败');

    } catch (e) {
        console.error("提取主机和端口失败:", url, e);
        return { host: '解析失败', port: 'N/A' };
    }
}

/**
 * 解析User-Agent以获取客户端信息
 * @param {string} userAgent
 * @returns {{name: string, className: string}}
 */
export function getClientInfo(userAgent) {
    if (!userAgent) return { name: 'Unknown', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
    const ua = userAgent.toLowerCase();

    // === 优先级最高：复合型客户端/内核 ===
    // Karing - 包含 sing-box, mihomo 等关键字，必须最优先匹配
    if (ua.includes('karing')) return { name: 'Karing', className: 'bg-gradient-to-r from-pink-100 to-orange-100 text-pink-700 dark:from-pink-900/30 dark:to-orange-900/30 dark:text-pink-300' };

    // Mihomo - 可能包含 ClashMeta，需优先于 Meta 匹配
    if (ua.includes('mihomo')) return { name: 'Mihomo', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' };

    // === Sing-Box 衍生客户端 (需优先于通用 Sing-Box) ===
    // NekoBox
    if (ua.includes('nekobox')) return { name: 'NekoBox', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' };
    // Nekoray
    if (ua.includes('nekoray')) return { name: 'Nekoray', className: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/20 dark:text-fuchsia-300' };
    // Hiddify
    if (ua.includes('hiddify')) return { name: 'Hiddify', className: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300' };

    // === Clash 具体变种 (按特异性排序) ===
    // ClashX Pro
    if (ua.includes('clashx pro')) return { name: 'ClashX Pro', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' };
    // ClashX
    if (ua.includes('clashx')) return { name: 'ClashX', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
    // FlyClash (必须在 Clash Verge 之前匹配，因为其 UA 包含 "clash-verge" 字样)
    if (ua.includes('flyclash') || ua.includes('flclash')) return { name: 'FlClash', className: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300' };
    // Clash Verge (移除 'verge' 单独匹配，避免误匹配)
    if (ua.includes('clash-verge') || ua.includes('clash.verge')) return { name: 'Clash Verge', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' };
    // Nyanpasu
    if (ua.includes('nyanpasu')) return { name: 'Nyanpasu', className: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300' };

    // === 通用内核匹配 ===
    // Clash Meta 核心 (放在具体客户端之后)
    if (ua.includes('clash.meta') || ua.includes('clash-meta') || ua.includes('meta')) return { name: 'Clash Meta', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };

    // Sing-Box 通用
    if (ua.includes('sing-box') || ua.includes('singbox')) return { name: 'Sing-Box', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };

    // Clash 通用 (兜底)
    if (ua.includes('clash')) return { name: 'Clash', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };

    // === iOS/macOS 客户端 (Shadowrocket, Surge, Loon, etc) ===
    if (ua.includes('shadowrocket')) return { name: 'Shadowrocket', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' };
    if (ua.includes('surge')) return { name: 'Surge', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' };
    if (ua.includes('loon')) return { name: 'Loon', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
    if (ua.includes('quanx') || ua.includes('quantumult')) return { name: 'QuanX', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
    if (ua.includes('stash')) return { name: 'Stash', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };

    // === Windows/安卓/其他 ===
    if (ua.includes('v2rayn')) return { name: 'v2rayN', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
    if (ua.includes('v2rayng')) return { name: 'v2rayNG', className: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300' };
    if (ua.includes('surfboard')) return { name: 'Surfboard', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' };

    // === 浏览器/工具 ===
    if (
        ua.includes('chrome') ||
        ua.includes('firefox') ||
        ua.includes('safari') ||
        ua.includes('edge') ||
        ua.includes('mozilla')
    ) return { name: '浏览器', className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300' };

    if (
        ua.includes('curl') ||
        ua.includes('wget') ||
        ua.includes('python') ||
        ua.includes('go-http-client')
    ) return { name: '命令行', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };

    return { name: 'Other', className: 'bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-500' };
}

export { formatBytes } from '../shared/utils.js';
