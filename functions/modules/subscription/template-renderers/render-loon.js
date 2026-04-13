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
        if (proxy.network === 'ws') {
            extras.push('transport=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`host=${wsOpts.headers.Host}`);
        }
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('skip-cert-verify=true');
        return `${name} = trojan, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'ss' || type === 'shadowsocks') return `${name} = Shadowsocks, ${server}, ${port}, ${proxy.cipher || 'aes-128-gcm'}, ${proxy.password || ''}`;
    if (type === 'vmess') {
        const extras = [proxy.uuid || ''];
        const sni = proxy.servername ?? proxy.sni;
        if (proxy.tls || sni !== undefined) extras.push('tls=true');
        if (proxy.network === 'ws') {
            extras.push('transport=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`host=${wsOpts.headers.Host}`);
        }
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('skip-cert-verify=true');
        return `${name} = vmess, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'vless') {
        const extras = [proxy.uuid || ''];
        if (proxy.network) extras.push(`transport=${proxy.network}`);
        if (proxy.network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            if (grpcOpts?.['grpc-service-name']) extras.push(`grpc-service-name=${grpcOpts['grpc-service-name']}`);
        }
        if (proxy.flow) extras.push(`flow=${proxy.flow}`);
        const sni = proxy.servername ?? proxy.sni;
        if (proxy.tls || sni !== undefined) extras.push('tls=true');
        const realityOpts = proxy['reality-opts'] || proxy.realityOpts;
        if (realityOpts) {
            extras.push('reality=true');
            if (realityOpts['public-key']) extras.push(`public-key=${realityOpts['public-key']}`);
            if (realityOpts['short-id']) extras.push(`short-id=${realityOpts['short-id']}`);
        }
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('skip-cert-verify=true');
        return `${name} = vless, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'hysteria2' || type === 'hy2') return `${name} = hysteria2, ${server}, ${port}, ${proxy.password || ''}`;
    if (type === 'tuic') {
        const extras = ['version=5'];
        
        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);
        
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) extras.push('skip-cert-verify=true');
        
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            extras.push(`alpn=${alpn}`);
        }
        
        // 拥塞控制 (Loon 标准写法是 congestion-control)
        const cg = proxy['congestion-control'] || proxy['congestion-controller'] || 'bbr';
        extras.push(`congestion-control=${cg}`);
        
        if (proxy['udp-relay-mode']) extras.push(`udp-relay-mode=${proxy['udp-relay-mode']}`);
        
        // 性能优化参数
        extras.push('reduce-rtt=true');
        if (proxy['fast-open']) extras.push('fast-open=true');
        
        // Loon TUIC 语法: Name = tuic, Server, Port, Password, UUID, key=value, ...
        return `${name} = tuic, ${server}, ${port}, ${proxy.password || ''}, ${proxy.uuid || ''}, ${extras.join(', ')}`;
    }
    if (type === 'wireguard') {
        const extras = [proxy['private-key'] || ''];
        if (proxy['public-key']) extras.push(`public-key=${proxy['public-key']}`);
        if (proxy.ip) {
            const ip = Array.isArray(proxy.ip) ? proxy.ip[0] : proxy.ip;
            extras.push(`self-ip=${ip}`);
        }
        if (proxy.reserved) {
            const reserved = Array.isArray(proxy.reserved) ? proxy.reserved.join('/') : proxy.reserved;
            extras.push(`client-id=${reserved}`);
        }
        return `${name} = wireguard, ${server}, ${port}, ${extras.join(', ')}`;
    }
    return null;
}

function buildGroupLine(group) {
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
        return filter ? `${group.name} = load-balance, ${members}, filter=${filter}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}` : `${group.name} = load-balance, ${members}`;
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

export function renderLoonFromTemplateModel(model, options = {}) {
    const normalizedModel = normalizeUnifiedTemplateModel(model);
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(normalizedModel.proxies) && normalizedModel.proxies.length > 0
        ? normalizedModel.proxies
        : urlsToClashProxies(proxyUrls);

    return [
        '[Proxy]',
        ...proxies.map(buildProxyLine).filter(Boolean),
        '',
        '[Proxy Group]',
        ...normalizedModel.groups
            .filter(group => Array.isArray(group.members) && group.members.length > 0)
            .map(buildGroupLine)
            .filter(Boolean),
        '',
        '[Rule]',
        ...normalizedModel.rules.map(buildRuleLine).filter(Boolean),
        ''
    ].join('\n');
}
