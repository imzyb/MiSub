/**
 * 内置 Loon 配置生成器 (加强版)
 * 不依赖外部 subconverter，直接将节点 URL 转换为高质量 Loon 配置
 * 
 * 增强功能：
 * 1. 区域分流 (🇭🇰 香港, 🇯🇵 日本, 🇺🇸 美国等)
 * 2. 自动测速分组
 * 3. 节点与分组图标 (Icon) 支持
 * 4. #!MANAGED-CONFIG 支持
 * 5. 完善的 [General] 与 [Rule] 规则
 */

import { urlToClashProxy } from '../../utils/url-to-clash.js';
import { getUniqueName } from './name-utils.js';
import { POLICY_GROUPS, getBuiltinRules, DEFAULT_SELECT_GROUP, DEFAULT_RELAY_GROUP } from './builtin-rules-provider.js';

/**
 * 清理控制字符
 */
function cleanControlChars(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * 安全化节点名称
 */
function sanitizeNodeName(name) {
    if (!name) return 'Untitled';
    let safe = cleanControlChars(name);
    // 移除或替换可能破坏 INI 解析的字符
    safe = safe.replace(/,/g, ' ').replace(/=/g, '-');
    safe = safe.replace(/\s+/g, ' ').trim();
    return safe || 'Untitled';
}

/**
 * 参数值加引号（如果包含特殊字符）
 */
function loonQuote(value) {
    if (!value) return '';
    if (/[,\s"=]/.test(value)) {
        return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
}

/**
 * 根据节点名称获取对应的图标 URL
 */
function getIconByNodeName(name) {
    const iconRepo = 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color';
    if (/港|HK|Hong Kong/i.test(name)) return `${iconRepo}/Hong_Kong.png`;
    if (/台|TW|Taiwan/i.test(name)) return `${iconRepo}/Taiwan.png`;
    if (/日|JP|Japan/i.test(name)) return `${iconRepo}/Japan.png`;
    if (/新|SG|Singapore|狮城/i.test(name)) return `${iconRepo}/Singapore.png`;
    if (/美|US|America/i.test(name)) return `${iconRepo}/United_States.png`;
    if (/韩|KR|Korea/i.test(name)) return `${iconRepo}/South_Korea.png`;
    if (/英|UK|Great Britain/i.test(name)) return `${iconRepo}/United_Kingdom.png`;
    if (/德|DE|Germany/i.test(name)) return `${iconRepo}/Germany.png`;
    if (/法|FR|France/i.test(name)) return `${iconRepo}/France.png`;
    if (/俄|RU|Russia/i.test(name)) return `${iconRepo}/Russia.png`;
    return null;
}

/**
 * 将 Clash 代理对象转换为 Loon [Proxy] 行
 */
function clashProxyToLoonResult(proxy) {
    if (!proxy || !proxy.server || !proxy.port) return null;

    const name = sanitizeNodeName(proxy.name);
    const type = (proxy.type || '').toLowerCase();
    const server = proxy.server;
    const port = proxy.port;

    const parts = [];

    if (type === 'ss' || type === 'shadowsocks') {
        parts.push(`${name} = Shadowsocks`);
        parts.push(server);
        parts.push(String(port));
        parts.push(proxy.cipher || 'aes-128-gcm');
        parts.push(loonQuote(proxy.password || ''));
        
        if (proxy.udp) parts.push('udp-relay=true');
        if (proxy.obfs) {
            parts.push(`obfs=${proxy.obfs}`);
            if (proxy['obfs-host']) parts.push(`obfs-host=${proxy['obfs-host']}`);
        }
    } else if (type === 'vmess') {
        parts.push(`${name} = vmess`);
        parts.push(server);
        parts.push(String(port));
        parts.push(proxy.uuid || '');
        
        if (proxy.tls) parts.push('tls=true');
        if (proxy.network === 'ws') {
            parts.push('transport=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) parts.push(`path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) parts.push(`host=${wsOpts.headers.Host}`);
        }
        appendTlsParams(parts, proxy);
    } else if (type === 'vless') {
        parts.push(`${name} = vless`);
        parts.push(server);
        parts.push(String(port));
        parts.push(proxy.uuid || '');

        if (proxy.flow) {
            parts.push(`flow=${proxy.flow}`);
        }

        if (proxy.network) {
            parts.push(`transport=${proxy.network}`);
            
            if (proxy.network === 'ws') {
                const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
                if (wsOpts?.path) parts.push(`path=${wsOpts.path}`);
                if (wsOpts?.headers?.Host) parts.push(`host=${wsOpts.headers.Host}`);
            } else if (proxy.network === 'grpc') {
                const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
                if (grpcOpts?.['grpc-service-name']) parts.push(`grpc-service-name=${grpcOpts['grpc-service-name']}`);
            } else if (proxy.network === 'xhttp') {
                const xhttpOpts = proxy['xhttp-opts'] || proxy.xhttpOpts;
                if (xhttpOpts?.path) parts.push(`path=${xhttpOpts.path}`);
                if (xhttpOpts?.host) parts.push(`host=${xhttpOpts.host}`);
                if (xhttpOpts?.mode) parts.push(`mode=${xhttpOpts.mode}`);
            }
        }

        if (proxy.tls || proxy.security === 'reality') {
            parts.push('tls=true');
            const realityOpts = proxy['reality-opts'] || proxy.realityOpts;
            if (realityOpts) {
                parts.push('reality=true');
                if (realityOpts['public-key']) parts.push(`public-key=${realityOpts['public-key']}`);
                if (realityOpts['short-id']) parts.push(`short-id=${realityOpts['short-id']}`);
            }
        }
        appendTlsParams(parts, proxy);
    } else if (type === 'trojan') {
        parts.push(`${name} = trojan`);
        parts.push(server);
        parts.push(String(port));
        parts.push(loonQuote(proxy.password || ''));
        
        if (proxy.network === 'ws') {
            parts.push('transport=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) parts.push(`path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) parts.push(`host=${wsOpts.headers.Host}`);
        }
        appendTlsParams(parts, proxy);
    } else if (type === 'hysteria2' || type === 'hy2') {
        parts.push(`${name} = hysteria2`);
        parts.push(server);
        parts.push(String(port));
        parts.push(loonQuote(proxy.password || ''));
        appendTlsParams(parts, proxy);
    } else if (type === 'tuic') {
        parts.push(`${name} = tuic`);
        parts.push(server);
        parts.push(String(port));
        parts.push(proxy.token || proxy.uuid || '');
        if (proxy.password) parts.push(`password=${proxy.password}`);
        appendTlsParams(parts, proxy);
    } else if (type === 'wireguard') {
        parts.push(`${name} = wireguard`);
        parts.push(server);
        parts.push(String(port));
        parts.push(proxy['private-key']);
        if (proxy.ip) {
            const ip = Array.isArray(proxy.ip) ? proxy.ip[0] : proxy.ip;
            parts.push(`self-ip=${ip}`);
        }
        if (proxy['public-key']) parts.push(`public-key=${proxy['public-key']}`);
        if (proxy.mtu) parts.push(`mtu=${proxy.mtu}`);
        if (proxy.reserved) {
            const reserved = Array.isArray(proxy.reserved) ? proxy.reserved.join('/') : proxy.reserved;
            parts.push(`client-id=${reserved}`);
        }
    } else if (type === 'snell') {
        parts.push(`${name} = snell`);
        parts.push(server);
        parts.push(String(port));
        parts.push(proxy.psk || proxy.password || '');
        if (proxy.version) parts.push(`version=${proxy.version}`);
        // 连接复用（Snell V3+ 支持）
        if (proxy.reuse !== undefined) parts.push(`reuse=${proxy.reuse}`);
        // TCP Fast Open
        if (proxy.tfo !== undefined) parts.push(`tfo=${proxy.tfo}`);
        // 混淆参数
        const obfsOpts = proxy['obfs-opts'];
        if (obfsOpts) {
            if (obfsOpts.mode && obfsOpts.mode !== 'none') parts.push(`obfs=${obfsOpts.mode}`);
            if (obfsOpts.host) parts.push(`obfs-host=${obfsOpts.host}`);
        }
    } else {
        return null;
    }

    // 添加节点图标
    const iconUrl = getIconByNodeName(proxy.name);
    if (iconUrl) {
        parts.push(`icon=${iconUrl}`);
    }

    return parts.join(', ');
}

function appendTlsParams(parts, proxy) {
    if (proxy.sni || proxy.servername) {
        parts.push(`sni=${proxy.sni || proxy.servername}`);
    }
    if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) {
        parts.push('skip-cert-verify=true');
    }
    if (proxy.alpn) {
        const alpnStr = Array.isArray(proxy.alpn) ? proxy.alpn[0] : proxy.alpn;
        parts.push(`alpn=${alpnStr}`);
    }
    if (proxy['client-fingerprint']) {
        parts.push(`client-fingerprint=${proxy['client-fingerprint']}`);
    }
}


/**
 * 生成内置 Loon 配置
 */

export function generateBuiltinLoonConfig(nodeList, options = {}) {
    const {
        managedConfigUrl = '',
        interval = 86400,
        skipCertVerify = false,
        enableUdp = false,
        ruleLevel = 'std'
    } = options;

    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = cleanedNodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    const proxyLines = [];
    const proxyNames = [];
    const proxiesWithMetadata = [];
    const usedNames = new Map();

    for (const url of nodeUrls) {
        const clashProxy = urlToClashProxy(url);
        if (!clashProxy) continue;

        if (skipCertVerify) clashProxy['skip-cert-verify'] = true;
        if (enableUdp) clashProxy.udp = true;

        const baseName = sanitizeNodeName(clashProxy.name);
        const uniqueName = getUniqueName(baseName, usedNames);
        clashProxy.name = uniqueName;

        const line = clashProxyToLoonResult(clashProxy);
        if (line) {
            proxyLines.push(line);
            proxyNames.push(uniqueName);
            proxiesWithMetadata.push(clashProxy);
        }
    }

    if (proxyLines.length === 0) {
        return `[Proxy]\nDIRECT = direct\n`;
    }

    const sections = [];
    if (managedConfigUrl) {
        sections.push(`#!MANAGED-CONFIG ${managedConfigUrl} interval=${interval} strict=false`);
    }

    sections.push(`[General]
ipv6 = false
dns-server = system, 223.5.5.5, 119.29.29.29
skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local
proxy-test-url = http://www.gstatic.com/generate_204
resource-parser = https://raw.githubusercontent.com/sub-store-org/Sub-Store/master/scripts/sub-store-parser.js`);

    sections.push(`[Proxy]\nDIRECT = direct\n${proxyLines.join('\n')}`);

    const levelKey = (ruleLevel || 'std').toUpperCase();
    const policyFactory = POLICY_GROUPS[levelKey] || POLICY_GROUPS.STD;
    const abstractGroups = policyFactory(proxiesWithMetadata);

    const iconRepo = 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color';
    const groupIcons = {
        [DEFAULT_SELECT_GROUP]: `${iconRepo}/Proxy.png`,
        [DEFAULT_RELAY_GROUP]: `${iconRepo}/Proxy.png`,
        '♻️ 自动选择': `${iconRepo}/Speedtest.png`,
        '🔯 故障转移': `${iconRepo}/Relay.png`,
        '🎬 视频广告': `${iconRepo}/Reject.png`,
        '🎥 流媒体': `${iconRepo}/Video.png`,
        '🍎 Apple': `${iconRepo}/Apple.png`,
        'Ⓜ️ Microsoft': `${iconRepo}/Microsoft.png`,
        '📲 Telegram': `${iconRepo}/Telegram.png`,
        '🎧 Spotify': `${iconRepo}/Spotify.png`,
        '🇭🇰 香港节点': `${iconRepo}/Hong_Kong.png`,
        '🇹🇼 台湾节点': `${iconRepo}/Taiwan.png`,
        '🇯🇵 日本节点': `${iconRepo}/Japan.png`,
        '🇸🇬 狮城节点': `${iconRepo}/Singapore.png`,
        '🇺🇸 美国节点': `${iconRepo}/United_States.png`,
        '🇰🇷 韩国节点': `${iconRepo}/South_Korea.png`,
        '🇬🇧 英国节点': `${iconRepo}/United_Kingdom.png`,
    };

    const proxyGroupLines = abstractGroups.map(group => {
        let type = group.type === 'url-test' ? 'url-test' : 'select';
        if (group.type === 'fallback') type = 'fallback';
        if (group.type === 'relay') type = 'relay';

        const proxies = group.proxies.join(', ');
        const icon = groupIcons[group.name] ? `, icon=${groupIcons[group.name]}` : '';
        const extra = type === 'url-test' || type === 'fallback' ? `, url=http://www.gstatic.com/generate_204, interval=300, tolerance=50` : '';
        return `${group.name} = ${type}, ${proxies}${extra}${icon}`;
    });

    sections.push(`[Proxy Group]\n${proxyGroupLines.join('\n')}`);

    const builtinRuleLines = getBuiltinRules(levelKey, 'loon');
    const ruleLines = [
        '# 基础分流',
        'IP-CIDR,127.0.0.0/8,DIRECT',
        'IP-CIDR,10.0.0.0/8,DIRECT',
        'IP-CIDR,172.16.0.0/12,DIRECT',
        'IP-CIDR,192.168.0.0/16,DIRECT',
        ...builtinRuleLines,
        `FINAL,${levelKey === 'RELAY' ? DEFAULT_RELAY_GROUP : DEFAULT_SELECT_GROUP}`
    ];
    sections.push(`[Rule]\n${ruleLines.filter(Boolean).join('\n')}`);

    return sections.join('\n\n') + '\n';
}
