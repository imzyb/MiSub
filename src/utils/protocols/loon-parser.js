import { generateNodeId } from '../id.js';
import { base64Encode } from './common/base64.js';

export function parseLoonConfig(content) {
    const nodes = [];
    const lines = content.split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('[') || line.startsWith('#')) continue;

        const lower = line.toLowerCase();
        if (lower.includes(' = vmess,')) {
            const node = parseLoonVmess(line);
            if (node) nodes.push(node);
        } else if (lower.includes(' = shadowsocks,')) {
            const node = parseLoonSS(line);
            if (node) nodes.push(node);
        } else if (lower.includes(' = trojan,')) {
            const node = parseLoonTrojan(line);
            if (node) nodes.push(node);
        } else if (lower.includes(' = vless,')) {
            const node = parseLoonVless(line);
            if (node) nodes.push(node);
        } else if (lower.includes(' = http,')) {
            const node = parseLoonHttp(line);
            if (node) nodes.push(node);
        } else if (lower.includes(' = hysteria2,')) {
            const node = parseLoonHysteria2(line);
            if (node) nodes.push(node);
        } else if (lower.includes(' = tuic,')) {
            const node = parseLoonTuic(line);
            if (node) nodes.push(node);
        } else if (lower.includes(' = wireguard,')) {
            const node = parseLoonWireGuard(line);
            if (node) nodes.push(node);
        } else if (lower.includes(' = snell,')) {
            const node = parseLoonSnell(line);
            if (node) nodes.push(node);
        }
    }

    return nodes;
}

function parseNameAndParams(line) {
    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) return null;
    const name = line.slice(0, equalIndex).trim();
    const config = line.slice(equalIndex + 1).trim();
    const params = config.split(',').map(p => p.trim());
    return { name, params };
}

function parseExtraParams(extra) {
    const map = new Map();
    extra.forEach(param => {
        const [key, value] = param.split('=').map(p => p.trim());
        if (key && value !== undefined) map.set(key.toLowerCase(), value.replace(/^"|"$/g, ''));
    });
    return map;
}

function parseLoonVmess(line) {
    const parsed = parseNameAndParams(line);
    if (!parsed) return null;
    const [protocol, server, port, uuid, ...extra] = parsed.params;
    if (protocol.toLowerCase() !== 'vmess' || !server || !port || !uuid) return null;
    const options = parseExtraParams(extra);

    const config = {
        v: '2',
        ps: parsed.name,
        add: server,
        port: Number(port),
        id: uuid,
        aid: 0,
        net: options.get('transport') === 'ws' ? 'ws' : 'tcp',
        type: 'none',
        host: options.get('host') || '',
        path: options.get('path') || '',
        tls: options.get('tls') === 'true' ? 'tls' : ''
    };

    if (options.get('sni')) config.sni = options.get('sni');
    if (options.get('tls-cert-sha256')) config.fp = options.get('tls-cert-sha256');
    if (options.get('alpn')) config.alpn = options.get('alpn');

    return {
        id: generateNodeId(),
        name: parsed.name,
        url: `vmess://${base64Encode(JSON.stringify(config))}`,
        enabled: true,
        protocol: 'vmess',
        source: 'loon'
    };
}

function parseLoonSS(line) {
    const parsed = parseNameAndParams(line);
    if (!parsed) return null;
    const [protocol, server, port, method, password] = parsed.params;
    if (protocol.toLowerCase() !== 'shadowsocks' || !server || !port || !method || !password) return null;
    return {
        id: generateNodeId(),
        name: parsed.name,
        url: `ss://${base64Encode(`${method}:${password}`)}@${server}:${port}#${encodeURIComponent(parsed.name)}`,
        enabled: true,
        protocol: 'ss',
        source: 'loon'
    };
}

function parseLoonTrojan(line) {
    const parsed = parseNameAndParams(line);
    if (!parsed) return null;
    const [protocol, server, port, password, ...extra] = parsed.params;
    if (protocol.toLowerCase() !== 'trojan' || !server || !port || !password) return null;
    const options = parseExtraParams(extra);
    const urlParams = [];
    if (options.get('sni')) urlParams.push(`sni=${encodeURIComponent(options.get('sni'))}`);
    if (options.get('transport') === 'ws') urlParams.push('type=ws');
    if (options.get('path')) urlParams.push(`path=${encodeURIComponent(options.get('path'))}`);
    if (options.get('host')) urlParams.push(`host=${encodeURIComponent(options.get('host'))}`);
    if (options.get('skip-cert-verify') === 'true') urlParams.push('allowInsecure=1');
    const query = urlParams.length ? `?${urlParams.join('&')}` : '';
    return {
        id: generateNodeId(),
        name: parsed.name,
        url: `trojan://${encodeURIComponent(password)}@${server}:${port}${query}#${encodeURIComponent(parsed.name)}`,
        enabled: true,
        protocol: 'trojan',
        source: 'loon'
    };
}

