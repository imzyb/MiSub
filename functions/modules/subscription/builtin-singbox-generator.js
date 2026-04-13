/**
 * 内置 Sing-Box 配置生成器
 * 将节点 URL 列表转换为基础可用的 sing-box JSON 配置。
 */

import { urlToClashProxy } from '../../utils/url-to-clash.js';
import { getUniqueName } from './name-utils.js';
import { groupNodeLinesByRegion } from './region-groups.js';
import { POLICY_GROUPS, getBuiltinRules, getRemoteProviderDefinitions, DEFAULT_SELECT_GROUP, DEFAULT_RELAY_GROUP } from './builtin-rules-provider.js';

function cleanControlChars(str) {
    if (typeof str !== 'string') return str;
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeName(name) {
    if (!name) return 'Untitled';
    let safe = cleanControlChars(name);
    safe = safe.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, ' ').trim();
    return safe || 'Untitled';
}

function parsePort(port) {
    const num = Number.parseInt(String(port), 10);
    return Number.isFinite(num) ? num : undefined;
}

function buildOutbound(proxy) {
    if (!proxy || !proxy.server || !proxy.port) return null;

    const type = (proxy.type || '').toLowerCase();
    const tag = sanitizeName(proxy.name);
    const server = proxy.server;
    const port = parsePort(proxy.port);
    if (!port) return null;

    const outbound = { tag, type: 'direct' };

    if (type === 'ss' || type === 'shadowsocks') {
        outbound.type = 'shadowsocks';
        outbound.server = server;
        outbound.server_port = port;
        outbound.method = proxy.cipher || 'aes-128-gcm';
        outbound.password = proxy.password || '';
        if (proxy.udp) outbound.udp_over_tcp = false;
    } else if (type === 'vmess') {
        outbound.type = 'vmess';
        outbound.server = server;
        outbound.server_port = port;
        outbound.uuid = proxy.uuid || '';
        outbound.security = proxy.cipher || 'auto';
        outbound.alter_id = Number.isFinite(Number(proxy.alterId)) ? Number(proxy.alterId) : 0;
        if (proxy.tls || proxy.sni || proxy.servername || proxy['skip-cert-verify']) {
            outbound.tls = {
                enabled: true,
                server_name: proxy.sni || proxy.servername || server
            };
            if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) {
                outbound.tls.insecure = true;
            }
        }
        outbound.transport = {
            type: proxy.network === 'ws' ? 'ws' : 'tcp'
        };
        if (proxy['ws-opts']?.path || proxy.wsOpts?.path) {
            outbound.transport.path = proxy['ws-opts']?.path || proxy.wsOpts?.path;
        }
        const host = proxy['ws-opts']?.headers?.Host || proxy.wsOpts?.headers?.Host;
        if (host) outbound.transport.headers = { Host: host };
    } else if (type === 'vless') {
        outbound.type = 'vless';
        outbound.server = server;
        outbound.server_port = port;
        outbound.uuid = proxy.uuid || '';
        if (proxy.network) {
            outbound.transport = { type: proxy.network };
            if (proxy.network === 'ws') {
                const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
                if (wsOpts?.path) outbound.transport.path = wsOpts.path;
                if (wsOpts?.headers?.Host) outbound.transport.headers = { Host: wsOpts.headers.Host };
            } else if (proxy.network === 'grpc') {
                const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
                if (grpcOpts?.['grpc-service-name']) outbound.transport.service_name = grpcOpts['grpc-service-name'];
            } else if (proxy.network === 'xhttp') {
                const xhttpOpts = proxy['xhttp-opts'] || proxy.xhttpOpts;
                if (xhttpOpts?.path) outbound.transport.path = xhttpOpts.path;
                if (xhttpOpts?.host) outbound.transport.host = xhttpOpts.host;
                if (xhttpOpts?.mode) outbound.transport.mode = xhttpOpts.mode;
            }
        }
        if (proxy.flow) outbound.flow = proxy.flow;
        if (proxy.reality_opts || proxy['reality-opts']) {
            const reality = proxy.reality_opts || proxy['reality-opts'];
            outbound.tls = {
                enabled: true,
                server_name: proxy.sni || proxy.servername || server,
                utls: { enabled: true, fingerprint: proxy['client-fingerprint'] || 'chrome' },
                reality: {
                    enabled: true,
                    public_key: reality['public-key'] || reality.public_key,
                    short_id: reality['short-id'] || reality.short_id
                }
            };
        }
    } else if (type === 'trojan') {
        outbound.type = 'trojan';
        outbound.server = server;
        outbound.server_port = port;
        outbound.password = proxy.password || '';
        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server
        };
    } else if (type === 'hysteria2' || type === 'hy2') {
        outbound.type = 'hysteria2';
        outbound.server = server;
        outbound.server_port = port;
        outbound.password = proxy.password || '';
        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server
        };
    } else if (type === 'tuic') {
        outbound.type = 'tuic';
        outbound.server = server;
        outbound.server_port = port;
        outbound.uuid = proxy.uuid || '';
        outbound.password = proxy.password || '';
        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server
        };
    } else if (type === 'snell') {
        outbound.type = 'snell';
        outbound.server = server;
        outbound.server_port = port;
        outbound.psk = proxy.psk || proxy.password || '';
        if (proxy.version) outbound.version = Number(proxy.version);
    } else if (type === 'wireguard') {
        outbound.type = 'wireguard';
        outbound.server = server;
        outbound.server_port = port;
        outbound.private_key = proxy['private-key'] || '';
        outbound.local_address = Array.isArray(proxy.ip) ? proxy.ip : (proxy.ip ? [proxy.ip] : []);
        outbound.peer_public_key = proxy['public-key'] || '';
        outbound.pre_shared_key = proxy['preshared-key'] || '';
        outbound.reserved = proxy.reserved;
    } else if (type === 'http' || type === 'https') {
        outbound.type = 'http';
        outbound.server = server;
        outbound.server_port = port;
        if (proxy.username) outbound.username = proxy.username;
        if (proxy.password) outbound.password = proxy.password;
        if (type === 'https') {
            outbound.tls = {
                enabled: true,
                server_name: proxy.sni || proxy.servername || server
            };
        }
    } else if (type === 'socks5' || type === 'socks5-tls') {
        outbound.type = 'socks';
        outbound.server = server;
        outbound.server_port = port;
        if (proxy.username) outbound.username = proxy.username;
        if (proxy.password) outbound.password = proxy.password;
        if (type === 'socks5-tls') {
            outbound.tls = {
                enabled: true,
                server_name: proxy.sni || proxy.servername || server
            };
        }
    } else {
        return null;
    }

    if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) {
        outbound.tls = outbound.tls || {};
        outbound.tls.enabled = true;
        outbound.tls.insecure = true;
    }
    if (proxy.sni || proxy.servername) {
        outbound.tls = outbound.tls || {};
        outbound.tls.server_name = proxy.sni || proxy.servername;
    }
    if (proxy['client-fingerprint']) {
        outbound.tls = outbound.tls || {};
        outbound.tls.utls = { enabled: true, fingerprint: proxy['client-fingerprint'] };
    }

    return outbound;
}


