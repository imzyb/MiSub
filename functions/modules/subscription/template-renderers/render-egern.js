import yaml from 'js-yaml';
import { normalizeUnifiedTemplateModel } from '../template-model.js';

function mapTransport(proxy) {
    const network = String(proxy.network || 'tcp').toLowerCase();
    const transport = {};

    if (network === 'ws' || network === 'websocket') {
        transport.ws = {
            path: proxy['ws-opts']?.path || '/',
            headers: proxy['ws-opts']?.headers || {}
        };
    } else if (network === 'grpc') {
        transport.grpc = {
            service_name: proxy['grpc-opts']?.['service-name'] || proxy['grpc-opts']?.serviceName || 'grpc'
        };
    } else if (network === 'h2' || network === 'http2') {
        transport.h2 = {
            path: proxy['h2-opts']?.path || '/',
            host: Array.isArray(proxy['h2-opts']?.host) ? proxy['h2-opts'].host : [proxy['h2-opts']?.host || proxy.server]
        };
    } else if (network === 'http') {
        transport.http = {
            path: proxy['http-opts']?.path || '/',
            headers: proxy['http-opts']?.headers || {}
        };
    } else if (network === 'quic') {
        transport.quic = {
            security: proxy['quic-opts']?.security || 'none',
            key: proxy['quic-opts']?.key || '',
            header: proxy['quic-opts']?.header || { type: 'none' }
        };
    }

    if (proxy.tls || !!proxy['reality-opts']) {
        transport.tls = {
            sni: proxy.sni || proxy.servername || proxy.server,
            skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify),
            alpn: proxy.alpn || ['h2', 'http/1.1']
        };
        if (proxy['reality-opts']) {
            transport.tls.reality = {
                public_key: proxy['reality-opts']?.['public-key'] || proxy['reality-opts']?.publicKey || '',
                short_id: proxy['reality-opts']?.['short-id'] || proxy['reality-opts']?.shortId || ''
            };
        }
        if (proxy.fingerprint) {
            transport.tls.fingerprint = proxy.fingerprint;
        }
    }

    return Object.keys(transport).length > 0 ? transport : undefined;
}

function mapProxy(proxy) {
    const type = String(proxy.type || '').toLowerCase();
    const name = proxy.name;

    if (type === 'trojan') {
        const mapped = {
            trojan: {
                name,
                server: proxy.server,
                port: proxy.port,
                password: proxy.password,
                sni: proxy.sni || proxy.server,
                tfo: Boolean(proxy.tfo),
                udp_relay: proxy.udp !== false,
                skip_tls_verify: Boolean(proxy['skip-cert-verify'])
            }
        };
        const transport = mapTransport(proxy);
        if (transport) mapped.trojan.transport = transport;
        return mapped;
    }

    if (type === 'vless') {
        const mapped = {
            vless: {
                name,
                server: proxy.server,
                port: proxy.port,
                user_id: proxy.uuid,
                tfo: Boolean(proxy.tfo),
                udp_relay: proxy.udp !== false
            }
        };
        if (proxy.flow) mapped.vless.flow = proxy.flow;
        const transport = mapTransport(proxy);
        if (transport) mapped.vless.transport = transport;
        return mapped;
    }

    if (type === 'vmess') {
        const mapped = {
            vmess: {
                name,
                server: proxy.server,
                port: proxy.port,
                user_id: proxy.uuid,
                security: proxy.cipher || 'auto',
                legacy: Number(proxy.alterId || 0) > 0,
                tfo: Boolean(proxy.tfo),
                udp_relay: proxy.udp !== false
            }
        };
        const transport = mapTransport(proxy);
        if (transport) mapped.vmess.transport = transport;
        return mapped;
    }

    if (type === 'ss' || type === 'shadowsocks') {
        const mapped = {
            shadowsocks: {
                name,
                server: proxy.server,
                port: proxy.port,
                method: proxy.cipher || proxy.method,
                password: proxy.password,
                udp_relay: proxy.udp !== false,
                tfo: Boolean(proxy.tfo)
            }
        };
        if (proxy.plugin === 'obfs') {
            mapped.shadowsocks.obfs = proxy['plugin-opts']?.mode || 'http';
            mapped.shadowsocks.obfs_host = proxy['plugin-opts']?.host || proxy.server;
        }
        return mapped;
    }

    if (type === 'hysteria2' || type === 'hy2') {
        const mapped = {
            hysteria2: {
                name,
                server: proxy.server,
                port: proxy.port,
                auth: proxy.password,
                sni: proxy.sni || proxy.server,
                skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify)
            }
        };
        if (proxy.obfs || proxy['obfs-opts']) {
            mapped.hysteria2.obfuscation = {
                type: proxy.obfs || proxy['obfs-opts']?.type || 'salamander',
                password: proxy.password || proxy['obfs-opts']?.password || ''
            };
        }
        if (proxy.hop || proxy.portHopping) {
            mapped.hysteria2.port_hopping = String(proxy.hop || proxy.portHopping);
        }
        return mapped;
    }

    if (type === 'hysteria') {
        return {
            hysteria: {
                name,
                server: proxy.server,
                port: proxy.port,
                auth: proxy.password || proxy.auth_str,
                up: proxy.up || '100 Mbps',
                down: proxy.down || '100 Mbps',
                sni: proxy.sni || proxy.server,
                skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify)
            }
        };
    }

    if (type === 'tuic') {
        const mapped = {
            tuic: {
                name,
                server: proxy.server,
                port: proxy.port,
                uuid: proxy.uuid,
                password: proxy.password,
                sni: proxy.sni || proxy.server,
                alpn: proxy.alpn || ['h3'],
                udp_relay_mode: proxy.udp_relay_mode || 'native',
                congestion_control: proxy.congestion_control || 'cubic',
                skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify)
            }
        };
        if (proxy.hop || proxy.portHopping) {
            mapped.tuic.port_hopping = String(proxy.hop || proxy.portHopping);
        }
        return mapped;
    }

    if (type === 'wireguard') {
        return {
            wireguard: {
                name,
                server: proxy.server,
                port: proxy.port,
                private_key: proxy['private-key'] || proxy.privateKey,
                peer_public_key: proxy['public-key'] || proxy.publicKey,
                pre_shared_key: proxy['preshared-key'] || proxy.preSharedKey,
                local_ipv4: Array.isArray(proxy.ip) ? proxy.ip.find(ip => !String(ip).includes(':')) : proxy.ip,
                local_ipv6: Array.isArray(proxy.ip) ? proxy.ip.find(ip => String(ip).includes(':')) : undefined,
                reserved: proxy.reserved,
                mtu: proxy.mtu || 1420
            }
        };
    }

    if (type === 'http' || type === 'https') {
        return {
            http: {
                name,
                server: proxy.server,
                port: proxy.port,
                username: proxy.username || proxy.user,
                password: proxy.password || proxy.pass,
                tls: type === 'https' || !!proxy.tls,
                sni: proxy.sni || proxy.server,
                skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify)
            }
        };
    }

    if (type === 'socks5' || type === 'socks') {
        return {
            socks5: {
                name,
                server: proxy.server,
                port: proxy.port,
                username: proxy.username || proxy.user,
                password: proxy.password || proxy.pass,
                tls: Boolean(proxy.tls),
                sni: proxy.sni || proxy.server,
                skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify)
            }
        };
    }

    if (type === 'anytls') {
        return {
            anytls: {
                name,
                server: proxy.server,
                port: proxy.port,
                password: proxy.password,
                sni: proxy.sni || proxy.server,
                skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify)
            }
        };
    }

    return null;
}

