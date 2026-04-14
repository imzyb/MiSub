import { generateNodeId } from '../id.js';
import { base64Encode } from './common/base64.js';

/**
 * 解析Quantumult X配置
 */
export function parseQuantumultXConfig(content) {
    const nodes = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.toLowerCase().startsWith('vmess')) {
            const node = parseQuantumultXVmess(trimmedLine);
            if (node) nodes.push(node);
        } else if (trimmedLine.toLowerCase().startsWith('vless')) {
            const node = parseQuantumultXVless(trimmedLine);
            if (node) nodes.push(node);
        } else if (trimmedLine.toLowerCase().startsWith('shadowsocks')) {
            const node = parseQuantumultXSS(trimmedLine);
            if (node) nodes.push(node);
        } else if (trimmedLine.toLowerCase().startsWith('trojan')) {
            const node = parseQuantumultXTrojan(trimmedLine);
            if (node) nodes.push(node);
        } else if (trimmedLine.toLowerCase().startsWith('hysteria2') || trimmedLine.toLowerCase().startsWith('hy2')) {
            const node = parseQuantumultXHysteria2(trimmedLine);
            if (node) nodes.push(node);
        } else if (trimmedLine.toLowerCase().startsWith('tuic')) {
            const node = parseQuantumultXTuic(trimmedLine);
            if (node) nodes.push(node);
        } else if (trimmedLine.toLowerCase().startsWith('anytls')) {
            const node = parseQuantumultXAnyTLS(trimmedLine);
            if (node) nodes.push(node);
        } else if (trimmedLine.toLowerCase().startsWith('http')) {
            const node = parseQuantumultXHTTP(trimmedLine);
            if (node) nodes.push(node);
        }
    }

    return nodes;
}

function parseServerPortToken(value) {
    const token = decodeURIComponent(value || '').trim();
    const lastColon = token.lastIndexOf(':');
    if (lastColon === -1) return null;
    return {
        server: token.slice(0, lastColon).trim(),
        port: token.slice(lastColon + 1).trim()
    };
}

function parseKeyValueParams(parts) {
    const map = new Map();
    parts.forEach(param => {
        const [key, ...rest] = param.split('=');
        if (!key || rest.length === 0) return;
        map.set(key.trim().toLowerCase(), rest.join('=').trim());
    });
    return map;
}

/**
 * 解析Quantumult X VMess配置
 */