export function generateBuiltinSingboxConfig(nodeList, options = {}) {
    const {
        managedConfigUrl = '',
        skipCertVerify = false,
        enableUdp = false,
        ruleLevel = 'std'
    } = options;

    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = cleanedNodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    const outbounds = [];
    const usedNames = new Map();
    const nodeEntries = [];

    for (const url of nodeUrls) {
        const clashProxy = urlToClashProxy(url);
        if (!clashProxy) continue;

        if (skipCertVerify) clashProxy['skip-cert-verify'] = true;
        if (enableUdp) clashProxy.udp = true;

        const baseName = sanitizeName(clashProxy.name);
        clashProxy.name = getUniqueName(baseName, usedNames);

        const outbound = buildOutbound(clashProxy);
        if (outbound) {
            outbounds.push(outbound);
            nodeEntries.push({ tag: outbound.tag, outbound });
        }
    }

    const proxyOutboundTags = outbounds.map(item => item.tag);
    if (outbounds.length === 0) {
        outbounds.push({ tag: 'DIRECT', type: 'direct' });
    }

    const levelKey = (ruleLevel || 'std').toUpperCase();
    // 获取内置策略组
    const policyGroupsFactory = POLICY_GROUPS[levelKey] || POLICY_GROUPS.STD;
    const proxyGroups = policyGroupsFactory(outbounds);

    // 将抽象分组转换为 Sing-Box Outbounds
    const groupOutbounds = proxyGroups.map(group => {
        const type = group.type === 'url-test' ? 'urltest' : 'selector';
        return {
            tag: group.name,
            type: type,
            outbounds: group.proxies,
            ...(type === 'urltest' ? { url: 'http://www.gstatic.com/generate_204', interval: '5m' } : {})
        };
    });

    // 从统一规则库获取分流规则
    const rawRules = getBuiltinRules(levelKey, 'singbox');
    
    // 提取远程 Rule Set 定义 (Sing-Box 格式)
    const ruleSetsMap = getRemoteProviderDefinitions('singbox', rawRules);
    const ruleSets = Object.values(ruleSetsMap);

    // 转换路由规则：将中间对象映射为 Sing-Box 语法
    const routeRules = [
        { ip_cidr: ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'], outbound: 'DIRECT' },
        { domain_suffix: ['localhost'], outbound: 'DIRECT' },
        ...rawRules.map(r => {
            if (r.type === 'rule_set') return { rule_set: [r.tag], outbound: r.outbound };
            return r; // 已经是 Sing-Box 格式的普通规则
        }),
        { domain_suffix: ['cn'], outbound: 'DIRECT' }
    ];

    const config = {
        log: { level: 'info' },
        dns: {
            strategy: 'prefer_ipv4',
            servers: [
                { tag: 'dns-ali', address: '223.5.5.5', detour: 'DIRECT' },
                { tag: 'dns-google', address: '8.8.8.8', detour: DEFAULT_SELECT_GROUP },
                { tag: 'doh-cloudflare', address: 'https://1.1.1.1/dns-query', detour: DEFAULT_SELECT_GROUP }
            ]
        },
        outbounds: [
            { tag: 'DIRECT', type: 'direct' },
            { tag: 'REJECT', type: 'block' },
            ...outbounds,
            ...groupOutbounds
        ],
        route: {
            auto_detect_interface: true,
            final: levelKey === 'RELAY' ? DEFAULT_RELAY_GROUP : DEFAULT_SELECT_GROUP,
            rule_set: ruleSets,
            rules: routeRules
        }
    };

    return JSON.stringify(config, null, 2) + '\n';
}
