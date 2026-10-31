import { urlsToClashProxies } from '../../../utils/url-to-clash.js';
import { normalizeUnifiedTemplateModel } from '../template-model.js';

function buildProxyLine(proxy) {
    const type = String(proxy.type || '').toLowerCase();
    const name = proxy.name || 'Untitled';
    const server = proxy.server;
    const port = proxy.port;
    if (!server || !port) return null;

    const sni = proxy.servername ?? proxy.sni;

    if (type === 'trojan') {
        const extras = [proxy.password || ''];
        if (proxy.network === 'ws') {
            extras.push('transport=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`host=${wsOpts.headers.Host}`);
        }
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true)
            extras.push('skip-cert-verify=true');
        return `${name} = trojan, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'ss' || type === 'shadowsocks') {
        const extras = [];
        const plugin = proxy.plugin || '';
        const opts = proxy['plugin-opts'] || proxy.pluginOpts || {};
        if (plugin === 'obfs-local' || proxy.obfs) {
            extras.push(`obfs-name=${proxy.obfs || opts.mode}`);
            const host = proxy['obfs-host'] || opts.host;
            if (host) extras.push(`obfs-host=${host}`);
            const uri = proxy['obfs-uri'] || opts.uri;
            if (uri) extras.push(`obfs-uri=${uri}`);
        } else if (plugin === 'v2ray-plugin' || opts.mode === 'websocket') {
            extras.push('transport=ws');
            if (opts.path) extras.push(`path=${opts.path}`);
            if (opts.host) extras.push(`host=${opts.host}`);
            if (opts.tls || opts.mode === 'websocket-tls') extras.push('over-tls=true');
        }
        if (proxy.udp) extras.push('udp-relay=true');
        return `${name} = Shadowsocks, ${server}, ${port}, ${proxy.cipher || 'aes-128-gcm'}, ${proxy.password || ''}${extras.length ? `, ${extras.join(', ')}` : ''}`;
    }
    if (type === 'vmess') {
        const cipher = proxy.cipher || 'auto';
        const uuid = `"${proxy.uuid || ''}"`;
        const alterId = proxy.alterId || 0;
        const extras = [];

        if (proxy.tls || sni !== undefined) extras.push('over-tls=true');
        if (proxy.network === 'ws') {
            extras.push('transport=ws');
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`host=${wsOpts.headers.Host}`);
        }
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true)
            extras.push('skip-cert-verify=true');

        const extraStr = extras.length > 0 ? `, ${extras.join(', ')}` : '';
        return `${name} = vmess, ${server}, ${port}, ${cipher}, ${uuid}, ${alterId}${extraStr}`;
    }
    if (type === 'vless') {
        const extras = [proxy.uuid || ''];
        if (proxy.network) extras.push(`transport=${proxy.network}`);
        if (proxy.network === 'ws') {
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            if (wsOpts?.path) extras.push(`path=${wsOpts.path}`);
            if (wsOpts?.headers?.Host) extras.push(`host=${wsOpts.headers.Host}`);
        }
        if (proxy.network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            if (grpcOpts?.['grpc-service-name'])
                extras.push(`grpc-service-name=${grpcOpts['grpc-service-name']}`);
        }
        if (proxy.flow) extras.push(`flow=${proxy.flow}`);
        if (proxy.tls || sni !== undefined) extras.push('over-tls=true');
        const realityOpts = proxy['reality-opts'] || proxy.realityOpts;
        if (realityOpts) {
            extras.push('reality=true');
            if (realityOpts['public-key']) extras.push(`public-key=${realityOpts['public-key']}`);
            if (realityOpts['short-id']) extras.push(`short-id=${realityOpts['short-id']}`);
        }
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true)
            extras.push('skip-cert-verify=true');
        return `${name} = vless, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'hysteria2' || type === 'hy2') {
        const extras = [proxy.password || ''];
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true)
            extras.push('skip-cert-verify=true');
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            if (alpn) extras.push(`alpn=${alpn}`);
        }
        return `${name} = hysteria2, ${server}, ${port}, ${extras.join(', ')}`;
    }
    if (type === 'tuic') {
        const extras = ['version=5'];

        const sni = proxy.servername ?? proxy.sni;
        if (sni !== undefined) extras.push(`sni=${sni}`);

        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true)
            extras.push('skip-cert-verify=true');

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
    // if (type === 'wireguard') {
    //     const extras = [proxy['private-key'] || ''];
    //     if (proxy['public-key']) extras.push(`public-key=${proxy['public-key']}`);
    //     if (proxy.ip) {
    //         const ip = Array.isArray(proxy.ip) ? proxy.ip[0] : proxy.ip;
    //         extras.push(`self-ip=${ip}`);
    //     }
    //     if (proxy.reserved) {
    //         const reserved = Array.isArray(proxy.reserved) ? proxy.reserved.join('/') : proxy.reserved;
    //         extras.push(`client-id=${reserved}`);
    //     }
    //     return `${name} = wireguard, ${server}, ${port}, ${extras.join(', ')}`;
    // }
    if (type === 'wireguard') {
        if (!proxy['private-key'] || !proxy['public-key']) {
            return null;
        }
        const extras = [];
        // IPv4
        if (proxy.ip) {
            const ipv4 = Array.isArray(proxy.ip)
                ? proxy.ip.find((ip) => !String(ip).includes(':'))
                : proxy.ip;

            if (ipv4) {
                extras.push(`interface-ip=${ipv4}`);
            }
        }

        // IPv6
        if (proxy.ipv6) {
            const ipv6 = Array.isArray(proxy.ipv6) ? proxy.ipv6.find(Boolean) : proxy.ipv6;

            if (ipv6) {
                extras.push(`interface-ipV6=${ipv6}`);
            }
        }

        // Private Key
        extras.push(`private-key="${proxy['private-key']}"`);

        // MTU
        if (proxy.mtu) {
            extras.push(`mtu=${proxy.mtu}`);
        }

        // DNS
        if (proxy.dns) {
            const dnsList = Array.isArray(proxy.dns) ? proxy.dns.filter(Boolean) : [proxy.dns];

            const dns4 = dnsList.find((dns) => !String(dns).includes(':'));
            const dns6 = dnsList.find((dns) => String(dns).includes(':'));

            if (dns4) {
                extras.push(`dns=${dns4}`);
            }

            if (dns6) {
                extras.push(`dnsV6=${dns6}`);
            }
        }

        // Peer
        const peer = [];

        peer.push(`public-key="${proxy['public-key']}"`);

        if (proxy['preshared-key']) {
            peer.push(`preshared-key="${proxy['preshared-key']}"`);
        }

        if (proxy.reserved) {
            const reserved = Array.isArray(proxy.reserved)
                ? proxy.reserved
                : String(proxy.reserved)
                      .split(/[\/,]/)
                      .map((v) => Number(v.trim()))
                      .filter(Number.isFinite);

            if (reserved.length) {
                peer.push(`reserved=[${reserved.join(',')}]`);
            }
        }

        if (proxy['allowed-ips']) {
            const allowedIps = Array.isArray(proxy['allowed-ips'])
                ? proxy['allowed-ips'].join(', ')
                : proxy['allowed-ips'];

            peer.push(`allowed-ips="${allowedIps}"`);
        } else {
            peer.push(proxy.ipv6 ? 'allowed-ips="0.0.0.0/0, ::/0"' : 'allowed-ips="0.0.0.0/0"');
        }

        // IPv6 endpoint 加 []
        const endpointHost =
            String(server).includes(':') && !String(server).startsWith('[')
                ? `[${server}]`
                : server;

        peer.push(`endpoint=${endpointHost}:${port}`);

        extras.push(`peers=[{${peer.join(',')}}]`);

        return `${name} = wireguard,${extras.join(',')}`;
    }
    if (type === 'anytls') {
        const extras = [proxy.password || ''];
        if (sni !== undefined) extras.push(`sni=${sni}`);
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            if (alpn) extras.push(`alpn=${alpn}`);
        }
        if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true)
            extras.push('skip-cert-verify=true');
        return `${name} = anytls, ${server}, ${port}, ${extras.join(', ')}`;
    }
    return null;
}

