import { urlsToClashProxies } from '../../../utils/url-to-clash.js';
import { normalizeUnifiedTemplateModel } from '../template-model.js';

function buildProxyLine(proxy) {
    const type = String(proxy.type || '').toLowerCase();
    const name = proxy.name || 'Untitled';
    const server = proxy.server;
    const port = proxy.port;
    if (!server || !port) return null;

    if (type === 'trojan') {
        const extras = [`password=${proxy.password || ''}`];
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy.network === 'ws') {
            extras.push('ws=true');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`ws-path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`ws-headers=Host:${wsOpts.headers.Host}`);
        }
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('skip-cert-verify=true');
        return `${name} = trojan, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'ss' || type === 'shadowsocks') {
        return `${name} = ss, ${server}, ${port}, encrypt-method=${proxy.cipher || 'aes-128-gcm'}, password=${proxy.password || ''}`;
    }
    if (type === 'vmess') {
        const extras = [`username=${proxy.uuid || ''}`];
        const network = proxy.network || '';
        
        if (network === 'ws' || proxy['ws-opts']) {
            extras.push('ws=true');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`ws-path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`ws-headers=Host:${wsOpts.headers.Host}`);
        } else if (network === 'grpc') {
            extras.push('transport=grpc');
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            if (grpcOpts?.['grpc-service-name']) extras.push(`grpc-service-name=${grpcOpts['grpc-service-name']}`);
        } else if (network === 'h2') {
            extras.push('transport=h2');
            const h2Opts = proxy['h2-opts'] || proxy.h2Opts;
            if (h2Opts?.path) extras.push(`h2-path=${h2Opts.path}`);
            if (h2Opts?.host) {
                const host = Array.isArray(h2Opts.host) ? h2Opts.host[0] : h2Opts.host;
                extras.push(`h2-host=${host}`);
            }
        }

        if (proxy.alterId === 0 || proxy.alterId === undefined || proxy.alterId === null) extras.push('vmess-aead=true');
        const sni = proxy.servername ?? proxy.sni;
        if (proxy.tls || sni !== undefined) extras.push('tls=true');
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('skip-cert-verify=true');
        return `${name} = vmess, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'vless') {
        const extras = [`username=${proxy.uuid || ''}`];
        if (proxy.network) extras.push(`transport=${proxy.network}`);
        if (proxy.network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            if (grpcOpts?.['grpc-service-name']) extras.push(`grpc-service-name=${grpcOpts['grpc-service-name']}`);
        }
        if (proxy.flow) extras.push(`flow=${proxy.flow}`);
        if (proxy.tls || proxy.sni || proxy.servername) extras.push('tls=true');
        const realityOpts = proxy['reality-opts'] || proxy.realityOpts;
        if (realityOpts) {
            extras.push('reality=true');
            if (realityOpts['public-key']) extras.push(`public-key=${realityOpts['public-key']}`);
            if (realityOpts['short-id']) extras.push(`short-id=${realityOpts['short-id']}`);
        }
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('skip-cert-verify=true');
        return `${name} = vless, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'hysteria2' || type === 'hy2') {
        const extras = [`password=${proxy.password || ''}`];
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        return `${name} = hysteria2, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'tuic') {
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['congestion-controller']) extras.push(`congestion-control=${proxy['congestion-controller']}`);
        if (proxy['udp-relay-mode'] === 'native') extras.push(`udp-relay=true`);
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            extras.push(`alpn=${alpn}`);
        }
        return `${name} = tuic, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'wireguard') {
        const extras = [];
        if (proxy['private-key']) extras.push(`private-key=${proxy['private-key']}`);
        if (proxy['public-key']) extras.push(`peer-public-key=${proxy['public-key']}`);
        if (proxy.reserved) {
            const reserved = Array.isArray(proxy.reserved) ? proxy.reserved.join('/') : proxy.reserved;
            extras.push(`client-id=${reserved}`);
        }
        return `${name} = wireguard, ${server}, ${port}${extras.length ? `, ${extras.join(', ')}` : ''}`;
    }
    if (type === 'http' || type === 'https' || type === 'socks5') {
        const extras = [];
        if (proxy.username) extras.push(`username=${proxy.username}`);
        if (proxy.password) extras.push(`password=${proxy.password}`);
        if (type === 'https') extras.push('tls=true');
        return `${name} = ${type === 'socks5' ? 'socks5' : 'http'}, ${server}, ${port}${extras.length ? `, ${extras.join(', ')}` : ''}`;
    }
    if (type === 'anytls') {
        const extras = [`password=${proxy.password || ''}`];
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            extras.push(`alpn=${alpn}`);
        }
        if (proxy['skip-cert-verify'] === true) extras.push('skip-cert-verify=true');
        return `${name} = anytls, ${server}, ${port}, ${extras.join(', ')}`;
    }

    return null;
}

function buildProxyGroupLine(group) {
    const type = String(group.type || 'select').toLowerCase();
    const rawMembers = Array.isArray(group.members) ? group.members.filter(Boolean) : [];
    const members = (['url-test', 'fallback', 'load-balance'].includes(type)
        ? rawMembers.filter(member => !['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'].includes(String(member).toUpperCase()))
        : rawMembers).join(', ');
    const filter = Array.isArray(group.filters) && group.filters.length > 0 ? group.filters.join('|') : '';
    const tolerance = group.options?.tolerance;
    if (type === 'url-test') {
        const base = filter ? `${group.name} = url-test, policy-path=${filter}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}` : `${group.name} = url-test, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}`;
        return tolerance ? `${base}, tolerance=${tolerance}` : base;
    }
    if (type === 'fallback') {
        const base = filter ? `${group.name} = fallback, policy-path=${filter}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}` : `${group.name} = fallback, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}`;
        return tolerance ? `${base}, tolerance=${tolerance}` : base;
    }
    if (type === 'load-balance') {
        return filter ? `${group.name} = load-balance, policy-path=${filter}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}` : `${group.name} = load-balance, ${members}`;
    }
    return `${group.name} = select, ${members}`;
}

function buildRuleLine(rule) {
    const type = String(rule.type || '').toUpperCase();
    if (!type) return null;
    if (type === 'RULE-SET') return `RULE-SET,${rule.value},${rule.policy}`;
    if (type === 'MATCH' || type === 'FINAL') return `FINAL,${rule.policy}`;
    if (type === 'GEOIP') return `GEOIP,${rule.value || 'CN'},${rule.policy}`;
    return `${type},${rule.value},${rule.policy}`;
}

export function renderSurgeFromTemplateModel(model, options = {}) {
    const normalizedModel = normalizeUnifiedTemplateModel(model);
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(normalizedModel.proxies) && normalizedModel.proxies.length > 0
        ? normalizedModel.proxies
        : urlsToClashProxies(proxyUrls);

    const proxyLines = proxies.map(buildProxyLine).filter(Boolean);
    const groupLines = normalizedModel.groups
        .filter(group => Array.isArray(group.members) && group.members.length > 0)
        .map(buildProxyGroupLine)
        .filter(Boolean);
    const ruleLines = normalizedModel.rules.map(buildRuleLine).filter(Boolean);

    return [
        '[Proxy]',
        ...proxyLines,
        '',
        '[Proxy Group]',
        ...groupLines,
        '',
        '[Rule]',
        ...ruleLines,
        ''
    ].join('\n');
}
