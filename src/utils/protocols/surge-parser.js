import { generateNodeId } from '../id.js';
import { base64Encode } from './common/base64.js';

/**
 * 解析Surge配置
 */
export function parseSurgeConfig(content) {
    const nodes = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lowerLine = line.toLowerCase();
        const equalIndex = line.indexOf('=');
        const valuePrefix = equalIndex !== -1
            ? line.slice(equalIndex + 1).split(',')[0].trim().toLowerCase()
            : '';

        // 匹配代理规则
        if (lowerLine.startsWith('[proxy]') || lowerLine.startsWith('[proxies]')) {
            // Surge代理配置
            continue;
        }

        // 解析不同类型的代理
        if (lowerLine.startsWith('vmess') || valuePrefix === 'vmess') {
            const node = parseSurgeVmess(line);
            if (node) nodes.push(node);
        } else if (lowerLine.startsWith('ss') || valuePrefix === 'ss') {
            const node = parseSurgeSS(line);
            if (node) nodes.push(node);
        } else if (lowerLine.startsWith('trojan') || valuePrefix === 'trojan') {
            const node = parseSurgeTrojan(line);
            if (node) nodes.push(node);
        } else if (
            lowerLine.startsWith('http-proxy') ||
            lowerLine.startsWith('https-proxy') ||
            valuePrefix === 'http-proxy' ||
            valuePrefix === 'https-proxy'
        ) {
            const node = parseSurgeHTTP(line);
            if (node) nodes.push(node);
        } else if (lowerLine.startsWith('snell') || valuePrefix === 'snell') {
            const node = parseSurgeSnell(line);
            if (node) nodes.push(node);
        }
    }

    return nodes;
}

/**
 * 解析Surge VMess配置
 * 格式: name = vmess, server, port, username=uuid, [其他参数...]
 */
