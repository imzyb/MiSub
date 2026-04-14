import yaml from 'js-yaml';
import { normalizeUnifiedTemplateModel } from '../template-model.js';

/**
 * Sanitize string: trim and remove carriage returns/newlines which break YAML indentation
 * @param {any} val 
 * @returns {string}
 */
function s(val) {
    if (val === undefined || val === null) return '';
    return String(val).replace(/[\r\n]/g, '').trim();
}

function mapTransport(proxy) {
    const network = String(proxy.network || 'tcp').toLowerCase();
    const transport = {};

    const tls = (proxy.tls || !!proxy['reality-opts']) ? {
        skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify),
        sni: s(proxy.servername ?? proxy.sni ?? proxy.server)
    } : null;

    if (network === 'ws' || network === 'websocket') {
        if (tls) {
            transport.wss = {
                path: s(proxy['ws-opts']?.path || '/'),
                headers: proxy['ws-opts']?.headers || {},
                ...tls
            };
        } else {
            transport.ws = {
                path: s(proxy['ws-opts']?.path || '/'),
                headers: proxy['ws-opts']?.headers || {}
            };
        }
    } else if (network === 'grpc') {
        transport.grpc = {
            service_name: s(proxy['grpc-opts']?.['grpc-service-name'] || proxy['grpc-opts']?.['service-name'] || proxy['grpc-opts']?.serviceName || 'grpc')
        };
        if (tls) transport.tls = tls;
    } else if (network === 'h2' || network === 'http2') {
        transport.h2 = {
            path: s(proxy['h2-opts']?.path || '/'),
            host: Array.isArray(proxy['h2-opts']?.host) ? proxy['h2-opts'].host.map(h => s(h)) : [s(proxy['h2-opts']?.host || proxy.server)]
        };
        if (tls) transport.tls = tls;
    } else {
        if (tls) transport.tls = tls;
    }

    if (transport.tls && proxy['reality-opts']) {
        transport.tls.reality = {
            public_key: s(proxy['reality-opts']?.['public-key'] || proxy['reality-opts']?.publicKey),
            short_id: s(proxy['reality-opts']?.['short-id'] || proxy['reality-opts']?.shortId)
        };
    }

    return Object.keys(transport).length > 0 ? transport : undefined;
}

function mapProxy(proxy) {
    const type = s(proxy.type).toLowerCase();
    const name = s(proxy.name);
    const server = s(proxy.server);
    const password = s(proxy.password);
    const uuid = s(proxy.uuid);

    if (type === 'trojan') {
        const mapped = {
            trojan: {
                name,
                server,
                port: proxy.port,
                password,
                skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify)
            }
        };
        const sni = s(proxy.servername ?? proxy.sni ?? proxy.server);
        if (sni) mapped.trojan.sni = sni;
        
        // Egern Trojan 特殊处理: 使用 websocket 对象而非 transport
        if (proxy.network === 'ws' || proxy.network === 'websocket') {
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            mapped.trojan.websocket = {
                enabled: true,
                path: s(wsOpts?.path || '/')
            };
            const host = s(wsOpts?.headers?.Host || wsOpts?.host);
            if (host) mapped.trojan.websocket.host = host;
        } else {
            const transport = mapTransport(proxy);
            if (transport) mapped.trojan.transport = transport;
        }
        return mapped;
    }

    if (type === 'vless') {
        const mapped = {
            vless: {
                name,
                server,
                port: proxy.port,
                user_id: uuid
            }
        };
        if (proxy.flow) {
            mapped.vless.flow = proxy.flow.includes('vision') ? 'xtls-rprx-vision' : s(proxy.flow);
        }
        const transport = mapTransport(proxy);
        if (transport) mapped.vless.transport = transport;
        return mapped;
    }

    if (type === 'vmess') {
        const mapped = {
            vmess: {
                name,
                server,
                port: proxy.port,
                user_id: uuid,
                security: s(proxy.cipher || 'auto')
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
                server,
                port: proxy.port,
                method: s(proxy.cipher || proxy.method),
                password
            }
        };
        if (proxy.plugin === 'obfs') {
            mapped.shadowsocks.obfs = s(proxy['plugin-opts']?.mode || 'http');
            mapped.shadowsocks.obfs_host = s(proxy['plugin-opts']?.host || proxy.server);
        }
        return mapped;
    }

    if (type === 'hysteria2' || type === 'hy2') {
        const mapped = {
            hysteria2: {
                name,
                server,
                port: proxy.port,
                auth: password,
                skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify)
            }
        };
        const sni = s(proxy.servername ?? proxy.sni ?? proxy.server);
        if (sni) mapped.hysteria2.sni = sni;
        return mapped;
    }

    if (type === 'tuic') {
        const mapped = {
            tuic: {
                name,
                server,
                port: proxy.port,
                uuid,
                password,
                version: 5,
                congestion_control: s(proxy['congestion-control'] || 'cubic'),
                skip_tls_verify: Boolean(proxy['skip-cert-verify'] || proxy.skipCertVerify)
            }
        };
        const sni = s(proxy.servername ?? proxy.sni ?? proxy.server);
        if (sni) mapped.tuic.sni = sni;

        if (proxy.alpn) {
            mapped.tuic.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [s(proxy.alpn)];
        }

        if (proxy['udp-relay-mode']) {
            mapped.tuic.udp_relay_mode = s(proxy['udp-relay-mode']);
        }

        return mapped;
    }

    if (type === 'anytls') {
        const mapped = {
            anytls: {
                name,
                server,
                port: proxy.port,
                password,
                udp_relay: Boolean(proxy.udp)
            }
        };
        const sni = s(proxy.servername ?? proxy.sni ?? proxy.server);
        if (sni) mapped.anytls.sni = sni;
        return mapped;
    }

    return {
        [type]: {
            name,
            server,
            port: proxy.port
        }
    };
}

function mapPolicyGroup(group) {
    const type = s(group.type || 'select').toLowerCase();
    const policies = Array.isArray(group.members) ? group.members.filter(Boolean).map(p => s(p)) : [];

    if (type === 'url-test' || type === 'urltest' || type === 'auto-test') {
        return {
            auto_test: {
                name: s(group.name),
                policies,
                interval: Number(group.options?.interval) || 600,
                tolerance: Number(group.options?.tolerance) || 100
            }
        };
    }

    if (type === 'fallback') {
        return {
            fallback: {
                name: s(group.name),
                policies,
                interval: Number(group.options?.interval) || 600
            }
        };
    }

    return {
        select: {
            name: s(group.name),
            policies
        }
    };
}

function mapRule(rule) {
    const type = s(rule.type).toLowerCase();
    const policy = s(rule.policy || 'DIRECT');
    const value = s(rule.value);

    if (type === 'final' || type === 'match') {
        return { default: { policy } };
    }

    if (type === 'rule-set' && /^https?:\/\//i.test(value)) {
        return {
            rule_set: {
                match: value,
                policy,
                update_interval: 86400
            }
        };
    }

    const targetType = type.replace(/-/g, '_');
    
    return {
        [targetType]: {
            match: value,
            policy
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
        proxies,
        policy_groups: policyGroups,
        rules
    };

    if (normalizedModel.settings.managedConfigUrl) {
        config.auto_update = {
            url: s(normalizedModel.settings.managedConfigUrl),
            interval: normalizedModel.settings.interval || 86400
        };
    }

    return yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: true
    });
}