function parseQuantumultXVmess(line) {
    try {
        const equalIndex = line.indexOf('=');
        if (equalIndex === -1) return null;

        const config = line.slice(equalIndex + 1);
        const params = config.split(',').map(p => p.trim());

        let name = '';
        let server = '';
        let port = '';
        let method = 'auto';
        let id = '';
        let aid = '0';
        let extra = [];

        if (params[0]?.includes(':')) {
            const serverPort = parseServerPortToken(params[0]);
            if (!serverPort) return null;
            const kv = parseKeyValueParams(params.slice(1));
            name = decodeURIComponent(kv.get('tag') || '');
            server = serverPort.server;
            port = serverPort.port;
            method = decodeURIComponent(kv.get('method') || 'auto');
            id = decodeURIComponent(kv.get('password') || '');
            aid = decodeURIComponent(kv.get('alterid') || '0');
            extra = params.slice(1);
        } else {
            if (params.length < 6) return null;
            const [rawName, rawServer, rawPort, rawMethod, rawId, rawAid, ...rest] = params;
            name = decodeURIComponent(rawName || '');
            server = decodeURIComponent(rawServer || '');
            port = decodeURIComponent(rawPort || '');
            method = decodeURIComponent(rawMethod || '');
            id = decodeURIComponent(rawId || '');
            aid = rawAid ? decodeURIComponent(rawAid) : '0';
            extra = rest;
        }

        if (!name || !server || !port || !id) return null;

        // 构建VMess配置
        const vmessConfig = {
            v: "2",
            ps: name.trim().replace(/"/g, ''),
            add: server.trim(),
            port: parseInt(port.trim()),
            id: id.trim(),
            aid: aid ? parseInt(aid.trim()) : 0,
            net: "tcp",
            type: "none",
            host: "",
            path: "",
            tls: ""
        };

        // 解析额外参数
        extra.forEach(param => {
            const [key, ...rest] = param.split('=');
            const value = rest.join('=').trim();
            if (key && value) {
                switch (key.toLowerCase()) {
                    case 'net':
                    case 'type':
                        vmessConfig.net = decodeURIComponent(value);
                        break;
                    case 'host':
                        vmessConfig.host = decodeURIComponent(value);
                        break;
                    case 'path':
                        vmessConfig.path = decodeURIComponent(value);
                        break;
                    case 'tls':
                    case 'over-tls':
                        vmessConfig.tls = value === 'true' ? 'true' : '';
                        break;
                    case 'obfs':
                        if (value.toLowerCase() === 'ws') vmessConfig.net = 'ws';
                        break;
                    case 'obfs-host':
                    case 'tls-host':
                        vmessConfig.host = decodeURIComponent(value);
                        break;
                    case 'obfs-uri':
                        vmessConfig.path = decodeURIComponent(value);
                        break;
                }
            }
        });

        return {
            id: generateNodeId(),
            name: vmessConfig.ps,
            url: `vmess://${base64Encode(JSON.stringify(vmessConfig))}`,
            enabled: true,
            protocol: 'vmess',
            source: 'quantumultx'
        };
    } catch (e) {
        return null;
    }
}

/**
 * 解析Quantumult X Shadowsocks配置
 */
function parseQuantumultXSS(line) {
    try {
        const equalIndex = line.indexOf('=');
        if (equalIndex === -1) return null;

        const config = line.slice(equalIndex + 1);
        const params = config.split(',').map(p => p.trim());

        let name = '';
        let server = '';
        let port = '';
        let method = '';
        let password = '';

        if (params[0]?.includes(':')) {
            const serverPort = parseServerPortToken(params[0]);
            if (!serverPort) return null;
            const kv = parseKeyValueParams(params.slice(1));
            name = decodeURIComponent(kv.get('tag') || '');
            server = serverPort.server;
            port = serverPort.port;
            method = decodeURIComponent(kv.get('method') || '');
            password = decodeURIComponent(kv.get('password') || '');
        } else {
            if (params.length < 5) return null;
            const [rawName, rawServer, rawPort, rawMethod, rawPassword] = params;
            name = decodeURIComponent(rawName || '');
            server = decodeURIComponent(rawServer || '');
            port = decodeURIComponent(rawPort || '');
            method = decodeURIComponent(rawMethod || '');
            password = decodeURIComponent(rawPassword || '');
        }

        if (!name || !server || !port || !method || !password) return null;

        const userinfo = base64Encode(`${method.trim()}:${password.trim()}`);

        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `ss://${userinfo}@${server.trim()}:${port.trim()}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'ss',
            source: 'quantumultx'
        };
    } catch (e) {
        return null;
    }
}

/**
 * 解析Quantumult X Trojan配置
 */
function parseQuantumultXTrojan(line) {
    try {
        const equalIndex = line.indexOf('=');
        if (equalIndex === -1) return null;

        const config = line.slice(equalIndex + 1);
        const params = config.split(',').map(p => p.trim());

        let name = '';
        let server = '';
        let port = '';
        let password = '';

        if (params[0]?.includes(':')) {
            const serverPort = parseServerPortToken(params[0]);
            if (!serverPort) return null;
            const kv = parseKeyValueParams(params.slice(1));
            name = decodeURIComponent(kv.get('tag') || '');
            server = serverPort.server;
            port = serverPort.port;
            password = decodeURIComponent(kv.get('password') || '');
        } else {
            if (params.length < 4) return null;
            const [rawName, rawServer, rawPort, rawPassword] = params;
            name = decodeURIComponent(rawName || '');
            server = decodeURIComponent(rawServer || '');
            port = decodeURIComponent(rawPort || '');
            password = decodeURIComponent(rawPassword || '');
        }

        if (!name || !server || !port || !password) return null;

        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `trojan://${encodeURIComponent(password.trim())}@${server.trim()}:${port.trim()}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'trojan',
            source: 'quantumultx'
        };
    } catch (e) {
        return null;
    }
}

