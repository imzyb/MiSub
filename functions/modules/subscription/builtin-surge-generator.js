/**
 * 内置 Surge 配置生成器
 * 不依赖外部 SubConverter，直接将节点 URL 转换为 Surge 配置
 * 严格遵循 Surge 官方文档 https://manual.nssurge.com/policy/proxy.html
 *
 * 支持协议：SS、VMess、Trojan、Snell、TUIC、Hysteria2、AnyTLS、WireGuard、HTTP(S)、SOCKS5
 * 注意：Surge 不支持 VLESS 协议，VLESS 节点会被跳过
 */

import { urlToClashProxy, urlsToClashProxies } from '../../utils/url-to-clash.js';
import { getUniqueName } from './name-utils.js';
import { POLICY_GROUPS, getBuiltinRules, getRemoteProviderDefinitions, DEFAULT_SELECT_GROUP, DEFAULT_RELAY_GROUP, pruneProxyGroups } from './builtin-rules-provider.js';

/**
 * 清理字符串中的控制字符（保留换行和制表符）
 * @param {string} str - 输入字符串
 * @returns {string} 清理后的字符串
 */
function cleanControlChars(str) {
    if (typeof str !== 'string') return str;
    // 移除控制字符，但保留换行(\n)、回车(\r)、制表符(\t)
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * 安全化节点名称，移除或转义可能破坏 Surge INI 格式的字符
 * Surge 使用 "name = type, ..." 格式，名称中的逗号和等号会破坏解析
 * @param {string} name - 原始节点名称
 * @returns {string} 安全化后的名称
 */
function sanitizeNodeName(name) {
    if (!name) return 'Untitled';
    // 清理控制字符
    let safe = cleanControlChars(name);
    // 移除会破坏 INI 解析的字符：逗号 → 空格，等号 → 横杠
    safe = safe.replace(/,/g, ' ').replace(/=/g, '-');
    // 合并多余空格
    safe = safe.replace(/\s+/g, ' ').trim();
    return safe || 'Untitled';
}

/**
 * 对可能含特殊字符（逗号、空格、等号）的参数值进行双引号包裹
 * Surge 配置使用逗号分隔参数，若值本身含逗号则必须引用
 * @param {string} value
 * @returns {string}
 */
function surgeQuote(value) {
    if (!value) return '';
    // 含逗号、空格或双引号时需要包裹
    if (/[,\s"=]/.test(value)) {
        return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
}

/**
 * 将 Clash 代理对象转换为 Surge 配置结果
 * @param {Object} proxy - Clash 格式代理对象
 * @returns {{proxyLine: string, wireguardSection?: string}|null}
 *   - proxyLine: Surge [Proxy] 行
 *   - wireguardSection: WireGuard 独立 section（仅 WireGuard 协议有）
 */
function clashProxyToSurgeResult(proxy) {
    if (!proxy || !proxy.server || !proxy.port) return null;

    const name = sanitizeNodeName(proxy.name);
    const type = (proxy.type || '').toLowerCase();
    const server = proxy.server;
    const port = proxy.port;

    // 构造参数列表（第一个元素是 "name = type"，后跟位置参数，再跟具名参数）
    const parts = [];

    if (type === 'ss' || type === 'shadowsocks') {
        // 格式: name = ss, server, port, encrypt-method=xxx, password=xxx
        parts.push(`${name} = ss`);
        parts.push(server);
        parts.push(String(port));
        parts.push(`encrypt-method=${proxy.cipher || 'aes-128-gcm'}`);
        parts.push(`password=${surgeQuote(proxy.password || '')}`);
        // 插件支持 (obfs / v2ray-plugin)
        const plugin = proxy.plugin || '';
        const opts = proxy['plugin-opts'] || proxy.pluginOpts || {};

        if (plugin === 'obfs-local' || opts.mode === 'http' || opts.mode === 'tls' || proxy.obfs) {
            const obfsMode = opts.mode || proxy.obfs;
            if (obfsMode) parts.push(`obfs=${obfsMode}`);
            const obfsHost = opts.host || proxy['obfs-host'];
            if (obfsHost) parts.push(`obfs-host=${obfsHost}`);
            const obfsUri = opts.uri || proxy['obfs-uri'];
            if (obfsUri) parts.push(`obfs-uri=${obfsUri}`);
        } else if (plugin === 'v2ray-plugin' || opts.mode === 'websocket') {
            // v2ray-plugin 映射为 Surge 原生 WS 支持
            if (opts.mode === 'websocket' || opts.mode === 'websocket-tls') {
                parts.push('ws=true');
                if (opts.path) parts.push(`ws-path=${surgeQuote(opts.path)}`);
                if (opts.host) parts.push(`ws-headers=Host:${opts.host}`);
                if (opts.tls || opts.mode === 'websocket-tls') parts.push('tls=true');
            }
        }
        // SS UDP 的独立端口（ShadowTLS 场景）
        if (proxy['udp-port']) parts.push(`udp-port=${proxy['udp-port']}`);
        // SS 的 UDP 需要手动开启
        if (proxy.udp) parts.push('udp-relay=true');
    } else if (type === 'vmess') {
        // 格式: name = vmess, server, port, username=uuid
        parts.push(`${name} = vmess`);
        parts.push(server);
        parts.push(String(port));
        parts.push(`username=${proxy.uuid || ''}`);
        // 加密方式
        if (proxy.cipher && proxy.cipher !== 'auto') {
            parts.push(`encrypt-method=${proxy.cipher}`);
        }
        // TLS
        if (proxy.tls) parts.push('tls=true');
        // WebSocket
        if (proxy.network === 'ws') {
            parts.push('ws=true');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) parts.push(`ws-path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) parts.push(`ws-headers=Host:${wsOpts.headers.Host}`);
        }
        // vmess-aead: alterId 为 0 或未指定时默认启用（现代 VMess 标准）
        if (proxy.alterId === 0 || proxy.alterId === undefined || proxy.alterId === null) {
            parts.push('vmess-aead=true');
        }
        // TLS 通用参数
        appendTlsParams(parts, proxy);
    } else if (type === 'trojan') {
        // 格式: name = trojan, server, port, password=xxx
        parts.push(`${name} = trojan`);
        parts.push(server);
        parts.push(String(port));
        parts.push(`password=${surgeQuote(proxy.password || '')}`);
        // WebSocket
        if (proxy.network === 'ws') {
            parts.push('ws=true');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) parts.push(`ws-path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) parts.push(`ws-headers=Host:${wsOpts.headers.Host}`);
        }
        // TLS 通用参数（Trojan 默认走 TLS）
        appendTlsParams(parts, proxy);
    } else if (type === 'hysteria2' || type === 'hy2') {
        // 格式: name = hysteria2, server, port, password=xxx
        // Hysteria2 原生基于 QUIC/UDP，无需 udp-relay 参数
        parts.push(`${name} = hysteria2`);
        parts.push(server);
        parts.push(String(port));
        parts.push(`password=${surgeQuote(proxy.password || '')}`);
        // 带宽限制（可选，单位 Mbps）
        if (proxy['down'] || proxy['download-bandwidth']) {
            parts.push(`download-bandwidth=${proxy['down'] || proxy['download-bandwidth']}`);
        }
        // 端口跳跃（Surge 支持的高级功能）
        if (proxy['port-hopping']) {
            parts.push(`port-hopping=${proxy['port-hopping']}`);
        }
        if (proxy['port-hopping-interval']) {
            parts.push(`port-hopping-interval=${proxy['port-hopping-interval']}`);
        }
        // TLS 通用参数
        appendTlsParams(parts, proxy);
    } else if (type === 'tuic') {
        // 格式: name = tuic, server, port, token=xxx
        // TUIC v5 使用 uuid + password 格式，Surge 使用 token 参数
        parts.push(`${name} = tuic`);
        parts.push(server);
        parts.push(String(port));
        // 回退链：token → uuid:password → password
        let tokenValue = proxy.token;
        if (!tokenValue && proxy.uuid) {
            // TUIC v5: uuid 作为 token，password 单独传递（部分实现中合并为 uuid:password）
            tokenValue = proxy.password ? `${proxy.uuid}:${proxy.password}` : proxy.uuid;
        }
        if (!tokenValue) tokenValue = proxy.password || '';
        parts.push(`token=${surgeQuote(tokenValue)}`);
        // alpn（必须与服务端 ALPN 匹配）
        if (proxy.alpn) {
            const alpnStr = Array.isArray(proxy.alpn) ? proxy.alpn[0] : proxy.alpn;
            parts.push(`alpn=${alpnStr}`);
        }
        // 端口跳跃
        if (proxy['port-hopping']) {
            parts.push(`port-hopping=${proxy['port-hopping']}`);
        }
        if (proxy['port-hopping-interval']) {
            parts.push(`port-hopping-interval=${proxy['port-hopping-interval']}`);
        }
        // TLS 通用参数
        appendTlsParams(parts, proxy);
    } else if (type === 'snell') {
        // 格式: name = snell, server, port, psk=xxx, version=x
        parts.push(`${name} = snell`);
        parts.push(server);
        parts.push(String(port));
        parts.push(`psk=${surgeQuote(proxy.psk || proxy.password || '')}`);
        if (proxy.version) parts.push(`version=${proxy.version}`);
        // 连接复用（Snell V4 可选）
        if (proxy.reuse !== undefined) parts.push(`reuse=${proxy.reuse}`);
        // TCP Fast Open
        if (proxy.tfo !== undefined) parts.push(`tfo=${proxy.tfo}`);
        const obfsOpts = proxy['obfs-opts'];
        if (obfsOpts) {
            if (obfsOpts.mode && obfsOpts.mode !== 'none') parts.push(`obfs=${obfsOpts.mode}`);
            if (obfsOpts.host) parts.push(`obfs-host=${obfsOpts.host}`);
            if (obfsOpts.uri) parts.push(`obfs-uri=${obfsOpts.uri}`);
        }
    } else if (type === 'anytls') {
        // 格式: name = anytls, server, port, password=xxx (Surge 5.17+)
        parts.push(`${name} = anytls`);
        parts.push(server);
        parts.push(String(port));
        parts.push(`password=${surgeQuote(proxy.password || '')}`);
        // AnyTLS v2 支持 reuse 参数（默认启用，可设 false 禁用）
        if (proxy.reuse !== undefined) parts.push(`reuse=${proxy.reuse}`);
        // TLS 通用参数
        appendTlsParams(parts, proxy);
    } else if (type === 'wireguard') {
        // WireGuard 在 Surge 中使用独立 section，需要特殊处理
        // 格式: name = wireguard, section-name = WGSectionName
        // 配套一个 [WireGuard WGSectionName] section
        return buildWireGuardResult(name, proxy);
    } else if (type === 'http' || type === 'https') {
        // 格式: name = http/https, server, port, username, password
        parts.push(`${name} = ${type}`);
        parts.push(server);
        parts.push(String(port));
        // HTTP(S) 的用户名和密码是位置参数
        parts.push(proxy.username || '');
        parts.push(proxy.password || '');
        if (type === 'https') appendTlsParams(parts, proxy);
    } else if (type === 'socks5' || type === 'socks5-tls') {
        // 格式: name = socks5/socks5-tls, server, port, username, password
        parts.push(`${name} = ${type}`);
        parts.push(server);
        parts.push(String(port));
        // SOCKS5 的用户名和密码是位置参数
        if (proxy.username || proxy.password) {
            parts.push(proxy.username || '');
            parts.push(proxy.password || '');
        }
        // SOCKS5 的 UDP 需要手动开启
        if (proxy.udp) parts.push('udp-relay=true');
        if (type === 'socks5-tls') appendTlsParams(parts, proxy);
    } else if (type === 'vless') {
        // 解锁 VLESS 支持，即使原生 Surge 不直接解析，也能通过第三方模块或特定版本使用，且防止节点丢失
        parts.push(`${name} = vless`);
        parts.push(server);
        parts.push(String(port));
        parts.push(`username=${proxy.uuid || ''}`);

        // TLS / Reality 支持
        const isReality = proxy.security === 'reality' || !!proxy['reality-opts'];
        if (proxy.tls || isReality) {
            parts.push('tls=true');
            if (isReality) {
                parts.push('reality=true');
                const realityOpts = proxy['reality-opts'] || {};
                if (realityOpts['public-key']) parts.push(`public-key=${surgeQuote(realityOpts['public-key'])}`);
                if (realityOpts['short-id']) parts.push(`short-id=${surgeQuote(realityOpts['short-id'])}`);
            }
        }

        // 传输层支持 (虽然 Surge 原生支持有限，但保留元数据)
        if (proxy.network === 'ws') {
            parts.push('ws=true');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) parts.push(`ws-path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) parts.push(`ws-headers=Host:${wsOpts.headers.Host}`);
        } else if (proxy.network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            if (grpcOpts?.['grpc-service-name']) parts.push(`grpc-service-name=${surgeQuote(grpcOpts['grpc-service-name'])}`);
        }

        appendTlsParams(parts, proxy);
    } else {
        // 不支持的类型
        return null;
    }

    // 链式代理支持
    if (proxy['dialer-proxy']) {
        parts.push(`underlying-proxy=${proxy['dialer-proxy']}`);
    }

    // Shadow TLS 支持
    if (proxy['shadow-tls-password']) {
        parts.push(`shadow-tls-password=${proxy['shadow-tls-password']}`);
        if (proxy['shadow-tls-sni']) parts.push(`shadow-tls-sni=${proxy['shadow-tls-sni']}`);
        if (proxy['shadow-tls-version']) parts.push(`shadow-tls-version=${proxy['shadow-tls-version']}`);
    }

    // TCP Fast Open
    if (proxy.tfo) {
        // 大多数协议在 Surge 中支持 tfo=true
        // 注意：Snell 已经在上面单独处理过了，这里加一个判断避免重复
        if (type !== 'snell' && !parts.some(p => p.startsWith('tfo='))) {
            parts.push('tfo=true');
        }
    }

    return { proxyLine: parts.join(', ') };
}

/**
 * 构建 WireGuard 协议的 Surge 配置结果
 * WireGuard 在 Surge 中需要独立的 [WireGuard SectionName] section
 * @param {string} name - 节点名称
 * @param {Object} proxy - Clash 格式代理对象
 * @returns {{proxyLine: string, wireguardSection: string}|null}
 */
function buildWireGuardResult(name, proxy) {
    const sectionName = `WG_${name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}`;

    // [Proxy] 行
    const proxyLine = `${name} = wireguard, section-name = ${sectionName}`;

    // [WireGuard SectionName] section
    const wgLines = [`[WireGuard ${sectionName}]`];

    if (proxy['private-key']) {
        wgLines.push(`private-key = ${proxy['private-key']}`);
    }

    // self-ip（本地隧道地址）
    if (proxy.ip) {
        const ips = Array.isArray(proxy.ip) ? proxy.ip : [proxy.ip];
        const ipv4 = ips.find(ip => !ip.includes(':'));
        const ipv6 = ips.find(ip => ip.includes(':'));
        if (ipv4) wgLines.push(`self-ip = ${ipv4}`);
        if (ipv6) wgLines.push(`self-ip-v6 = ${ipv6}`);
    }

    // DNS 服务器
    if (proxy.dns) {
        const dnsServers = Array.isArray(proxy.dns) ? proxy.dns.join(', ') : proxy.dns;
        wgLines.push(`dns-server = ${dnsServers}`);
    } else {
        wgLines.push('dns-server = 8.8.8.8, 1.1.1.1');
    }

    // MTU
    if (proxy.mtu) {
        wgLines.push(`mtu = ${proxy.mtu}`);
    }

    // Peer 配置
    const peerParts = [];
    if (proxy['public-key']) {
        peerParts.push(`public-key = ${proxy['public-key']}`);
    }
    // allowed-ips
    const allowedIps = proxy['allowed-ips']
        ? (Array.isArray(proxy['allowed-ips']) ? proxy['allowed-ips'].join(', ') : proxy['allowed-ips'])
        : '0.0.0.0/0, ::/0';
    peerParts.push(`allowed-ips = "${allowedIps}"`);
    // endpoint
    peerParts.push(`endpoint = ${proxy.server}:${proxy.port}`);
    // preshared-key
    if (proxy['preshared-key']) {
        peerParts.push(`preshared-key = ${proxy['preshared-key']}`);
    }
    // keepalive
    if (proxy['persistent-keepalive']) {
        peerParts.push(`keepalive = ${proxy['persistent-keepalive']}`);
    }
    // client-id (Cloudflare WARP reserved)
    if (proxy.reserved) {
        const reserved = Array.isArray(proxy.reserved) ? proxy.reserved.join('/') : proxy.reserved;
        peerParts.push(`client-id = ${reserved}`);
    }

    if (peerParts.length > 0) {
        wgLines.push(`peer = (${peerParts.join(', ')})`);
    }

    return {
        proxyLine,
        wireguardSection: wgLines.join('\n')
    };
}

/**
 * 添加 TLS 代理通用参数（skip-cert-verify, sni, alpn, server-cert-fingerprint-sha256）
 * @param {string[]} parts - 参数列表
 * @param {Object} proxy - 代理对象
 */
function appendTlsParams(parts, proxy) {
    if (proxy.sni || proxy.servername) {
        parts.push(`sni=${proxy.sni || proxy.servername}`);
    }
    if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) {
        parts.push('skip-cert-verify=true');
    }
    if (proxy['server-cert-fingerprint-sha256']) {
        parts.push(`server-cert-fingerprint-sha256=${proxy['server-cert-fingerprint-sha256']}`);
    }
}

/**
 * 生成完整的内置 Surge 配置
 * @param {string} nodeList - 节点列表（换行分隔的 URL）
 * @param {Object} options - 配置选项
 * @returns {string} Surge INI 配置
 */

export function generateBuiltinSurgeConfig(nodeList, options = {}) {
    const {
        fileName = 'MiSub',
        managedConfigUrl = '',
        interval = 86400,
        skipCertVerify = false,
        enableUdp = false,
        enableTfo = false,
        ruleLevel = 'std'
    } = options;

    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = cleanedNodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    const results = [];
    const proxyNames = [];

    // 转换为 Clash 代理对象
    const proxies = urlsToClashProxies(nodeUrls, options);

    // 应用 UDP 开关
    // (已在 urlsToClashProxies 中全局处理)
    
    for (const clashProxy of proxies) {
        const result = clashProxyToSurgeResult(clashProxy);
        if (result) {
            result.clashProxy = clashProxy; // 存储以保留元数据
            results.push(result);
            proxyNames.push(sanitizeNodeName(clashProxy.name));
        }
    }

    const usedNames = new Map();
    const finalResults = [];
    const finalProxyNames = [];

    for (let i = 0; i < results.length; i++) {
        const baseName = proxyNames[i];
        const uniqueName = getUniqueName(baseName, usedNames);
        if (uniqueName !== baseName) {
            const updatedResult = { ...results[i] };
            updatedResult.proxyLine = results[i].proxyLine.replace(`${baseName} = `, `${uniqueName} = `);
            if (updatedResult.wireguardSection) {
                updatedResult.wireguardSection = results[i].wireguardSection
                    .replace(new RegExp(`WG_${escapeRegExp(baseName.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_'))}`, 'g'),
                        `WG_${uniqueName.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}`);
            }
            finalResults.push(updatedResult);
            finalProxyNames.push(uniqueName);
        } else {
            finalResults.push(results[i]);
            finalProxyNames.push(baseName);
        }
    }

    if (finalResults.length === 0) {
        return `[General]\nloglevel = notify\n\n[Proxy]\nDIRECT = direct\n\n[Proxy Group]\n\n[Rule]\nFINAL,DIRECT\n`;
    }

    const finalProxyLines = finalResults.map(r => r.proxyLine);
    const wireguardSections = finalResults.filter(r => r.wireguardSection).map(r => r.wireguardSection);

    const sections = [];
    const managedLine = managedConfigUrl ? `#!MANAGED-CONFIG ${managedConfigUrl} interval=${interval} strict=false\n\n` : '';

    sections.push(`${managedLine}[General]
loglevel = notify
skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local
dns-server = 119.29.29.29, 223.5.5.5, system`);

    sections.push(`[Proxy]\nDIRECT = direct\n${finalProxyLines.join('\n')}`);

    const levelKey = (ruleLevel || 'std').toUpperCase();
    const policyFactory = POLICY_GROUPS[levelKey] || POLICY_GROUPS.STD;
    
    // 构造带元数据的代理对象用于策略分组
    const proxiesForGrouping = finalProxyNames.map((name, index) => ({
        tag: name,
        name: name,
        metadata: finalResults[index].clashProxy?.metadata || {}
    }));
    
    let abstractGroups = policyFactory(proxiesForGrouping);
    abstractGroups = pruneProxyGroups(abstractGroups, proxiesForGrouping);

    // 转换为 Surge [Proxy Group]
    const proxyGroupLines = abstractGroups.map(group => {
        let type = group.type === 'url-test' ? 'url-test' : 'select';
        if (group.type === 'fallback') type = 'fallback';
        if (group.type === 'relay') type = 'relay';
        
        const proxies = group.proxies.join(', ');
        const extra = type === 'url-test' || type === 'fallback' ? ', url=http://www.gstatic.com/generate_204, interval=300, tolerance=50' : '';
        return `${group.name} = ${type}, ${proxies}${extra}`;
    });

    sections.push(`[Proxy Group]\n${proxyGroupLines.join('\n')}`);

    // Surge [Rule]
    const builtinRuleLines = getBuiltinRules(levelKey, 'surge');
    const ruleLines = [
        '# 基础分流',
        'DOMAIN-SUFFIX,localhost,DIRECT',
        'IP-CIDR,127.0.0.1/8,DIRECT',
        'IP-CIDR,10.0.0.0/8,DIRECT',
        'IP-CIDR,172.16.0.0/12,DIRECT',
        'IP-CIDR,192.168.0.0/16,DIRECT',
        ...builtinRuleLines,
        `FINAL,${levelKey === 'RELAY' ? DEFAULT_RELAY_GROUP : DEFAULT_SELECT_GROUP},dns-failed`
    ];
    sections.push(`[Rule]\n${ruleLines.filter(Boolean).join('\n')}`);

    if (wireguardSections.length > 0) {
        sections.push(wireguardSections.join('\n\n'));
    }

    return sections.join('\n\n') + '\n';
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