function buildGroupLine(group) {
    const type = String(group.type || 'select').toLowerCase();
    const rawMembers = Array.isArray(group.members) ? group.members.filter(Boolean) : [];
    const members = (
        ['url-test', 'fallback', 'load-balance'].includes(type)
            ? rawMembers.filter(
                  (member) =>
                      !['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'].includes(
                          String(member).toUpperCase()
                      )
              )
            : rawMembers
    ).join(', ');
    const filter =
        Array.isArray(group.filters) && group.filters.length > 0 ? group.filters.join('|') : '';
    const tolerance = group.options?.tolerance;
    if (type === 'url-test') {
        const base = filter
            ? `${group.name} = url-test, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}, filter=${filter}`
            : `${group.name} = url-test, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}`;
        return tolerance ? `${base}, tolerance=${tolerance}` : base;
    }
    if (type === 'fallback') {
        const base = filter
            ? `${group.name} = fallback, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}, filter=${filter}`
            : `${group.name} = fallback, ${members}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}`;
        return tolerance ? `${base}, tolerance=${tolerance}` : base;
    }
    if (type === 'load-balance') {
        return filter
            ? `${group.name} = load-balance, ${members}, filter=${filter}, url=${group.options?.url || 'http://www.gstatic.com/generate_204'}, interval=${group.options?.interval || 300}`
            : `${group.name} = load-balance, ${members}`;
    }
    return `${group.name} = select, ${members}`;
}