function mapPolicyGroup(group) {
    const type = String(group.type || 'select').toLowerCase();
    const policies = Array.isArray(group.members) ? group.members.filter(Boolean) : [];

    if (type === 'url-test' || type === 'urltest') {
        return {
            auto_test: {
                name: group.name,
                policies,
                interval: Number(group.options?.interval) || 600,
                tolerance: Number(group.options?.tolerance) || 100,
                timeout: Number(group.options?.timeout) || 5
            }
        };
    }

    if (type === 'fallback') {
        return {
            fallback: {
                name: group.name,
                policies,
                interval: Number(group.options?.interval) || 600,
                timeout: Number(group.options?.timeout) || 5
            }
        };
    }

    if (type === 'load-balance' || type === 'loadbalance') {
        return {
            load_balance: {
                name: group.name,
                policies
            }
        };
    }

    if (type === 'relay') {
        return {
            relay: {
                name: group.name,
                policies
            }
        };
    }

    return {
        select: {
            name: group.name,
            policies
        }
    };
}

function mapRule(rule) {
    const type = String(rule.type || '').toLowerCase();
    const policy = rule.policy || 'DIRECT';
    const value = rule.value;

    if (type === 'final' || type === 'match') {
        return { default: { policy } };
    }

    if (type === 'rule-set' && /^https?:\/\//i.test(value || '')) {
        return {
            rule_set: {
                match: value,
                policy,
                update_interval: 86400
            }
        };
    }

    const supported = new Set(['domain', 'domain_keyword', 'domain_suffix', 'domain_regex', 'domain_wildcard', 'geoip', 'ip_cidr', 'ip_cidr6', 'asn', 'url_regex', 'dest_port', 'protocol']);
    if (!supported.has(type)) return null;

    return {
        [type]: {
            match: value,
            policy,
            ...(rule.noResolve ? { no_resolve: true } : {})
        }
    };
}

export function renderEgernFromTemplateModel(model) {
    const normalizedModel = normalizeUnifiedTemplateModel(model);

    const proxies = normalizedModel.proxies
        .map(mapProxy)
        .filter(Boolean);

    const policyGroups = normalizedModel.groups
        .filter(group => Array.isArray(group.members) && group.members.length > 0)
        .map(mapPolicyGroup);

    const rules = normalizedModel.rules
        .map(mapRule)
        .filter(Boolean);

    const config = {
        auto_update: normalizedModel.settings.managedConfigUrl
            ? {
                url: normalizedModel.settings.managedConfigUrl,
                interval: normalizedModel.settings.interval || 86400
            }
            : undefined,
        proxies,
        policy_groups: policyGroups,
        rules
    };

    return yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
    });
}