function parseQuantumultXVless(line) {
    try {
        const equalIndex = line.indexOf('=');
        if (equalIndex === -1) return null;

        const config = line.slice(equalIndex + 1);
        const params = config.split(',').map(p => p.trim());
        let name = '';
        let server = '';
        let port = '';
        let uuid = '';
        let extra = [];

        if (params[0]?.includes(':')) {
            const serverPort = parseServerPortToken(params[0]);
            if (!serverPort) return null;
            const kv = parseKeyValueParams(params.slice(1));
            name = decodeURIComponent(kv.get('tag') || '');
            server = serverPort.server;
            port = serverPort.port;
            uuid = decodeURIComponent(kv.get('password') || '');
            extra = params.slice(1);
        } else {
            if (params.length < 4) return null;
            const [rawName, rawServer, rawPort, rawUuid, ...rest] = params;
            name = decodeURIComponent(rawName || '');
            server = decodeURIComponent(rawServer || '');
            port = decodeURIComponent(rawPort || '');
            uuid = decodeURIComponent(rawUuid || '');
            extra = rest;
        }
        if (!name || !server || !port || !uuid) return null;

        const urlParams = [];
        extra.forEach(param => {
            const [key, value] = param.split('=').map(p => p.trim());
            if (!key || !value) return;
            switch (key.toLowerCase()) {
                case 'transport':
                case 'type':
                    urlParams.push(`type=${encodeURIComponent(value)}`);
                    break;
                case 'path':
                    urlParams.push(`path=${encodeURIComponent(value)}`);
                    break;
                case 'host':
                case 'tls-host':
                case 'sni':
                    urlParams.push(`host=${encodeURIComponent(value)}`);
                    urlParams.push(`sni=${encodeURIComponent(value)}`);
                    break;
                case 'tls':
                case 'over-tls':
                    if (value === 'true') urlParams.push('security=tls');
                    break;
                case 'skip-cert-verify':
                case 'tls-verification':
                    if (value === 'true' || value === 'false') {
                        urlParams.push(`allowInsecure=${value === 'false' ? '1' : '0'}`);
                    }
                    break;
                case 'flow':
                    urlParams.push(`flow=${encodeURIComponent(value)}`);
                    break;
            }
        });

        const query = urlParams.length ? `?${Array.from(new Set(urlParams)).join('&')}` : '';

        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `vless://${uuid.trim()}@${server.trim()}:${port.trim()}${query}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'vless',
            source: 'quantumultx'
        };
    } catch {
        return null;
    }
}

function parseQuantumultXHysteria2(line) {
    try {
        const equalIndex = line.indexOf('=');
        if (equalIndex === -1) return null;
        const config = line.slice(equalIndex + 1);
        const params = config.split(',').map(p => p.trim());
        let name = '';
        let server = '';
        let port = '';
        let password = '';
        let extra = [];

        if (params[0]?.includes(':')) {
            const serverPort = parseServerPortToken(params[0]);
            if (!serverPort) return null;
            const kv = parseKeyValueParams(params.slice(1));
            name = decodeURIComponent(kv.get('tag') || '');
            server = serverPort.server;
            port = serverPort.port;
            password = decodeURIComponent(kv.get('password') || '');
            extra = params.slice(1);
        } else {
            if (params.length < 4) return null;
            const [rawName, rawServer, rawPort, rawPassword, ...rest] = params;
            name = decodeURIComponent(rawName || '');
            server = decodeURIComponent(rawServer || '');
            port = decodeURIComponent(rawPort || '');
            password = decodeURIComponent(rawPassword || '');
            extra = rest;
        }
        if (!name || !server || !port || !password) return null;

        const urlParams = [];
        extra.forEach(param => {
            const [key, value] = param.split('=').map(p => p.trim());
            if (!key || !value) return;
            if (key.toLowerCase() === 'sni' || key.toLowerCase() === 'peer') urlParams.push(`sni=${encodeURIComponent(value)}`);
            if (key.toLowerCase() === 'insecure' || key.toLowerCase() === 'tls-verification') urlParams.push(`insecure=${value === 'false' ? '1' : value}`);
        });

        const query = urlParams.length ? `?${urlParams.join('&')}` : '';
        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `hysteria2://${encodeURIComponent(password.trim())}@${server.trim()}:${port.trim()}${query}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'hysteria2',
            source: 'quantumultx'
        };
    } catch {
        return null;
    }
}

