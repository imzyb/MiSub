/**
 * 内置 Sing-Box 配置生成器
 * 将节点 URL 列表转换为基础可用的 sing-box JSON 配置。
 */

import { urlToClashProxy, urlsToClashProxies } from '../../utils/url-to-clash.js';
import { getUniqueName } from './name-utils.js';
import { groupNodeLinesByRegion } from './region-groups.js';
import {
    POLICY_GROUPS,
    getBuiltinRules,
    getRemoteProviderDefinitions,
    getSingboxDnsRuleSet,
    DEFAULT_SELECT_GROUP,
    DEFAULT_RELAY_GROUP,
    RELAY_CHAIN_GROUP,
    pruneProxyGroups,
    promoteDnsExitGroup,
} from './builtin-rules-provider.js';
import { buildSingboxDnsConfig, DNS_PROXY_GROUP, SINGBOX_CN_RULE_SET } from './safe-dns.js';

function cleanControlChars(str) {
    if (typeof str !== 'string') return str;
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeName(name) {
    if (!name) return 'Untitled';
    let safe = cleanControlChars(name);
    safe = safe
        .replace(/\s+/g, ' ')
        .replace(/[\r\n\t]/g, ' ')
        .trim();
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

        // sing-box 的 Shadowsocks 出站使用 SIP003 plugin/plugin_opts；
        // `transport` 仅属于 V2Ray 传输协议，SFA 会严格拒绝它。
        const plugin = proxy.plugin || '';
        const opts = proxy['plugin-opts'] || proxy.pluginOpts || {};
        if (plugin === 'v2ray-plugin' || opts.mode === 'websocket') {
            outbound.plugin = 'v2ray-plugin';
            const pluginOptions = ['mode=websocket'];
            if (opts.host) pluginOptions.push(`host=${opts.host}`);
            if (opts.path) pluginOptions.push(`path=${opts.path}`);
            if (opts.tls || opts.mode === 'websocket-tls') pluginOptions.push('tls');
            outbound.plugin_opts = pluginOptions.join(';');
        }
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
                server_name: proxy.sni || proxy.servername || server,
            };
            if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) {
                outbound.tls.insecure = true;
            }
        }
        outbound.transport = {
            type: proxy.network === 'ws' ? 'ws' : 'tcp',
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
                if (wsOpts?.headers?.Host)
                    outbound.transport.headers = { Host: wsOpts.headers.Host };
            } else if (proxy.network === 'grpc') {
                const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
                if (grpcOpts?.['grpc-service-name'])
                    outbound.transport.service_name = grpcOpts['grpc-service-name'];
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
                    short_id: reality['short-id'] || reality.short_id,
                },
            };
        }
    } else if (type === 'trojan') {
        outbound.type = 'trojan';
        outbound.server = server;
        outbound.server_port = port;
        outbound.password = proxy.password || '';
        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server,
        };
        if (proxy.network === 'ws') {
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            outbound.transport = {
                type: 'ws',
                path: wsOpts?.path || '/',
                headers: wsOpts?.headers || {},
            };
        }
    } else if (type === 'hysteria2' || type === 'hy2') {
        outbound.type = 'hysteria2';
        outbound.server = server;
        outbound.server_port = port;
        outbound.password = proxy.password || '';
        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server,
        };
    } else if (type === 'tuic') {
        outbound.type = 'tuic';
        outbound.server = server;
        outbound.server_port = port;
        outbound.uuid = proxy.uuid || '';
        outbound.password = proxy.password || '';

        const congestionControl =
            proxy['congestion-controller'] || proxy['congestion-control'] || proxy.congestion;
        if (congestionControl) outbound.congestion_control = congestionControl;
        // sing-box TUIC schema has no udp_relay_mode field; do not emit Clash-only option.
        if (proxy['udp-over-stream'] !== undefined)
            outbound.udp_over_stream = Boolean(proxy['udp-over-stream']);
        if (proxy['zero-rtt-handshake'] !== undefined || proxy['reduce-rtt'] !== undefined) {
            outbound.zero_rtt_handshake = Boolean(
                proxy['zero-rtt-handshake'] ?? proxy['reduce-rtt']
            );
        }
        if (proxy.heartbeat) outbound.heartbeat = String(proxy.heartbeat);
        if (proxy.network) outbound.network = proxy.network;

        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server,
        };
        if (proxy.alpn) outbound.tls.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
    } else if (type === 'anytls') {
        outbound.type = 'anytls';
        outbound.server = server;
        outbound.server_port = port;
        outbound.password = proxy.password || '';
        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server,
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
        outbound.local_address = Array.isArray(proxy.ip) ? proxy.ip : proxy.ip ? [proxy.ip] : [];
        outbound.peer_public_key = proxy['public-key'] || '';
        outbound.pre_shared_key = proxy['preshared-key'] || '';
        outbound.reserved = proxy.reserved;
    } else if (type === 'http' || type === 'https') {
        outbound.type = 'http';
        outbound.server = server;
        outbound.server_port = port;
        if (proxy.username) outbound.username = proxy.username;
        if (proxy.password) outbound.password = proxy.password;
        if (type === 'https' || proxy.tls || proxy.sni || proxy.servername) {
            outbound.tls = {
                enabled: true,
                server_name: proxy.sni || proxy.servername || server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true,
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
                server_name: proxy.sni || proxy.servername || server,
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
    if (
        (proxy.sni || proxy.servername) &&
        ((type !== 'ss' && type !== 'shadowsocks') || proxy.tls || outbound.tls?.enabled)
    ) {
        outbound.tls = outbound.tls || {};
        outbound.tls.server_name = proxy.sni || proxy.servername;
    }
    if (proxy['client-fingerprint']) {
        outbound.tls = outbound.tls || {};
        outbound.tls.utls = { enabled: true, fingerprint: proxy['client-fingerprint'] };
    }

    if (proxy.tfo) {
        outbound.tcp_fast_open = true;
    }

    return outbound;
}

export function generateBuiltinSingboxConfig(nodeList, options = {}) {
    const {
        managedConfigUrl = '',
        skipCertVerify = false,
        enableUdp = false,
        enableTfo = false,
        ruleLevel = 'std',
    } = options;

    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = cleanedNodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));

    const outbounds = [];
    const usedNames = new Map();
    const nodeEntries = [];

    const proxies = urlsToClashProxies(nodeUrls, options);

    // 应用 UDP 开关
    // (已在 urlsToClashProxies 中全局处理)

    for (const clashProxy of proxies) {
        const baseName = sanitizeName(clashProxy.name);
        clashProxy.name = getUniqueName(baseName, usedNames);

        const outbound = buildOutbound(clashProxy);
        if (outbound) {
            outbounds.push(outbound);
            nodeEntries.push({ tag: outbound.tag, outbound });
        }
    }

    // 没有可用节点时不要在这里补 DIRECT：config.outbounds 组装时已经固定加入
    // DIRECT/REJECT，这里再 push 会产生两个同名 outbound（sing-box 会拒绝重复 tag）。

    const levelKey = (ruleLevel || 'std').toUpperCase();
    // 获取内置策略组
    const policyGroupsFactory = POLICY_GROUPS[levelKey] || POLICY_GROUPS.STD;
    let proxyGroups = policyGroupsFactory(outbounds, options);
    proxyGroups = pruneProxyGroups(proxyGroups, outbounds);

    if (levelKey === 'RELAY') {
        const chainOutbounds = nodeEntries.map(({ tag, outbound }) => ({
            ...outbound,
            tag: `🔗 链式代理 - ${tag}`,
            detour: '入口节点',
        }));
        const chainTags = chainOutbounds.map((outbound) => outbound.tag);
        // 没有任何可用节点时不能回落成 DIRECT：链式组的空兜底会被 pruneProxyGroups
        // 填成 DIRECT，DNS 出口再引用它就会变成"直连 DNS"。这里显式 fail-closed。
        const chainTargets = chainTags.length > 0 ? chainTags : ['REJECT'];
        outbounds.push(...chainOutbounds);
        proxyGroups = proxyGroups
            .map((group) => {
                if (group.name === RELAY_CHAIN_GROUP) {
                    return {
                        ...group,
                        // Sing-box 通过 detour 表达链式出站。保持上一版可用结构：
                        // “链式代理”直接选择带 detour 的落地副本；同时隐藏“落地节点”分组。
                        type: 'select',
                        proxies: chainTargets,
                    };
                }
                if (group.name === '落地节点') {
                    return null;
                }
                if (group.name === DNS_PROXY_GROUP) {
                    // DNS 出口改为引用链式出站组：dns.servers 的 detour 只经过链式副本，
                    // 不再直接拨原始节点（原行为会绕过链式入口，从最快裸节点发出 DNS）。
                    // 该组没有非链式成员，链式不可用时 DNS 只会失败，不会回落到裸节点。
                    return {
                        name: DNS_PROXY_GROUP,
                        type: 'select',
                        proxies: chainTags.length > 0 ? [RELAY_CHAIN_GROUP] : ['REJECT'],
                    };
                }
                return group;
            })
            .filter(Boolean);
        proxyGroups = pruneProxyGroups(proxyGroups, outbounds);
    }

    // DNS 出口可见、可手选：链式版默认 `🔗 链式代理`，其它等级默认 `♻️ 自动选择`，
    // 也可锁到地区组/手动切换（不给 DIRECT，避免把 DNS 放回直连）。
    // 没有任何可用节点时不放开候选：链式组已兜底 REJECT，放开只会把 DNS 指向 DIRECT。
    if (nodeEntries.length > 0) {
        const chainApplied = levelKey === 'RELAY';
        proxyGroups = promoteDnsExitGroup(proxyGroups, {
            preferred: chainApplied ? RELAY_CHAIN_GROUP : null,
        });
    }

    // 将抽象分组转换为 Sing-Box Outbounds
    const groupOutbounds = proxyGroups.map((group) => {
        let type = 'selector';
        if (group.type === 'url-test') type = 'urltest';
        if (group.type === 'fallback') type = 'urltest'; // Sing-Box 暂时映射为 urltest

        return {
            tag: group.name,
            type: type,
            outbounds: group.proxies,
            ...(type === 'urltest'
                ? {
                      url: 'http://www.gstatic.com/generate_204',
                      interval: '10m',
                      tolerance: 50,
                  }
                : {}),
        };
    });

    // 从统一规则库获取分流规则
    const rawRules = getBuiltinRules(levelKey, 'singbox');

    // 提取远程 Rule Set 定义 (Sing-Box 格式)
    const ruleSetsMap = getRemoteProviderDefinitions('singbox', rawRules);
    const ruleSets = [
        getSingboxDnsRuleSet(),
        ...Object.values(ruleSetsMap).filter((ruleSet) => ruleSet.tag !== SINGBOX_CN_RULE_SET),
    ];

    // 转换路由规则：将中间对象映射为 Sing-Box 语法
    const routeRules = [
        // 把发往 53 端口的 DNS 查询交给内部 DNS，而不是当成普通出站流量转发出去。
        // 必须带 `port` 匹配：sing-box 的 hijack-dns 会对命中的连接/报文整体生效，
        // 无条件规则会把所有流量都当成 DNS 处理。也必须排在私网直连等规则之前。
        { port: 53, action: 'hijack-dns' },
        {
            ip_cidr: ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
            outbound: 'DIRECT',
        },
        { domain_suffix: ['localhost'], outbound: 'DIRECT' },
        ...rawRules.map((r) => {
            if (r.type === 'rule_set') return { rule_set: [r.tag], outbound: r.outbound };
            return r; // 已经是 Sing-Box 格式的普通规则
        }),
        { domain_suffix: ['cn'], outbound: 'DIRECT' },
    ];

    const dnsConfig = buildSingboxDnsConfig(options.customDnsOverride || '', {
        mode: options.dnsMode,
        proxyGroup: DNS_PROXY_GROUP,
    });

    const config = {
        log: { level: 'info' },
        dns: dnsConfig,
        inbounds: [
            {
                type: 'tun',
                tag: 'tun-in',
                address: ['172.19.0.1/30'],
                auto_route: true,
                strict_route: true,
                stack: 'mixed',
            },
        ],
        outbounds: [
            { tag: 'DIRECT', type: 'direct' },
            { tag: 'REJECT', type: 'block' },
            ...outbounds,
            ...groupOutbounds,
        ],
        route: {
            auto_detect_interface: true,
            default_domain_resolver: dnsConfig.servers[0]?.tag || 'dns-cn-1',
            final: levelKey === 'RELAY' ? DEFAULT_RELAY_GROUP : DEFAULT_SELECT_GROUP,
            rule_set: ruleSets,
            rules: routeRules,
        },
    };

    return JSON.stringify(config, null, 2) + '\n';
}