// function buildRuleLine(rule) {
//     const type = String(rule.type || '').toUpperCase();
//     if (!type) return null;
//     if (type === 'RULE-SET') return `RULE-SET,${rule.value},${rule.policy}`;
//     if (type === 'MATCH' || type === 'FINAL') return `FINAL,${rule.policy}`;
//     if (type === 'GEOIP') return `GEOIP,${rule.value || 'CN'},${rule.policy}`;
//     return `${type},${rule.value},${rule.policy}`;
// }
function buildRuleLine(rule) {
    const type = String(rule.type || '').toUpperCase();
    if (!type || type === 'RULE-SET') return null;
    if (type === 'MATCH' || type === 'FINAL') {
        return `FINAL,${rule.policy}`;
    }
    if (type === 'GEOIP') {
        return `GEOIP,${rule.value || 'CN'},${rule.policy}`;
    }
    return `${type},${rule.value},${rule.policy}`;
}

function buildRemoteRuleLine(rule) {
    const type = String(rule.type || '').toUpperCase();
    if (type !== 'RULE-SET') return null;
    if (!rule.value || !rule.policy) return null;
    return `${rule.value}, policy=${rule.policy}, enabled=true`;
}

export function renderLoonFromTemplateModel(model, options = {}) {
    const normalizedModel = normalizeUnifiedTemplateModel(model);
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const proxies =
        Array.isArray(normalizedModel.proxies) && normalizedModel.proxies.length > 0
            ? normalizedModel.proxies
            : urlsToClashProxies(proxyUrls);
    const ruleLines = normalizedModel.rules
        .filter((rule) => String(rule.type || '').toUpperCase() !== 'RULE-SET')
        .map(buildRuleLine)
        .filter(Boolean);

    const remoteRuleLines = normalizedModel.rules
        .filter(
            (rule) =>
                rule.source === 'remote' || String(rule.type || '').toUpperCase() === 'RULE-SET'
        )
        .map(buildRemoteRuleLine)
        .filter(Boolean);

    return [
        '[General]',
        'ip-mode = ipv4-preferred',
        'dns-server = 223.5.5.5, 119.29.29.29',
        'doh-server = https://223.5.5.5/resolve,https://sm2.doh.pub/dns-query',
        'skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local, elpass.app, e.crashlytics.com, captive.apple.com, ::ffff:0:0:0:0/1, ::ffff:128:0:0:0/1, fe80::/10, fc00::/7, ::1/128',
        'bypass-tun = 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10',
        'interface-mode = auto',
        'disable-stun = true',
        'allow-udp-proxy = true',
        'allow-wifi-access = false',
        'wifi-access-http-port = 7222',
        'wifi-access-socks5-port = 7221',
        'resource-parser = https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store-parser.loon.min.js',
        'geoip-url = https://gitlab.com/Masaiki/GeoIP2-CN/-/raw/release/Country.mmdb',
        'proxy-test-url = http://www.gstatic.com/generate_204',
        'internet-test-url = http://www.apple.com/library/test/success.html',

        '',
        '[Proxy]',
        ...proxies.map(buildProxyLine).filter(Boolean),
        '',
        '[Proxy Group]',
        ...normalizedModel.groups
            .filter((group) => Array.isArray(group.members) && group.members.length > 0)
            .map(buildGroupLine)
            .filter(Boolean),
        '',
        '[Rule]',
        ...ruleLines,
        '',
        '[Remote Rule]',
        // ...normalizedModel.rules.map(buildRuleLine).filter(Boolean),
        ...remoteRuleLines,
        '',
    ].join('\n');
}
