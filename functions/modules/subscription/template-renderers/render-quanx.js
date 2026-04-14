import { urlsToClashProxies } from '../../../utils/url-to-clash.js';
import { normalizeUnifiedTemplateModel } from '../template-model.js';

function buildProxyLine(proxy) {
    const type = String(proxy.type || '').toLowerCase();
    const name = proxy.name || 'Untitled';
    const server = proxy.server;
    const port = proxy.port;
    if (!server || !port) return null;

    if (type === 'trojan') {
        const extras = [];
        if (proxy.network === 'ws') {
            extras.push('obfs=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`obfs-uri=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`obfs-host=${wsOpts.headers.Host}`);
        } else {
            extras.push('over-tls=true');
        }
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`tls-host=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('tls-verification=false');
        return `trojan=${server}:${port}, password=${proxy.password || ''}${extras.length ? `, ${extras.join(', ')}` : ''}, tag=${name}`;
    }
    if (type === 'ss' || type === 'shadowsocks') {
        return `shadowsocks=${server}:${port}, method=${proxy.cipher || 'aes-128-gcm'}, password=${proxy.password || ''}, tag=${name}`;
    }
    if (type === 'vmess') {
        const extras = [];
        if (proxy.network === 'ws') {
            extras.push('obfs=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`obfs-uri=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`obfs-host=${wsOpts.headers.Host}`);
        }
        const sni = proxy.servername ?? proxy.sni;
        if (proxy.tls || sni !== undefined) extras.push('over-tls=true');
        if (sni !== undefined) extras.push(`tls-host=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('tls-verification=false');
        return `vmess=${server}:${port}, method=${proxy.cipher || 'auto'}, password=${proxy.uuid || ''}, tag=${name}${extras.length ? `, ${extras.join(', ')}` : ''}`;
    }
    if (type === 'vless') {
        const extras = [];
        if (proxy.network === 'ws') {
            extras.push('obfs=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`obfs-uri=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`obfs-host=${wsOpts.headers.Host}`);
        } else {
            extras.push('over-tls=true');
        }
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`tls-host=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('tls-verification=false');
        return `vless=${server}:${port}, password=${proxy.uuid || ''}${extras.length ? `, ${extras.join(', ')}` : ''}, tag=${name}`;
    }
    if (type === 'http' || type === 'https') {
        const extras = [];
        const sni = proxy.servername ?? proxy.sni;
        if (type === 'https') extras.push('over-tls=true');
        if (sni !== undefined) extras.push(`tls-host=${sni}`);
        return `http=${server}:${port}, username=${proxy.username || ''}, password=${proxy.password || ''}${extras.length ? `, ${extras.join(', ')}` : ''}, tag=${name}`;
    }
    if (type === 'hysteria2' || type === 'hy2') {
        const extras = [];
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('tls-verification=false');
        return `hysteria2=${server}:${port}, password=${proxy.password || ''}${extras.length ? `, ${extras.join(', ')}` : ''}, tag=${name}`;
    }
    if (type === 'tuic') {
        const extras = [];
        if (proxy.uuid) extras.push(proxy.uuid || '');
        if (proxy.password) extras.push(proxy.password || '');
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['congestion-control']) extras.push(`congestion-controller=${proxy['congestion-control']}`);
        if (proxy['udp-relay-mode']) extras.push(`udp-relay=${proxy['udp-relay-mode']}`);
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            extras.push(`alpn=${alpn}`);
        }
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('tls-verification=false');
        return `tuic=${server}:${port}, ${extras.join(', ')}, tag=${name}`;
    }
    if (type === 'anytls') {
        const extras = [`password=${proxy.password || ''}`];
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            extras.push(`alpn=${alpn}`);
        }
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('tls-verification=false');
        return `anytls=${server}:${port}, ${extras.join(', ')}, tag=${name}`;
    }
    return null;
}

function buildPolicyLine(group) {
    const type = String(group.type || 'select').toLowerCase();
    const rawMembers = Array.isArray(group.members) ? group.members.filter(Boolean) : [];
    const members = (['url-test', 'fallback', 'load-balance'].includes(type)
        ? rawMembers.filter(member => !['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'].includes(String(member).toUpperCase()))
        : rawMembers).join(', ');
    const filter = Array.isArray(group.filters) && group.filters.length > 0 ? group.filters.join('|') : '';
    const tolerance = group.options?.tolerance;
    if (type === 'url-test') {
        const base = filter ? `${group.name} = url-test, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}, filter=${filter}` : `${group.name} = url-test, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}`;
        return tolerance ? `${base}, tolerance=${tolerance}` : base;
    }
    if (type === 'fallback') {
        const base = filter ? `${group.name} = fallback, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}, filter=${filter}` : `${group.name} = fallback, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}`;
        return tolerance ? `${base}, tolerance=${tolerance}` : base;
    }
    if (type === 'load-balance') {
        return filter ? `${group.name} = load-balance, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}, filter=${filter}` : `${group.name} = load-balance, ${members}`;
    }
    return `${group.name} = select, ${members}`;
}

function buildRuleLine(rule) {
    const type = String(rule.type || '').toUpperCase();
    if (!type) return null;
    if (type === 'RULE-SET') return null; // Remote rules moved to filter_remote
    if (type === 'MATCH' || type === 'FINAL') return `FINAL,${rule.policy}`;
    if (type === 'GEOIP') return `GEOIP,${rule.value || 'CN'},${rule.policy}`;
    return `${type},${rule.value},${rule.policy}`;
}

export function renderQuanxFromTemplateModel(model, options = {}) {
    const normalizedModel = normalizeUnifiedTemplateModel(model);
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(normalizedModel.proxies) && normalizedModel.proxies.length > 0
        ? normalizedModel.proxies
        : urlsToClashProxies(proxyUrls);

    // Extraction of remote rules for Quantumult X
    const remoteRules = normalizedModel.rules.filter(r => String(r.type).toUpperCase() === 'RULE-SET' && r.value.startsWith('http'));
    const filterRemoteLines = remoteRules.map(r => `${r.value}, tag=${r.policy}, policy=${r.policy}, enabled=true`);
    const localRules = normalizedModel.rules.filter(r => !remoteRules.includes(r));

    return [
        '[server_local]',
        ...proxies.map(buildProxyLine).filter(Boolean),
        '',
        '[policy]',
        ...normalizedModel.groups
            .filter(group => Array.isArray(group.members) && group.members.length > 0)
            .map(buildPolicyLine)
            .filter(Boolean),
        '',
        '[filter_remote]',
        ...filterRemoteLines,
        '',
        '[filter_local]',
        ...localRules.map(buildRuleLine).filter(Boolean),
        ''
    ].join('\n');
}
