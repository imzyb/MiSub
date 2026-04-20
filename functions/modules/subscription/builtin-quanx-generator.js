/**
 * 内置 Quantumult X 配置生成器
 * 输出格式对齐项目中的 Quantumult X parser，确保可解析回节点 URL。
 */

import { urlToClashProxy, urlsToClashProxies } from '../../utils/url-to-clash.js';
import { getUniqueName } from './name-utils.js';
import { POLICY_GROUPS, getBuiltinRules, getRemoteProviderDefinitions, DEFAULT_SELECT_GROUP, DEFAULT_RELAY_GROUP, pruneProxyGroups } from './builtin-rules-provider.js';

const ICON_REPO = 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color';

function cleanControlChars(str) {
    if (typeof str !== 'string') return str;
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeNodeName(name) {
    if (!name) return 'Untitled';
    let safe = cleanControlChars(name);
    // QuanX lines are comma-separated and uses = for key-value. 
    // Semicolons and quotes can also be problematic in some versions.
    safe = safe.replace(/,/g, ' ').replace(/=/g, '-').replace(/;/g, ' ').replace(/["']/g, '');
    safe = safe.replace(/\s+/g, ' ').trim();
    return safe || 'Untitled';
}

function qxQuote(value) {
    if (value === undefined || value === null) return '';
    return encodeURIComponent(String(value));
}

function getIconByNodeName(name) {
    if (/港|HK|Hong Kong/i.test(name)) return `${ICON_REPO}/Hong_Kong.png`;
    if (/台|TW|Taiwan/i.test(name)) return `${ICON_REPO}/Taiwan.png`;
    if (/日|JP|Japan/i.test(name)) return `${ICON_REPO}/Japan.png`;
    if (/新|SG|Singapore|狮城/i.test(name)) return `${ICON_REPO}/Singapore.png`;
    if (/美|US|America/i.test(name)) return `${ICON_REPO}/United_States.png`;
    if (/韩|KR|Korea/i.test(name)) return `${ICON_REPO}/South_Korea.png`;
    if (/英|UK|Great Britain/i.test(name)) return `${ICON_REPO}/United_Kingdom.png`;
    if (/德|DE|Germany/i.test(name)) return `${ICON_REPO}/Germany.png`;
    if (/法|FR|France/i.test(name)) return `${ICON_REPO}/France.png`;
    if (/俄|RU|Russia/i.test(name)) return `${ICON_REPO}/Russia.png`;
    return null;
}

function appendQxTlsParams(extraParts, proxy) {
    if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) {
        extraParts.push('tls-verification=false');
    }
}

function buildQxLine(proxy) {
    if (!proxy || !proxy.server || !proxy.port) return null;

    const name = sanitizeNodeName(proxy.name);
    const type = (proxy.type || '').toLowerCase();
    const server = proxy.server;
    const port = proxy.port;

    if (type === 'ss' || type === 'shadowsocks') {
        const method = proxy.cipher || 'aes-128-gcm';
        const password = proxy.password || '';
        const extraParts = [];

        // 插件支持
        const plugin = proxy.plugin || '';
        const opts = proxy['plugin-opts'] || proxy.pluginOpts || {};

        if (plugin === 'obfs-local' || proxy.obfs) {
            extraParts.push(`obfs=${proxy.obfs || opts.mode}`);
            if (proxy['obfs-host'] || opts.host) extraParts.push(`obfs-host=${proxy['obfs-host'] || opts.host}`);
        } else if (plugin === 'v2ray-plugin' || opts.mode === 'websocket') {
            extraParts.push('obfs=ws');
            if (opts.path) extraParts.push(`obfs-uri=${opts.path}`);
            if (opts.host) extraParts.push(`obfs-host=${opts.host}`);
            if (opts.tls || opts.mode === 'websocket-tls') extraParts.push('over-tls=true');
        }

        if (proxy.udp) extraParts.push('udp-relay=true');
        if (proxy.tfo) extraParts.push('fast-open=true');
        return `shadowsocks=${server}:${port}, method=${method}, password=${password}${extraParts.length > 0 ? `, ${extraParts.join(', ')}` : ''}, tag=${name}`;
    }

    if (type === 'vmess') {
        const uuid = proxy.uuid || '';
        const method = proxy.cipher || 'auto';
        const aid = Number.isFinite(Number(proxy.alterId)) ? Number(proxy.alterId) : 0;
        const extraParts = [];
        if (proxy.network === 'ws' || proxy['ws-opts']) {
            extraParts.push('obfs=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extraParts.push(`obfs-uri=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extraParts.push(`obfs-host=${wsOpts.headers.Host}`);
        }
        if (proxy.tls || proxy.sni || proxy.servername) extraParts.push('over-tls=true');
        if (proxy.sni || proxy.servername) extraParts.push(`tls-host=${proxy.sni || proxy.servername}`);
        if (proxy.tfo) extraParts.push('fast-open=true');
        appendQxTlsParams(extraParts, proxy);
        return `vmess=${server}:${port}, method=${method}, password=${uuid}, tag=${name}${extraParts.length > 0 ? `, ${extraParts.join(', ')}` : ''}`;
    }

    if (type === 'trojan') {
        const password = proxy.password || '';
        const extraParts = [];
        if (proxy.network === 'ws' || proxy['ws-opts']) {
            extraParts.push('obfs=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extraParts.push(`obfs-uri=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extraParts.push(`obfs-host=${wsOpts.headers.Host}`);
        } else {
            extraParts.push('over-tls=true');
        }
        if (proxy.sni || proxy.servername) extraParts.push(`tls-host=${proxy.sni || proxy.servername}`);
        if (proxy.obfs) extraParts.push(`obfs=${proxy.obfs}, obfs-host=${proxy['obfs-host'] || ''}`);
        if (proxy.tfo) extraParts.push('fast-open=true');
        appendQxTlsParams(extraParts, proxy);
        return `trojan=${server}:${port}, password=${password}${extraParts.length > 0 ? `, ${extraParts.join(', ')}` : ''}, tag=${name}`;
    }

    if (type === 'vless') {
        const uuid = proxy.uuid || '';
        const extraParts = ['method=none'];
        const transport = proxy.network || 'tcp';

        // 传输层映射 (QX 兼容性适配)
        if (transport === 'ws' || proxy['ws-opts']) {
            extraParts.push('obfs=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extraParts.push(`obfs-uri=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extraParts.push(`obfs-host=${wsOpts.headers.Host}`);
        } else if (transport === 'grpc' || proxy['grpc-opts']) {
            extraParts.push('obfs=grpc');
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            if (grpcOpts?.['grpc-service-name']) extraParts.push(`obfs-uri=${grpcOpts['grpc-service-name']}`);
        } else if (transport === 'xhttp' || proxy['xhttp-opts']) {
            // QX 不直接支持 xhttp，尝试映射为 http(s) 以提高兼容性
            extraParts.push('obfs=http');
            const xhttpOpts = proxy['xhttp-opts'] || proxy.xhttpOpts;
            if (xhttpOpts?.path) extraParts.push(`obfs-uri=${xhttpOpts.path}`);
            if (xhttpOpts?.host) extraParts.push(`obfs-host=${xhttpOpts.host}`);
        }

        // 安全层映射 (TLS / Reality)
        const isReality = proxy.security === 'reality' || !!proxy['reality-opts'];
        if (proxy.tls || isReality) {
            extraParts.push('over-tls=true');
            if (proxy.sni || proxy.servername) extraParts.push(`tls-host=${proxy.sni || proxy.servername}`);
            
            if (isReality) {
                const realityOpts = proxy['reality-opts'] || {};
                if (realityOpts['public-key']) extraParts.push(`reality-public-key=${realityOpts['public-key']}`);
                if (realityOpts['short-id']) extraParts.push(`reality-short-id=${realityOpts['short-id']}`);
            }
        }
        
        appendQxTlsParams(extraParts, proxy);
        return `vless=${server}:${port}, password=${uuid}${extraParts.length > 0 ? `, ${extraParts.join(', ')}` : ''}, tag=${name}`;
    }

    if (type === 'http' || type === 'https') {
        const username = proxy.username || '';
        const password = proxy.password || '';
        const extraParts = [];
        if (type === 'https') extraParts.push('over-tls=true');
        if (proxy.sni || proxy.servername) extraParts.push(`tls-host=${proxy.sni || proxy.servername}`);
        appendQxTlsParams(extraParts, proxy);
        return `http=${server}:${port}, username=${username}, password=${password}${extraParts.length > 0 ? `, ${extraParts.join(', ')}` : ''}, tag=${name}`;
    }

    if (type === 'hysteria2' || type === 'hy2') {
        const extraParts = [];
        if (proxy.sni || proxy.servername) extraParts.push(`sni=${proxy.sni || proxy.servername}`);
        appendQxTlsParams(extraParts, proxy);
        return `hysteria2=${server}:${port}, password=${proxy.password || ''}${extraParts.length > 0 ? `, ${extraParts.join(', ')}` : ''}, tag=${name}`;
    }

    if (type === 'tuic') {
        const parts = [];
        if (proxy.uuid) parts.push(proxy.uuid || '');
        if (proxy.password) parts.push(proxy.password || '');
        if (proxy.sni || proxy.servername) parts.push(`sni=${proxy.sni || proxy.servername}`);
        if (proxy['congestion-control']) parts.push(`congestion-controller=${proxy['congestion-control']}`);
        if (proxy['udp-relay-mode']) parts.push(`udp-relay=${proxy['udp-relay-mode']}`);
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            parts.push(`alpn=${alpn}`);
        }
        appendQxTlsParams(parts, proxy);
        return `tuic=${server}:${port}, ${parts.join(', ')}, tag=${name}`;
    }

    if (type === 'anytls') {
        const extraParts = [`password=${proxy.password || ''}`];
        if (proxy.sni || proxy.servername) extraParts.push(`sni=${proxy.sni || proxy.servername}`);
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            extraParts.push(`alpn=${alpn}`);
        }
        appendQxTlsParams(extraParts, proxy);
        return `anytls=${server}:${port}, ${extraParts.join(', ')}${proxy.tfo ? ', fast-open=true' : ''}, tag=${name}`;
    }

    return null;
}

export function generateBuiltinQuanxConfig(nodeList, options = {}) {
    const {
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

    const proxyLines = [];
    const proxiesWithMetadata = [];
    const usedNames = new Map();

    // 转换为 Clash 代理对象
    const proxies = urlsToClashProxies(nodeUrls, options);

    // 应用 UDP 开关
    // (已在 urlsToClashProxies 中全局处理)
    
    for (const clashProxy of proxies) {
        const baseName = sanitizeNodeName(clashProxy.name);
        clashProxy.name = getUniqueName(baseName, usedNames);

        const line = buildQxLine(clashProxy);
        if (!line) continue;

        proxyLines.push(line);
        proxiesWithMetadata.push(clashProxy);
    }

    if (proxyLines.length === 0) {
        return '#!MANAGED-CONFIG http://example.com interval=86400 strict=false\n[server_local]\nDIRECT = direct\n';
    }

    const sections = [];
    if (managedConfigUrl) {
        sections.push(`#!MANAGED-CONFIG ${managedConfigUrl} interval=${interval} strict=false`);
    }

    sections.push(`[General]\niv6 = false\ndns-server = system, 223.5.5.5, 119.29.29.29\nskip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local\nproxy-test-url = http://www.gstatic.com/generate_204`);
    sections.push(`[server_local]\nDIRECT = direct\n${proxyLines.join('\n')}`);

    const levelKey = (ruleLevel || 'std').toUpperCase();
    const policyFactory = POLICY_GROUPS[levelKey] || POLICY_GROUPS.STD;
    let abstractGroups = policyFactory(proxiesWithMetadata);
    abstractGroups = pruneProxyGroups(abstractGroups, proxiesWithMetadata);

    const groupIcons = {
        [DEFAULT_SELECT_GROUP]: `${ICON_REPO}/Proxy.png`,
        [DEFAULT_RELAY_GROUP]: `${ICON_REPO}/Proxy.png`,
        '自动选择': `${ICON_REPO}/Speedtest.png`,
        '🔯 故障转移': `${ICON_REPO}/Relay.png`,
        '🎬 视频广告': `${ICON_REPO}/Reject.png`,
        '🎥 流媒体': `${ICON_REPO}/Video.png`,
        '🍎 Apple': `${ICON_REPO}/Apple.png`,
        'Ⓜ️ Microsoft': `${ICON_REPO}/Microsoft.png`,
        '📲 Telegram': `${ICON_REPO}/Telegram.png`,
        '🎧 Spotify': `${ICON_REPO}/Spotify.png`,
        '🇭🇰 香港节点': `${ICON_REPO}/Hong_Kong.png`,
        '🇹🇼 台湾节点': `${ICON_REPO}/Taiwan.png`,
        '🇯🇵 日本节点': `${ICON_REPO}/Japan.png`,
        '🇸🇬 狮城节点': `${ICON_REPO}/Singapore.png`,
        '🇺🇸 美国节点': `${ICON_REPO}/United_States.png`,
        '🇰🇷 韩国节点': `${ICON_REPO}/South_Korea.png`,
        '🇬🇧 英国节点': `${ICON_REPO}/United_Kingdom.png`,
    };

    const groupLines = abstractGroups.map(group => {
        let type = group.type === 'url-test' ? 'url-test' : 'select';
        if (group.type === 'fallback') type = 'fallback';
        if (group.type === 'relay') type = 'static';

        const proxies = group.proxies.join(', ');
        const icon = groupIcons[group.name] ? `, img-url=${groupIcons[group.name]}` : '';
        const extra = type === 'url-test' || type === 'fallback' ? `, url=http://www.gstatic.com/generate_204, interval=300, tolerance=50` : '';
        return `${group.name} = ${type}, ${proxies}${extra}${icon}`;
    });

    sections.push(`[policy]\n${groupLines.join('\n')}`);

    const rawRules = getBuiltinRules(levelKey, 'quanx');
    const remoteRules = rawRules.filter(r => r.startsWith('filter_remote'));
    const localRules = rawRules.filter(r => !r.startsWith('filter_remote'));

    const localRuleLines = [
        '; 基础分流',
        'HOST-SUFFIX, localhost, DIRECT',
        'IP-CIDR, 127.0.0.0/8, DIRECT',
        'IP-CIDR, 10.0.0.0/8, DIRECT',
        'IP-CIDR, 172.16.0.0/12, DIRECT',
        'IP-CIDR, 192.168.0.0/16, DIRECT',
        ...localRules
    ];

    sections.push(`[filter_remote]\n${remoteRules.join('\n')}`);
    sections.push(`[filter_local]\n${localRuleLines.filter(Boolean).join('\n')}`);

    return sections.join('\n\n') + '\n';
}
