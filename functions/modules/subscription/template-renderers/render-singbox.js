import { urlsToClashProxies } from '../../../utils/url-to-clash.js';
import { normalizeUnifiedTemplateModel } from '../template-model.js';

function sanitizeTag(value) {
    return String(value || '').trim() || 'Untitled';
}

function parsePort(port) {
    const num = Number.parseInt(String(port), 10);
    return Number.isFinite(num) ? num : undefined;
}

function buildOutbound(proxy) {
    if (!proxy || !proxy.server || !proxy.port) return null;

    const type = String(proxy.type || '').toLowerCase();
    const tag = sanitizeTag(proxy.name);
    const server = proxy.server;
    const serverPort = parsePort(proxy.port);
    if (!serverPort) return null;

    if (type === 'trojan') {
        return {
            tag,
            type: 'trojan',
            server,
            server_port: serverPort,
            password: proxy.password || '',
            tls: {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true
            }
        };
    }

    if (type === 'ss' || type === 'shadowsocks') {
        const outbound = {
            tag,
            type: 'shadowsocks',
            server,
            server_port: serverPort,
            method: proxy.cipher || 'aes-128-gcm',
            password: proxy.password || ''
        };
        const plugin = proxy.plugin || '';
        const opts = proxy['plugin-opts'] || proxy.pluginOpts || {};
        if (plugin === 'v2ray-plugin' || opts.mode === 'websocket') {
            outbound.transport = {
                type: 'ws',
                path: opts.path || '/',
                headers: opts.host ? { Host: opts.host } : {}
            };
            if (opts.tls || opts.mode === 'websocket-tls') {
                outbound.tls = {
                    enabled: true,
                    server_name: opts.host || proxy.servername || proxy.sni || server,
                    insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true
                };
            }
        }
        return outbound;
    }

    if (type === 'vmess') {
        const outbound = {
            tag,
            type: 'vmess',
            server,
            server_port: serverPort,
            uuid: proxy.uuid || '',
            security: proxy.cipher || 'auto',
            udp_relay_mode: proxy['udp-relay-mode'] || 'native',
            congestion_control: proxy['congestion-control'] || 'cubic',
            alter_id: Number.isFinite(Number(proxy.alterId)) ? Number(proxy.alterId) : 0
        };

        const network = proxy.network || '';
        if (network === 'ws') {
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            outbound.transport = {
                type: 'ws',
                path: wsOpts?.path || '/',
                headers: wsOpts?.headers || {}
            };
        } else if (network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            outbound.transport = {
                type: 'grpc',
                service_name: grpcOpts?.['grpc-service-name'] || grpcOpts?.serviceName || 'grpc'
            };
        } else if (network === 'h2' || network === 'http') {
            const opts = proxy[`${network}-opts`] || proxy[`${network}Opts`];
            outbound.transport = {
                type: network === 'h2' ? 'h2' : 'http',
                host: opts?.host ? (Array.isArray(opts.host) ? opts.host : [opts.host]) : [],
                path: opts?.path || '/'
            };
        }

        if (proxy.tls || proxy.sni || proxy.servername) {
            outbound.tls = {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true
            };
            if (proxy.alpn) outbound.tls.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
        }
        return outbound;
    }

    if (type === 'vless') {
        const outbound = {
            tag,
            type: 'vless',
            server,
            server_port: serverPort,
            uuid: proxy.uuid || ''
        };
        if (proxy.flow) outbound.flow = proxy.flow;

        const network = proxy.network || '';
        if (network === 'ws') {
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            outbound.transport = {
                type: 'ws',
                path: wsOpts?.path || '/',
                headers: wsOpts?.headers || {}
            };
        } else if (network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            outbound.transport = {
                type: 'grpc',
                service_name: grpcOpts?.['grpc-service-name'] || grpcOpts?.serviceName || 'grpc'
            };
        } else if (network === 'httpupgrade') {
            const httpupgradeOpts = proxy['httpupgrade-opts'] || proxy.httpupgradeOpts;
            outbound.transport = {
                type: 'httpupgrade',
                path: httpupgradeOpts?.path || '/',
                host: httpupgradeOpts?.host || ''
            };
        }

        if (proxy.tls || proxy.sni || proxy.servername) {
            outbound.tls = {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true
            };

            const fingerprint = proxy['client-fingerprint'] || proxy.clientFingerprint || proxy.fp;
            if (fingerprint) {
                outbound.tls.utls = {
                    enabled: true,
                    fingerprint: fingerprint
                };
            }

            const realityOpts = proxy['reality-opts'] || proxy.realityOpts;
            if (realityOpts) {
                outbound.tls.reality = {
                    enabled: true,
                    public_key: realityOpts['public-key'] || realityOpts.publicKey || '',
                    short_id: realityOpts['short-id'] || realityOpts.shortId || ''
                };
                if (realityOpts['spider-x'] || realityOpts.spiderX) {
                    outbound.tls.reality.spider_x = realityOpts['spider-x'] || realityOpts.spiderX;
                }
            }
        }
        return outbound;
    }

    if (type === 'hysteria2' || type === 'hy2') {
        return {
            tag,
            type: 'hysteria2',
            server,
            server_port: serverPort,
            password: proxy.password || '',
            tls: {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true
            }
        };
    }

    if (type === 'tuic') {
        const outbound = {
            tag,
            type: 'tuic',
            server,
            server_port: serverPort,
            uuid: proxy.uuid || '',
            password: proxy.password || '',
            tls: {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true
            }
        };
        if (proxy.alpn) outbound.tls.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
        if (proxy['congestion-control']) outbound.congestion_control = proxy['congestion-control'];
        if (proxy['udp-relay-mode']) outbound.udp_relay_mode = proxy['udp-relay-mode'];
        return outbound;
    }

    if (type === 'wireguard') {
        return {
            tag,
            type: 'wireguard',
            server,
            server_port: serverPort,
            local_address: Array.isArray(proxy.ip) ? proxy.ip : (proxy.ip ? [proxy.ip] : []),
            private_key: proxy['private-key'] || '',
            peer_public_key: proxy['public-key'] || '',
            pre_shared_key: proxy['preshared-key'] || ''
        };
    }

    return null;
}