function parseSurgeVmess(line) {
    try {
        const parts = line.match(/^([^=]+?)\s*=\s*(.+)$/);
        if (!parts) return null;

        const name = parts[1].trim();
        const config = parts[2];
        const params = config.split(',').map(p => p.trim());

        if (params.length < 4) return null;

        const [protocol, server, port, ...options] = params;

        if (protocol.toLowerCase() !== 'vmess' || !server || !port) return null;

        // 解析 VMess 参数
        const vmessConfig = {
            v: "2",
            ps: name,
            add: server,
            port: parseInt(port),
            id: '',
            aid: 0,
            net: 'tcp',
            type: 'none',
            host: '',
            path: '',
            tls: ''
        };

        // 解析选项参数
        options.forEach(opt => {
            const match = opt.match(/^(\w+(?:-\w+)*)\s*=\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                const cleanValue = value.replace(/^["']|["']$/g, '');

                switch (key.toLowerCase()) {
                    case 'username':
                    case 'uuid':
                    case 'id':
                        vmessConfig.id = cleanValue;
                        break;
                    case 'alterid':
                    case 'aid':
                        vmessConfig.aid = parseInt(cleanValue);
                        break;
                    case 'network':
                    case 'net':
                        vmessConfig.net = cleanValue;
                        break;
                    case 'ws-path':
                    case 'path':
                        vmessConfig.path = cleanValue;
                        break;
                    case 'ws-headers':
                    case 'host':
                        vmessConfig.host = cleanValue;
                        break;
                    case 'tls':
                        vmessConfig.tls = cleanValue === 'true' ? 'tls' : '';
                        break;
                }
            }
        });

        if (!vmessConfig.id) return null;

        const url = `vmess://${base64Encode(JSON.stringify(vmessConfig))}`;

        return {
            id: generateNodeId(),
            name: name,
            url: url,
            enabled: true,
            protocol: 'vmess',
            source: 'surge'
        };
    } catch (e) {
        console.error('Surge VMess 解析失败:', e);
        return null;
    }
}

/**
 * 解析Surge Shadowsocks配置
 */
function parseSurgeSS(line) {
    try {
        const parts = line.match(/^([^=]+?)\s*=\s*(.+)$/);
        if (!parts) return null;

        const params = parts[2].split(',').map(p => p.trim());
        const [name, server, port, method, password] = params;

        if (!name || !server || !port || !method || !password) return null;

        const userinfo = base64Encode(`${method}:${password}`);
        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `ss://${userinfo}@${server}:${port}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'ss',
            source: 'surge'
        };
    } catch (e) {
        return null;
    }
}

/**
 * 解析Surge Trojan配置
 */
function parseSurgeTrojan(line) {
    try {
        const parts = line.match(/^([^=]+?)\s*=\s*(.+)$/);
        if (!parts) return null;

        const params = parts[2].split(',').map(p => p.trim());
        const [name, server, port, password] = params;

        if (!name || !server || !port || !password) return null;

        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `trojan://${encodeURIComponent(password)}@${server}:${port}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'trojan',
            source: 'surge'
        };
    } catch (e) {
        return null;
    }
}

/**
 * 解析Surge HTTP/HTTPS代理配置
 */
function parseSurgeHTTP(line) {
    try {
        const parts = line.match(/^([^=]+?)\s*=\s*(.+)$/);
        if (!parts) return null;

        const params = parts[2].split(',').map(p => p.trim());
        const [name, server, port] = params;

        if (!name || !server || !port) return null;

        const isHTTPS = line.toLowerCase().startsWith('https-proxy');
        const protocol = isHTTPS ? 'https' : 'http';

        return {
            id: generateNodeId(),
            name: name.trim().replace(/"/g, ''),
            url: `${protocol}://${server}:${port}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: protocol,
            source: 'surge'
        };
    } catch (e) {
        return null;
    }
}

/**
 * 解析 Surge Snell 配置
 * 格式: name = snell, server, port, psk=xxx, version=5, obfs=http, obfs-host=example.com, reuse=true, tfo=true
 */
function parseSurgeSnell(line) {
    try {
        const parts = line.match(/^([^=]+?)\s*=\s*(.+)$/);
        if (!parts) return null;

        const name = parts[1].trim();
        const config = parts[2];
        const params = config.split(',').map(p => p.trim());

        if (params.length < 4) return null;

        const [protocol, server, port, ...options] = params;

        if (protocol.toLowerCase() !== 'snell' || !server || !port) return null;

        // 解析选项参数
        const proxy = {
            server: server,
            port: parseInt(port),
            psk: '',
            version: 4,  // 默认版本
            reuse: true,
            tfo: false
        };

        // 解析键值对参数
        options.forEach(opt => {
            const match = opt.match(/^(\w+(?:-\w+)*)\s*=\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                const cleanValue = value.replace(/^["']|["']$/g, '');

                switch (key.toLowerCase()) {
                    case 'psk':
                        proxy.psk = cleanValue;
                        break;
                    case 'version':
                        proxy.version = parseInt(cleanValue);
                        break;
                    case 'obfs':
                        if (!proxy['obfs-opts']) proxy['obfs-opts'] = {};
                        proxy['obfs-opts'].mode = cleanValue;
                        break;
                    case 'obfs-host':
                        if (!proxy['obfs-opts']) proxy['obfs-opts'] = {};
                        proxy['obfs-opts'].host = cleanValue;
                        break;
                    case 'reuse':
                        proxy.reuse = cleanValue === 'true';
                        break;
                    case 'tfo':
                        proxy.tfo = cleanValue === 'true';
                        break;
                }
            }
        });

        if (!proxy.psk) return null;

        // 构建 Snell URL
        const urlParams = [];
        if (proxy.version) urlParams.push(`version=${proxy.version}`);
        if (proxy.reuse !== undefined) urlParams.push(`reuse=${proxy.reuse}`);
        if (proxy.tfo !== undefined) urlParams.push(`tfo=${proxy.tfo}`);

        if (proxy['obfs-opts']) {
            if (proxy['obfs-opts'].mode) urlParams.push(`obfs=${proxy['obfs-opts'].mode}`);
            if (proxy['obfs-opts'].host) urlParams.push(`obfs-host=${encodeURIComponent(proxy['obfs-opts'].host)}`);
        }

        const query = urlParams.length > 0 ? `?${urlParams.join('&')}` : '';
        const url = `snell://${encodeURIComponent(proxy.psk)}@${proxy.server}:${proxy.port}${query}#${encodeURIComponent(name)}`;

        return {
            id: generateNodeId(),
            name: name,
            url: url,
            enabled: true,
            protocol: 'snell',
            source: 'surge'
        };
    } catch (e) {
        console.error('Surge Snell 解析失败:', e);
        return null;
    }
}