function parseQuantumultXTuic(line) {
    try {
        const equalIndex = line.indexOf('=');
        if (equalIndex === -1) return null;
        const config = line.slice(equalIndex + 1);
        const params = config.split(',').map(p => p.trim());
        let name = '';
        let server = '';
        let port = '';
        let uuid = '';
        let password = '';
        let extra = [];

        if (params[0]?.includes(':')) {
            const serverPort = parseServerPortToken(params[0]);
            if (!serverPort) return null;
            const kv = parseKeyValueParams(params.slice(1));
            name = decodeURIComponent(kv.get('tag') || '');
            server = serverPort.server;
            port = serverPort.port;
            uuid = decodeURIComponent(params[1] || '');
            password = decodeURIComponent(params[2] || '');
            extra = params.slice(3);
        } else {
            if (params.length < 4) return null;
            const [rawName, rawServer, rawPort, rawUuid, rawPassword, ...rest] = params;
            name = decodeURIComponent(rawName || '');
            server = decodeURIComponent(rawServer || '');
            port = decodeURIComponent(rawPort || '');
            uuid = decodeURIComponent(rawUuid || '');
            password = decodeURIComponent(rawPassword || '');
            extra = rest;
        }
        if (!name || !server || !port || !uuid) return null;

        const auth = password ? `${encodeURIComponent(uuid.trim())}:${encodeURIComponent(password.trim())}` : encodeURIComponent(uuid.trim());
        const urlParams = [];
        extra.forEach(param => {
            const [key, value] = param.split('=').map(p => p.trim());
            if (!key || !value) return;
            if (key.toLowerCase() === 'sni' || key.toLowerCase() === 'peer') urlParams.push(`sni=${encodeURIComponent(value)}`);
            if (key.toLowerCase() === 'congestion-controller') urlParams.push(`congestion_control=${encodeURIComponent(value)}`);
            if (key.toLowerCase() === 'udp-relay') urlParams.push(`udp_relay_mode=${encodeURIComponent(value)}`);
        });

        const query = urlParams.length ? `?${urlParams.join('&')}` : '';
        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `tuic://${auth}@${server.trim()}:${port.trim()}${query}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'tuic',
            source: 'quantumultx'
        };
    } catch {
        return null;
    }
}

function parseQuantumultXAnyTLS(line) {
    try {
        const equalIndex = line.indexOf('=');
        if (equalIndex === -1) return null;
        const config = line.slice(equalIndex + 1);
        const params = config.split(',').map(p => p.trim());
        let name = '';
        let server = '';
        let port = '';
        let extra = [];

        if (params[0]?.includes(':')) {
            const serverPort = parseServerPortToken(params[0]);
            if (!serverPort) return null;
            const kv = parseKeyValueParams(params.slice(1));
            name = decodeURIComponent(kv.get('tag') || '');
            server = serverPort.server;
            port = serverPort.port;
            extra = params.slice(1);
        } else {
            if (params.length < 3) return null;
            const [rawName, rawServer, rawPort, ...rest] = params;
            name = decodeURIComponent(rawName || '');
            server = decodeURIComponent(rawServer || '');
            port = decodeURIComponent(rawPort || '');
            extra = rest;
        }
        if (!name || !server || !port) return null;

        let password = '';
        const urlParams = [];
        extra.forEach(param => {
            const [key, value] = param.split('=').map(p => p.trim());
            if (!key || !value) return;
            switch (key.toLowerCase()) {
                case 'password':
                    password = decodeURIComponent(value);
                    break;
                case 'sni':
                case 'peer':
                    urlParams.push(`sni=${encodeURIComponent(value)}`);
                    break;
                case 'alpn':
                    urlParams.push(`alpn=${encodeURIComponent(value)}`);
                    break;
                case 'tls-verification':
                    if (value === 'false') urlParams.push('allowInsecure=1');
                    break;
            }
        });

        const query = urlParams.length ? `?${urlParams.join('&')}` : '';
        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `anytls://${encodeURIComponent(password.trim())}@${server.trim()}:${port.trim()}${query}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'anytls',
            source: 'quantumultx'
        };
    } catch {
        return null;
    }
}

/**
 * 解析Quantumult X HTTP配置
 */
function parseQuantumultXHTTP(line) {
    try {
        const equalIndex = line.indexOf('=');
        if (equalIndex === -1) return null;

        const config = line.slice(equalIndex + 1);
        const params = config.split(',').map(p => p.trim());

        if (params.length < 3) return null;

        const [rawName, rawServer, rawPort, rawUsername, rawPassword] = params;

        const name = decodeURIComponent(rawName || '');
        const server = decodeURIComponent(rawServer || '');
        const port = decodeURIComponent(rawPort || '');
        const username = rawUsername ? decodeURIComponent(rawUsername) : '';
        const password = rawPassword ? decodeURIComponent(rawPassword) : '';

        if (!name || !server || !port) return null;

        let userinfo = '';
        if (username && password) {
            userinfo = `${encodeURIComponent(username.trim())}:${encodeURIComponent(password.trim())}@`;
        }

        const scheme = line.trim().toLowerCase().startsWith('https') ? 'https' : 'http';

        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `${scheme}://${userinfo}${server.trim()}:${port.trim()}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: scheme,
            source: 'quantumultx'
        };
    } catch (e) {
        return null;
    }
}