function mapGroupType(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'select') return 'selector';
    if (normalized === 'url-test') return 'urltest';
    if (normalized === 'load-balance') return 'selector';
    return 'selector';
}

function buildGroupOutbounds(groups) {
    return groups.map(group => {
        const mappedType = mapGroupType(group.type);
        const rawMembers = Array.isArray(group.members) ? group.members.filter(Boolean) : [];
        const outbound = {
            tag: sanitizeTag(group.name),
            type: mappedType,
            outbounds: ['urltest'].includes(mappedType)
                ? rawMembers.filter(member => !['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'].includes(String(member).toUpperCase()))
                : rawMembers
        };

        if (mappedType === 'urltest') {
            outbound.url = group.options?.url || 'http://www.gstatic.com/generate_204';
            outbound.interval = `${group.options?.interval || 300}s`;
        }

        if (outbound.outbounds.length > 0) {
            outbound.default = outbound.outbounds[0];
        }

        return outbound;
    });
}

function mapRuleToSingbox(rule) {
    const type = String(rule.type || '').toLowerCase();
    if (type === 'rule-set') {
        return {
            rule_set: sanitizeTag(`${rule.policy}_${rule.value}`),
            outbound: rule.policy
        };
    }
    if (type === 'geoip') {
        const value = String(rule.value || 'cn').toLowerCase();
        return {
            rule_set: [`geoip-${value}`],
            outbound: rule.policy
        };
    }
    if (type === 'geosite') {
        const value = String(rule.value || 'cn').toLowerCase();
        return {
            rule_set: [`geosite-${value}`],
            outbound: rule.policy
        };
    }
    if (type === 'match' || type === 'final') {
        return {
            outbound: rule.policy
        };
    }
    if (type === 'domain-suffix') {
        return {
            domain_suffix: [rule.value],
            outbound: rule.policy
        };
    }
    if (type === 'domain-keyword') {
        return {
            domain_keyword: [rule.value],
            outbound: rule.policy
        };
    }
    return null;
}

function detectRuleSetFormat(url) {
    const raw = String(url || '').trim().toLowerCase();
    if (!raw) return 'source';
    return raw.endsWith('.srs') ? 'binary' : 'source';
}

function buildRuleSets(rules) {
    const remoteRuleSets = rules
        .filter(rule => String(rule.type || '').toLowerCase() === 'rule-set' && rule.source === 'remote')
        .map(rule => ({
            tag: sanitizeTag(`${rule.policy}_${rule.value}`),
            type: 'remote',
            format: detectRuleSetFormat(rule.value),
            url: rule.value,
            download_detour: 'DIRECT'
        }));

    const implicitRuleSets = [];
    const seen = new Set();

    rules.forEach(rule => {
        const type = String(rule.type || '').toLowerCase();
        if (type === 'geoip' || type === 'geosite') {
            const value = String(rule.value || 'cn').toLowerCase();
            const tag = `${type}-${value}`;
            if (!seen.has(tag)) {
                seen.add(tag);
                implicitRuleSets.push({
                    tag,
                    type: 'remote',
                    format: 'binary',
                    url: type === 'geoip'
                        ? `https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-${value}.srs`
                        : `https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-${value}.srs`,
                    download_detour: 'DIRECT'
                });
            }
        }
    });

    return [...remoteRuleSets, ...implicitRuleSets];
}

export function renderSingboxFromTemplateModel(model, options = {}) {
    const normalizedModel = normalizeUnifiedTemplateModel(model);
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(normalizedModel.proxies) && normalizedModel.proxies.length > 0
        ? normalizedModel.proxies
        : urlsToClashProxies(proxyUrls);
    const proxyOutbounds = proxies.map(buildOutbound).filter(Boolean);
    const groupOutbounds = buildGroupOutbounds(normalizedModel.groups.filter(g => Array.isArray(g.members) && g.members.length > 0));
    const ruleSetObjects = buildRuleSets(normalizedModel.rules);
    const routeRules = normalizedModel.rules.map(mapRuleToSingbox).filter(Boolean);

    const config = {
        log: { level: 'info' },
        dns: {
            strategy: 'prefer_ipv4',
            servers: [
                { tag: 'dns-ali', address: '223.5.5.5', detour: 'DIRECT' },
                { tag: 'dns-google', address: '8.8.8.8', detour: 'DIRECT' }
            ]
        },
        outbounds: [
            { tag: 'DIRECT', type: 'direct' },
            { tag: 'REJECT', type: 'block' },
            ...proxyOutbounds,
            ...groupOutbounds
        ],
        route: {
            auto_detect_interface: true,
            final: normalizedModel.groups[0]?.name || 'DIRECT',
            rule_set: ruleSetObjects,
            rules: routeRules
        }
    };

    return JSON.stringify(config, null, 2) + '\n';
}
