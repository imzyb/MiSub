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
        } else if (trimmedLine.toLowerCase().startsWith('shadowsocks')) {
            const node = parseQuantumultXSS(trimmedLine);
            if (node) nodes.push(node);
        } else if (trimmedLine.toLowerCase().startsWith('trojan')) {
            const node = parseQuantumultXTrojan(trimmedLine);
            if (node) nodes.push(node);
        } else if (trimmedLine.toLowerCase().startsWith('http')) {
            const node = parseQuantumultXHTTP(trimmedLine);
            if (node) nodes.push(node);
        }
    }

    return nodes;
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

        if (params.length < 6) return null;

        const [name, server, port, method, id, aid, ...extra] = params;

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
            const [key, value] = param.split('=').map(p => p.trim());
            if (key && value) {
                switch (key.toLowerCase()) {
                    case 'net':
                    case 'type':
                    case 'host':
                    case 'path':
                    case 'tls':
                    case 'cipher':
                        vmessConfig[key.toLowerCase()] = value;
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

        if (params.length < 5) return null;

        const [name, server, port, method, password, ...extra] = params;

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

        if (params.length < 4) return null;

        const [name, server, port, password, ...extra] = params;

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

        const [name, server, port, username, password] = params;

        if (!name || !server || !port) return null;

        let userinfo = '';
        if (username && password) {
            userinfo = `${encodeURIComponent(username.trim())}:${encodeURIComponent(password.trim())}@`;
        }

        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `http://${userinfo}${server.trim()}:${port.trim()}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'http',
            source: 'quantumultx'
        };
    } catch (e) {
        return null;
    }
}