function parseLoonVless(line) {
    const parsed = parseNameAndParams(line);
    if (!parsed) return null;
    const [protocol, server, port, uuid, ...extra] = parsed.params;
    if (protocol.toLowerCase() !== 'vless' || !server || !port || !uuid) return null;
    const options = parseExtraParams(extra);
    const urlParams = [];
    if (options.get('transport')) urlParams.push(`type=${encodeURIComponent(options.get('transport'))}`);
    if (options.get('path')) urlParams.push(`path=${encodeURIComponent(options.get('path'))}`);
    if (options.get('host')) urlParams.push(`host=${encodeURIComponent(options.get('host'))}`);
    if (options.get('sni')) urlParams.push(`sni=${encodeURIComponent(options.get('sni'))}`);
    if (options.get('tls') === 'true') urlParams.push('security=tls');
    if (options.get('flow')) urlParams.push(`flow=${encodeURIComponent(options.get('flow'))}`);
    if (options.get('grpc-service-name')) urlParams.push(`serviceName=${encodeURIComponent(options.get('grpc-service-name'))}`);
    if (options.get('mode')) urlParams.push(`mode=${encodeURIComponent(options.get('mode'))}`);
    if (options.get('transport') === 'xhttp' && options.get('host')) urlParams.push(`xhttp-host=${encodeURIComponent(options.get('host'))}`);
    if (options.get('transport') === 'xhttp' && options.get('path')) urlParams.push(`xhttp-path=${encodeURIComponent(options.get('path'))}`);
    if (options.get('reality') === 'true') urlParams.push('security=reality');
    if (options.get('public-key')) urlParams.push(`pbk=${encodeURIComponent(options.get('public-key'))}`);
    if (options.get('short-id')) urlParams.push(`sid=${encodeURIComponent(options.get('short-id'))}`);
    if (options.get('alpn')) urlParams.push(`alpn=${encodeURIComponent(options.get('alpn'))}`);
    if (options.get('fp')) urlParams.push(`fp=${encodeURIComponent(options.get('fp'))}`);
    if (options.get('skip-cert-verify') === 'true') urlParams.push('allowInsecure=1');
    const query = urlParams.length ? `?${urlParams.join('&')}` : '';
    return {
        id: generateNodeId(),
        name: parsed.name,
        url: `vless://${uuid}@${server}:${port}${query}#${encodeURIComponent(parsed.name)}`,
        enabled: true,
        protocol: 'vless',
        source: 'loon'
    };
}

function parseLoonHttp(line) {
    const parsed = parseNameAndParams(line);
    if (!parsed) return null;
    const [protocol, server, port, username, password] = parsed.params;
    if (protocol.toLowerCase() !== 'http' || !server || !port) return null;
    const auth = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
    return {
        id: generateNodeId(),
        name: parsed.name,
        url: `http://${auth}${server}:${port}#${encodeURIComponent(parsed.name)}`,
        enabled: true,
        protocol: 'http',
        source: 'loon'
    };
}

function parseLoonHysteria2(line) {
    const parsed = parseNameAndParams(line);
    if (!parsed) return null;
    const [protocol, server, port, password, ...extra] = parsed.params;
    if (protocol.toLowerCase() !== 'hysteria2' || !server || !port || !password) return null;
    const options = parseExtraParams(extra);
    const urlParams = [];
    if (options.get('sni')) urlParams.push(`sni=${encodeURIComponent(options.get('sni'))}`);
    if (options.get('skip-cert-verify') === 'true') urlParams.push('insecure=1');
    const query = urlParams.length ? `?${urlParams.join('&')}` : '';
    return {
        id: generateNodeId(),
        name: parsed.name,
        url: `hysteria2://${encodeURIComponent(password)}@${server}:${port}${query}#${encodeURIComponent(parsed.name)}`,
        enabled: true,
        protocol: 'hysteria2',
        source: 'loon'
    };
}

function parseLoonTuic(line) {
    const parsed = parseNameAndParams(line);
    if (!parsed) return null;
    const [protocol, server, port, tokenOrUuid, ...extra] = parsed.params;
    if (protocol.toLowerCase() !== 'tuic' || !server || !port || !tokenOrUuid) return null;
    const options = parseExtraParams(extra);
    const auth = options.get('password') ? `${encodeURIComponent(tokenOrUuid)}:${encodeURIComponent(options.get('password'))}` : encodeURIComponent(tokenOrUuid);
    const urlParams = [];
    if (options.get('sni')) urlParams.push(`sni=${encodeURIComponent(options.get('sni'))}`);
    const query = urlParams.length ? `?${urlParams.join('&')}` : '';
    return {
        id: generateNodeId(),
        name: parsed.name,
        url: `tuic://${auth}@${server}:${port}${query}#${encodeURIComponent(parsed.name)}`,
        enabled: true,
        protocol: 'tuic',
        source: 'loon'
    };
}

function parseLoonWireGuard(line) {
    const parsed = parseNameAndParams(line);
    if (!parsed) return null;
    const [protocol, server, port, privateKey, ...extra] = parsed.params;
    if (protocol.toLowerCase() !== 'wireguard' || !server || !port || !privateKey) return null;
    const options = parseExtraParams(extra);
    const urlParams = [];
    if (options.get('public-key')) urlParams.push(`publickey=${encodeURIComponent(options.get('public-key'))}`);
    if (options.get('self-ip')) urlParams.push(`address=${encodeURIComponent(options.get('self-ip'))}`);
    if (options.get('client-id')) urlParams.push(`reserved=${encodeURIComponent(options.get('client-id').replace(/\//g, ','))}`);
    const query = urlParams.length ? `?${urlParams.join('&')}` : '';
    return {
        id: generateNodeId(),
        name: parsed.name,
        url: `wireguard://${encodeURIComponent(privateKey)}@${server}:${port}${query}#${encodeURIComponent(parsed.name)}`,
        enabled: true,
        protocol: 'wireguard',
        source: 'loon'
    };
}

function parseLoonSnell(line) {
    const parsed = parseNameAndParams(line);
    if (!parsed) return null;
    const [protocol, server, port, psk] = parsed.params;
    if (protocol.toLowerCase() !== 'snell' || !server || !port || !psk) return null;
    return {
        id: generateNodeId(),
        name: parsed.name,
        url: `snell://${encodeURIComponent(psk)}@${server}:${port}#${encodeURIComponent(parsed.name)}`,
        enabled: true,
        protocol: 'snell',
        source: 'loon'
    };
}
