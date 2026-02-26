/**
 * 节点解析工具模块
 * 提供节点URL解析和处理功能
 */

import yaml from 'js-yaml';
import { parseNodeInfo, extractNodeRegion } from './geo-utils.js';
// [注意] node-parser.js 在 functions/modules/utils/，而 node-utils.js 在 functions/utils/
// 所以需要向上两级找到 functions/utils/
import { fixNodeUrlEncoding, addFlagEmoji } from '../../utils/node-utils.js';
import { validateSS2022Node, fixSS2022Node } from './ss2022-validator.js';

/**
 * 支持的节点协议正则表达式
 */
export const NODE_PROTOCOL_REGEX = /^(ss|ssr|vmess|vless|trojan|hysteria2|hy2|hysteria|tuic|snell|naive\+https?|naive\+quic|socks5|socks|http|anytls):\/\//i;

/**
 * Base64编码辅助函数
 */
function base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

/**
 * URL-safe Base64 编码（SSR 标准格式）
 * 将 + 替换为 -，/ 替换为 _，去除尾部 = padding
 */
function base64UrlSafeEncode(str) {
    return base64Encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * 将 Clash 代理对象转换为标准 URL
 */
function convertClashProxyToUrl(proxy) {
    try {
        const type = (proxy.type || '').toLowerCase();
        const name = proxy.name || 'Untitled';
        const server = proxy.server;
        const port = proxy.port;

        if (!server || !port) return null;

        if (type === 'ss' || type === 'shadowsocks') {
            const userInfo = base64Encode(`${proxy.cipher}:${proxy.password}`);
            let url = `ss://${userInfo}@${server}:${port}`;

            // 支持 AnyTLS 插件
            if (proxy.plugin === 'anytls' || proxy.plugin === 'obfs-local') {
                const params = [];
                if (proxy.plugin) params.push(`plugin=${proxy.plugin}`);

                const pluginOpts = proxy['plugin-opts'];
                if (pluginOpts) {
                    if (pluginOpts.enabled !== undefined) params.push(`enabled=${pluginOpts.enabled}`);
                    if (pluginOpts.padding !== undefined) params.push(`padding=${pluginOpts.padding}`);
                    if (pluginOpts.mode) params.push(`obfs=${pluginOpts.mode}`);
                    if (pluginOpts.host) params.push(`obfs-host=${encodeURIComponent(pluginOpts.host)}`);
                }

                if (params.length > 0) {
                    url += `?${params.join('&')}`;
                }
            }

            url += `#${encodeURIComponent(name)}`;
            return url;
        }

        if (type === 'ssr' || type === 'shadowsocksr') {
            const password = base64UrlSafeEncode(proxy.password);
            const params = `obfs=${proxy.obfs || 'plain'}&obfsparam=${base64UrlSafeEncode(proxy['obfs-param'] || '')}&protocol=${proxy.protocol || 'origin'}&protoparam=${base64UrlSafeEncode(proxy['protocol-param'] || '')}&remarks=${base64UrlSafeEncode(name)}`;
            const ssrBody = `${server}:${port}:${proxy.protocol || 'origin'}:${proxy.cipher || 'none'}:${proxy.obfs || 'plain'}:${password}/?${params}`;
            return `ssr://${base64UrlSafeEncode(ssrBody)}`;
        }

        if (type === 'vmess') {
            // 兼容 uuid 和 UUID 两种写法
            const uuid = proxy.uuid || proxy.UUID || '';
            const vmessConfig = {
                v: "2",
                ps: name,
                add: server,
                port: port,
                id: uuid,
                aid: proxy.alterId || 0,
                net: proxy.network || 'tcp',
                type: 'none',
                host: proxy.servername || proxy.wsOpts?.headers?.Host || proxy['ws-opts']?.headers?.Host || '',
                path: proxy.wsOpts?.path || proxy['ws-opts']?.path || '',
                tls: proxy.tls ? 'tls' : ''
            };
            return `vmess://${base64Encode(JSON.stringify(vmessConfig))}`;
        }

        if (type === 'trojan') {
            const params = [];
            const network = proxy.network || 'tcp';
            if (network === 'ws') params.push('type=ws');

            const wsOpts = proxy.wsOpts || proxy['ws-opts'];
            if (wsOpts) {
                if (wsOpts.path) params.push(`path=${encodeURIComponent(wsOpts.path)}`);
                if (wsOpts.headers?.Host) params.push(`host=${encodeURIComponent(wsOpts.headers.Host)}`);
            }

            if (proxy.sni) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.skipCertVerify) params.push('allowInsecure=1');

            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `trojan://${encodeURIComponent(proxy.password)}@${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'vless') {
            // 兼容 uuid 和 UUID 两种写法
            const uuid = proxy.uuid || proxy.UUID;
            if (!uuid) return null; // UUID 是必需的

            const params = ['encryption=none'];
            if (proxy.network) params.push(`type=${proxy.network}`);

            const wsOpts = proxy.wsOpts || proxy['ws-opts'];
            if (wsOpts) {
                if (wsOpts.path) params.push(`path=${encodeURIComponent(wsOpts.path)}`);
                if (wsOpts.headers?.Host) params.push(`host=${encodeURIComponent(wsOpts.headers.Host)}`);
            }

            // Reality 协议支持
            const realityOpts = proxy['reality-opts'];
            if (realityOpts) {
                params.push('security=reality');
                if (realityOpts['public-key']) params.push(`pbk=${encodeURIComponent(realityOpts['public-key'])}`);
                if (realityOpts['short-id']) params.push(`sid=${encodeURIComponent(realityOpts['short-id'])}`);
            } else if (proxy.tls) {
                params.push('security=tls');
            }

            if (proxy.flow) params.push(`flow=${proxy.flow}`);
            // 兼容 servername 和 sni
            if (proxy.servername || proxy.sni) params.push(`sni=${encodeURIComponent(proxy.servername || proxy.sni)}`);
            // 兼容 client-fingerprint
            if (proxy['client-fingerprint']) params.push(`fp=${encodeURIComponent(proxy['client-fingerprint'])}`);

            // dialer-proxy 链式代理支持 (使用自定义参数 dp)
            if (proxy['dialer-proxy']) params.push(`dp=${encodeURIComponent(proxy['dialer-proxy'])}`);

            return `vless://${uuid}@${server}:${port}?${params.join('&')}#${encodeURIComponent(name)}`;
        }

        if (type === 'hysteria2') {
            const params = [];
            const password = proxy.password || proxy.auth || '';
            if (password) params.push(`obfs-password=${encodeURIComponent(password)}`);
            if (proxy.sni) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.skipCertVerify) params.push('insecure=1');

            return `hysteria2://${password}@${server}:${port}?${params.join('&')}#${encodeURIComponent(name)}`;
        }

        if (type === 'socks5') {
            let auth = '';
            if (proxy.username && proxy.password) {
                auth = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`;
            }
            return `socks5://${auth}${server}:${port}#${encodeURIComponent(name)}`;
        }

        if (type === 'http') {
            let auth = '';
            if (proxy.username && proxy.password) {
                auth = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`;
            }
            return `http://${auth}${server}:${port}#${encodeURIComponent(name)}`;
        }

        if (type === 'snell') {
            const params = [];
            if (proxy.version) params.push(`version=${proxy.version}`);

            // [增强] 支持 reuse 和 tfo 参数
            if (proxy.reuse !== undefined) params.push(`reuse=${proxy.reuse}`);
            if (proxy.tfo !== undefined) params.push(`tfo=${proxy.tfo}`);

            const obfsOpts = proxy['obfs-opts'];
            if (obfsOpts) {
                if (obfsOpts.mode) params.push(`obfs=${obfsOpts.mode}`);
                if (obfsOpts.host) params.push(`obfs-host=${encodeURIComponent(obfsOpts.host)}`);
            }

            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `snell://${encodeURIComponent(proxy.psk)}@${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'naive' || proxy.protocol === 'naive') {
            const username = proxy.username || '';
            const password = proxy.password || '';
            const auth = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';

            const params = [];
            if (proxy.padding !== undefined) params.push(`padding=${proxy.padding}`);
            if (proxy['extra-headers']) params.push(`extra-headers=${encodeURIComponent(proxy['extra-headers'])}`);

            const query = params.length > 0 ? `?${params.join('&')}` : '';
            const scheme = proxy.quic ? 'naive+quic' : 'naive+https';
            return `${scheme}://${auth}${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        // [新增] 支持 anytls 类型代理
        if (type === 'anytls') {
            const password = proxy.password || '';
            const params = [];

            if (proxy.sni) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.alpn) {
                const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
                params.push(`alpn=${encodeURIComponent(alpn)}`);
            }
            if (proxy['skip-cert-verify']) params.push('insecure=1');
            if (proxy.padding !== undefined) params.push(`padding=${proxy.padding}`);

            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `anytls://${encodeURIComponent(password)}@${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        return null;
    } catch (e) {
        console.error('Error converting proxy:', e);
        return null;
    }
}

/**
 * 从文本中提取所有有效的节点URL
 * 支持：Clash YAML, Base64, 纯文本列表
 */
export function extractValidNodes(text) {
    if (!text || typeof text !== 'string') return [];

    let nodes = [];

    // 1. 尝试解析为 Clash YAML
    // 只有当包含 proxies 关键字时才尝试，避免普通文本解析报错
    const lowerText = text.toLowerCase();
    if (/\bproxies\s*:/.test(lowerText)) {
        try {
            const yamlObj = yaml.load(text);
            // 兼容 proxies 和 Proxy 字段
            const proxies = yamlObj.proxies || yamlObj.Proxy;

            if (Array.isArray(proxies)) {
                proxies.forEach(proxy => {
                    const url = convertClashProxyToUrl(proxy);
                    if (url) nodes.push(url);
                });
                // 如果成功解析出节点，直接返回，不再尝试其他方式
                if (nodes.length > 0) return nodes;
            }
        } catch (e) {
            console.debug('[NodeParser] YAML parse failed, trying other formats:', e);
        }
    }

    // 2. 尝试解码 Base64 订阅内容
    let processedText = text;
    try {
        const cleanedText = text.replace(/\s/g, '');
        // 标准化 URL-safe Base64，便于后续解码
        let normalized = cleanedText.replace(/-/g, '+').replace(/_/g, '/');
        const padding = normalized.length % 4;
        if (padding) {
            normalized += '='.repeat(4 - padding);
        }
        const base64Regex = /^[A-Za-z0-9+/=]+$/;
        if (base64Regex.test(normalized) && normalized.length > 20) {
            const binaryString = atob(normalized);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            processedText = new TextDecoder('utf-8').decode(bytes);
        }
    } catch (e) {
        console.debug('[NodeParser] Base64 decode failed, using raw text:', e);
    }

    // 3. 正则提取链接 (ss://, vmess:// 等)
    const lines = processedText
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.trim());

    for (const line of lines) {
        if (NODE_PROTOCOL_REGEX.test(line)) {
            nodes.push(line);
        }
    }

    return nodes;
}

/**
 * 支持的 Shadowsocks 加密算法 (AEAD)
 * 现代客户端 (如 Sing-box) 已弃用非 AEAD 算法 (如 aes-256-cfb, rc4-md5)
 */
const SUPPORTED_SS_CIPHERS = [
    'aes-128-gcm', 'aes-256-gcm',
    'chacha20-poly1305', 'chacha20-ietf-poly1305',
    'xchacha20-ietf-poly1305',
    '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305'
];

/**
 * 验证 UUID 格式
 */
function isValidUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * 解析节点列表 (用于预览和计数)
 */
export function parseNodeList(content) {
    const validNodes = extractValidNodes(content);

    return validNodes.map(nodeUrl => {
        // 1. 修复编码 (如 Hysteria2 密码)
        let fixedUrl = fixNodeUrlEncoding(nodeUrl);

        // 2. [新增] 验证和修复 SS 2022 节点 & 过滤传统 SS 算法
        let ss2022Warning = null;
        if (fixedUrl.startsWith('ss://')) {
            // 2.1 提取加密算法
            let method = '';
            try {
                let body = fixedUrl.substring(5); // remove ss://
                const hashIndex = body.indexOf('#');
                if (hashIndex !== -1) body = body.substring(0, hashIndex);

                // 处理 user@server:port 格式 (明文)
                const atIndex = body.lastIndexOf('@');
                if (atIndex !== -1 && !body.includes('://')) { // 排除 SIP002 base64 整体编码可能包含 @
                    // 明文格式通常不常见用于订阅，多见于手动配置
                    // userInfo = method:password
                    const userInfo = body.substring(0, atIndex);
                    // 还要考虑是否是 Base64 编码的 userInfo
                    // 尝试简单判断: 包含 : 可能是明文，否则可能是 Base64
                    if (userInfo.includes(':')) {
                        method = userInfo.split(':')[0];
                    } else {
                        // Base64 解码 userInfo
                        try {
                            const decodedUser = atob(userInfo);
                            if (decodedUser.includes(':')) method = decodedUser.split(':')[0];
                        } catch (e) {
                            console.debug('[NodeParser] Failed to decode SS user info:', e);
                        }
                    }
                } else {
                    // 处理 Base64 格式 (SIP002) ss://base64(method:password@server:port)
                    // 或者 ss://base64(method:password)@server:port (旧式)
                    try {
                        let decoded = atob(body);
                        // 格式: method:password@server:port
                        if (decoded.includes('@')) {
                            const userInfo = decoded.split('@')[0];
                            if (userInfo.includes(':')) method = userInfo.split(':')[0];
                        }
                    } catch (e) {
                        // 如果整体解码失败，可能是旧式 ss://userInfoBase64@server:port
                        const atIndex = body.lastIndexOf('@');
                        if (atIndex !== -1) {
                            const userInfoBase64 = body.substring(0, atIndex);
                            try {
                                const decodedUser = atob(userInfoBase64);
                                if (decodedUser.includes(':')) method = decodedUser.split(':')[0];
                            } catch (e2) {
                                console.debug('[NodeParser] Failed to decode SS user info fallback:', e2);
                            }
                        } else {
                            console.debug('[NodeParser] Failed to decode SS payload:', e);
                        }
                    }
                }
            } catch (e) {
                console.debug('[NodeParser] Failed to extract SS cipher:', e);
            }

            // 2.2 验证加密算法
            if (method) {
                const normalizedMethod = method.toLowerCase();
                if (!SUPPORTED_SS_CIPHERS.includes(normalizedMethod)) {
                    return null;
                }
            }

            const validation = validateSS2022Node(fixedUrl);

            // ... (rest of SS2022 validation)

            if (!validation.valid && validation.details?.suggestedCipher) {
                // 尝试自动修复
                const fixResult = fixSS2022Node(fixedUrl);
                if (fixResult.fixed) {
                    fixedUrl = fixResult.fixedUrl;
                    ss2022Warning = {
                        type: 'ss2022_auto_fixed',
                        message: `已自动修复: ${fixResult.changes.from} → ${fixResult.changes.to}`,
                        originalCipher: fixResult.changes.from,
                        fixedCipher: fixResult.changes.to
                    };
                    console.warn(`[SS 2022] 自动修复节点: ${fixResult.changes.reason}`);
                } else {
                    ss2022Warning = {
                        type: 'ss2022_invalid',
                        message: validation.error,
                        details: validation.details
                    };
                    console.error(`[SS 2022] 节点验证失败:`, validation.details);
                }
            } else if (validation.warning) {
                ss2022Warning = {
                    type: 'ss2022_warning',
                    message: validation.warning
                };
            }
        }

        // 3. 添加 Emoji (已移至 applyNodeTransformPipeline 统一处理，遵循配置)
        // fixedUrl = addFlagEmoji(fixedUrl);

        // 4. 解析信息
        const nodeInfo = parseNodeInfo(fixedUrl);

        // 5. [新增] 严格 UUID 验证 (过滤 auto: 开头的垃圾节点)
        // 仅针对 VLESS 和 VMess (VMess 通常在 parseNodeInfo 内部处理，这里主要处理 VLESS 链接中的 UUID)
        let isValidNode = true;
        if (nodeInfo.protocol === 'vless') {
            // VLESS 链接格式: 
            // 1. 标准: vless://uuid@host:port
            // 2. Base64: vless://base64(uuid@host:port)
            let id = null;

            // 尝试标准格式 vless://uuid@host:port 优先
            const matchStandard = fixedUrl.match(/^vless:\/\/([0-9a-fA-F-]{36})@/);

            if (matchStandard) {
                id = matchStandard[1];
            } else {
                // 尝试从 @ 前面提取 (可能是非标准 uuid 或 Base64)
                const matchAnyUser = fixedUrl.match(/^vless:\/\/([^@]+)@/);
                if (matchAnyUser) {
                    const userPart = matchAnyUser[1];
                    // 检查是否像是 Base64 编码 (长度较长且只包含 Base64 字符)
                    const base64Regex = /^[A-Za-z0-9+/=_-]+$/;
                    if (userPart.length > 40 && base64Regex.test(userPart)) {
                        // 可能是 Base64 编码的内容，尝试解码
                        try {
                            let safeBody = userPart.replace(/-/g, '+').replace(/_/g, '/');
                            while (safeBody.length % 4) {
                                safeBody += '=';
                            }
                            const decoded = atob(safeBody);
                            // 解码后检查是否包含 auto: 等无效前缀
                            if (decoded.startsWith('auto:')) {
                                id = decoded; // 这样后面 validation 会失败
                            } else {
                                // 解码成功但不是 auto: 开头，可能是正常 UUID
                                id = decoded;
                            }
                        } catch (e) {
                            // Base64 解码失败，使用原始 userPart 作为 ID
                            id = userPart;
                        }
                    } else {
                        // 不像 Base64，直接使用 userPart 作为 ID
                        id = userPart;
                    }
                }
            }

            if (id) {
                // 如果是 auto: 开头，去掉 auto: 再验证 UUID?
                // 不，用户不想看这些节点，直接验证完整 ID 是否为 UUID
                // 包含 auto: 的 ID 会导致 isValidUUID 返回 false
                if (!isValidUUID(id)) {
                    isValidNode = false;
                }
            }
        } else if (nodeInfo.protocol === 'vmess') {
            // 对于 vmess，parseNodeInfo 并不返回具体配置，我们需要简单检查一下
            // 如果是 vmess://(base64)，解码后看 id
            if (fixedUrl.startsWith('vmess://')) {
                try {
                    const base64Part = fixedUrl.substring(8);
                    // Use robust Base64 decoding (URL safe + padding)
                    let safeBody = base64Part.replace(/-/g, '+').replace(/_/g, '/');
                    while (safeBody.length % 4) {
                        safeBody += '=';
                    }
                    const jsonStr = atob(safeBody);
                    const config = JSON.parse(jsonStr);
                    if (config && config.id && !isValidUUID(config.id)) {
                        isValidNode = false;
                    }
                } catch (e) {
                    console.debug('[NodeParser] VMess decode failed, keeping original node:', e);
                }
            }
        }

        if (!isValidNode) {
            return null;
        }

        // 6. 添加 SS 2022 警告信息
        const result = {
            url: fixedUrl,
            ...nodeInfo
        };

        if (ss2022Warning) {
            result.warning = ss2022Warning;
        }

        return result;
    }).filter(node => node !== null); // 过滤掉无效节点
}

/**
 * 统计节点协议类型分布
 */
export function calculateProtocolStats(nodes) {
    const stats = {};
    const total = nodes.length;
    nodes.forEach(node => {
        const protocol = node.protocol || 'unknown';
        stats[protocol] = (stats[protocol] || 0) + 1;
    });
    for (const [protocol, count] of Object.entries(stats)) {
        stats[protocol] = { count, percentage: Math.round((count / total) * 100) };
    }
    return stats;
}

/**
 * 统计节点地区分布
 */
export function calculateRegionStats(nodes) {
    const stats = {};
    const total = nodes.length;
    nodes.forEach(node => {
        const region = extractNodeRegion(node.name || '');
        stats[region] = (stats[region] || 0) + 1;
    });
    for (const [region, count] of Object.entries(stats)) {
        stats[region] = { count, percentage: Math.round((count / total) * 100) };
    }
    return stats;
}

/**
 * 去除重复节点
 */
export function removeDuplicateNodes(nodes) {
    if (!Array.isArray(nodes)) return [];
    const seen = new Set();
    return nodes.filter(node => {
        const url = node.url || '';
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
    });
}

/**
 * 格式化节点数量显示
 */
export function formatNodeCount(count) {
    if (typeof count !== 'number' || count < 0) return '0 个节点';
    return `${count} 个节点`;
}

/**
 * 解析 Snell URL 为 Clash 代理对象
 * @param {string} url - Snell URL
 * @returns {Object|null} Clash 代理对象或 null
 */
export function parseSnellUrl(url) {
    try {
        const urlObj = new URL(url);

        // 提取 PSK (可能在 username 或 pathname 中)
        let psk = '';
        if (urlObj.username) {
            psk = decodeURIComponent(urlObj.username);
        } else {
            const pathMatch = urlObj.pathname.match(/^\/\/([^@]+)@/);
            if (pathMatch) {
                psk = decodeURIComponent(pathMatch[1]);
            }
        }

        const server = urlObj.hostname;
        const port = parseInt(urlObj.port);
        const name = urlObj.hash ? decodeURIComponent(urlObj.hash.substring(1)) : 'Snell';

        if (!psk || !server || !port) {
            return null;
        }

        const proxy = {
            type: 'snell',
            name: name,
            server: server,
            port: port,
            psk: psk
        };

        // 解析查询参数
        const version = urlObj.searchParams.get('version');
        if (version) proxy.version = parseInt(version);

        const reuse = urlObj.searchParams.get('reuse');
        if (reuse !== null) proxy.reuse = reuse === 'true';

        const tfo = urlObj.searchParams.get('tfo');
        if (tfo !== null) proxy.tfo = tfo === 'true';

        const obfs = urlObj.searchParams.get('obfs');
        const obfsHost = urlObj.searchParams.get('obfs-host');
        if (obfs || obfsHost) {
            proxy['obfs-opts'] = {};
            if (obfs) proxy['obfs-opts'].mode = obfs;
            if (obfsHost) proxy['obfs-opts'].host = decodeURIComponent(obfsHost);
        }

        return proxy;
    } catch (e) {
        console.error('Snell URL 解析失败:', e);
        return null;
    }
}

/**
 * 验证 Snell 节点配置
 * @param {string} url - Snell URL
 * @returns {Object} 验证结果 {valid, error?, details?, proxy?}
 */
export function validateSnellNode(url) {
    try {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: '无效的 URL 格式' };
        }

        if (!url.startsWith('snell://')) {
            return { valid: false, error: '不是 Snell 协议 URL' };
        }

        // 提前验证端口，避免 URL 解析在端口范围错误时直接抛出
        const portMatch = url.match(/:(\d+)(?:[/?#]|$)/);
        if (portMatch) {
            const portNumber = parseInt(portMatch[1]);
            if (portNumber < 1 || portNumber > 65535) {
                return {
                    valid: false,
                    error: `端口号无效: ${portNumber} (范围: 1-65535)`,
                    details: { port: portNumber }
                };
            }
        }

        const proxy = parseSnellUrl(url);
        if (!proxy) {
            return { valid: false, error: '无效的 Snell URL 格式' };
        }

        // 验证必需参数
        if (!proxy.server || !proxy.port || !proxy.psk) {
            return {
                valid: false,
                error: 'Snell 节点缺少必需参数 (server/port/psk)',
                details: { server: proxy.server, port: proxy.port, psk: !!proxy.psk }
            };
        }

        // 验证版本号 (Snell 支持 v1-v5)
        if (proxy.version && (proxy.version < 1 || proxy.version > 5)) {
            return {
                valid: false,
                error: `Snell 版本号无效: ${proxy.version} (支持 1-5)`,
                details: { version: proxy.version }
            };
        }

        // 验证混淆模式
        if (proxy['obfs-opts']?.mode) {
            const validObfsModes = ['http', 'tls'];
            if (!validObfsModes.includes(proxy['obfs-opts'].mode)) {
                return {
                    valid: false,
                    error: `不支持的混淆模式: ${proxy['obfs-opts'].mode} (支持: ${validObfsModes.join(', ')})`,
                    details: { obfsMode: proxy['obfs-opts'].mode }
                };
            }
        }

        // 验证端口范围
        if (proxy.port < 1 || proxy.port > 65535) {
            return {
                valid: false,
                error: `端口号无效: ${proxy.port} (范围: 1-65535)`,
                details: { port: proxy.port }
            };
        }

        return { valid: true, proxy };
    } catch (e) {
        return { valid: false, error: e.message };
    }
}
