/**
 * 订阅节点转换工具
 * 支持多种配置格式转换为标准节点URL
 */

/**
 * Base64编码函数
 */
function base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Base64解码函数
 */
function base64Decode(str) {
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch (e) {
        try {
            return atob(str);
        } catch {
            return str;
        }
    }
}

/**
 * VMess配置转换为URL
 */
function convertVmessToUrl(proxy) {
    try {
        const config = {
            v: "2",
            ps: proxy.name || proxy['server-name'] || 'VMess',
            add: proxy.server,
            port: proxy.port,
            id: proxy.uuid || proxy['client-id'] || '',
            aid: proxy.alterId || proxy['alter-id'] || 0,
            net: proxy.network || 'tcp',
            type: proxy.headerType || 'none',
            host: proxy.host || proxy['ws-opts']?.['headers']?.Host || '',
            path: proxy.path || proxy['ws-opts']?.path || '/',
            tls: proxy.tls ? 'tls' : '',
            cipher: proxy.cipher || 'auto'
        };

        // 处理不同的网络类型
        if (config.net === 'ws') {
            if (proxy['ws-opts']) {
                config.host = proxy['ws-opts']['headers']?.Host || config.host;
                config.path = proxy['ws-opts'].path || config.path;
            }
        } else if (config.net === 'grpc') {
            if (proxy['grpc-opts']) {
                config.path = proxy['grpc-opts']['grpc-service-name'] || config.path;
            }
        }

        return 'vmess://' + base64Encode(JSON.stringify(config));
    } catch (e) {
        console.error('VMess转换失败:', e);
        return null;
    }
}

/**
 * Shadowsocks配置转换为URL
 */
function convertShadowsocksToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy.cipher || !proxy.password) {
            return null;
        }

        // 构建用户信息部分：cipher:password
        const userinfo = `${proxy.cipher}:${encodeURIComponent(proxy.password)}`;
        const encodedUserinfo = base64Encode(userinfo);

        return `ss://${encodedUserinfo}@${proxy.server}:${proxy.port}#${encodeURIComponent(proxy.name || 'SS')}`;
    } catch (e) {
        console.error('Shadowsocks转换失败:', e);
        return null;
    }
}

/**
 * ShadowsocksR配置转换为URL
 */
function convertShadowsockRToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy.password) {
            return null;
        }

        const params = new URLSearchParams({
            server: proxy.server,
            server_port: proxy.port,
            protocol: proxy.protocol || 'origin',
            method: proxy.cipher || 'rc4-md5',
            password: proxy.password,
            remarks: proxy.name || 'SSR',
            obfs: proxy.obfs || 'plain',
            obfsparam: proxy['obfs-param'] || '',
            protoparam: proxy['protocol-param'] || ''
        });

        const base64Param = base64Encode(params.toString());
        return `ssr://${base64Param}`;
    } catch (e) {
        console.error('ShadowsocksR转换失败:', e);
        return null;
    }
}

/**
 * Trojan配置转换为URL
 */
function convertTrojanToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy.password) {
            return null;
        }

        let url = `trojan://${encodeURIComponent(proxy.password)}@${proxy.server}:${proxy.port}`;

        const params = [];
        if (proxy.name) {
            url += `#${encodeURIComponent(proxy.name)}`;
        }

        // 添加传输参数
        if (proxy.network === 'ws' && proxy['ws-opts']) {
            params.push(`type=ws`);
            if (proxy['ws-opts'].path) {
                params.push(`path=${encodeURIComponent(proxy['ws-opts'].path)}`);
            }
            if (proxy['ws-opts']['headers']?.Host) {
                params.push(`host=${encodeURIComponent(proxy['ws-opts']['headers'].Host)}`);
            }
        } else if (proxy.network === 'grpc' && proxy['grpc-opts']) {
            params.push(`type=grpc`);
            if (proxy['grpc-opts']['grpc-service-name']) {
                params.push(`serviceName=${encodeURIComponent(proxy['grpc-opts']['grpc-service-name'])}`);
            }
        }

        if (proxy.skipCertVerify !== undefined) {
            params.push(`allowInsecure=${proxy.skipCertVerify ? 1 : 0}`);
        }

        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }

        return url;
    } catch (e) {
        console.error('Trojan转换失败:', e);
        return null;
    }
}

/**
 * VLESS配置转换为URL
 */
function convertVlessToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy.uuid) {
            return null;
        }

        const params = new URLSearchParams({
            encryption: proxy.encryption || 'none',
            type: proxy.network || 'tcp'
        });

        // 添加传输参数
        if (proxy.network === 'ws' && proxy['ws-opts']) {
            params.set('type', 'ws');
            if (proxy['ws-opts'].path) {
                params.set('path', encodeURIComponent(proxy['ws-opts'].path));
            }
            if (proxy['ws-opts']['headers']?.Host) {
                params.set('host', encodeURIComponent(proxy['ws-opts']['headers'].Host));
            }
        } else if (proxy.network === 'grpc' && proxy['grpc-opts']) {
            params.set('type', 'grpc');
            if (proxy['grpc-opts']['grpc-service-name']) {
                params.set('serviceName', encodeURIComponent(proxy['grpc-opts']['grpc-service-name']));
            }
        }

        if (proxy.flow) {
            params.set('flow', proxy.flow);
        }

        if (proxy.tls) {
            params.set('security', 'tls');
            if (proxy.skipCertVerify !== undefined) {
                params.set('allowInsecure', proxy.skipCertVerify ? 1 : 0);
            }
        } else if (proxy.reality) {
            params.set('security', 'reality');
            if (proxy['reality-opts']) {
                if (proxy['reality-opts']['public-key']) {
                    params.set('publicKey', encodeURIComponent(proxy['reality-opts']['public-key']));
                }
                if (proxy['reality-opts']['short-id']) {
                    params.set('shortId', proxy['reality-opts']['short-id']);
                }
                if (proxy['reality-opts']['spider-x']) {
                    params.set('spiderX', encodeURIComponent(proxy['reality-opts']['spider-x']));
                }
            }
        }

        const url = `vless://${proxy.uuid}@${proxy.server}:${proxy.port}?${params.toString()}`;

        if (proxy.name) {
            return `${url}#${encodeURIComponent(proxy.name)}`;
        }

        return url;
    } catch (e) {
        console.error('VLESS转换失败:', e);
        return null;
    }
}

/**
 * Hysteria/Hysteria2配置转换为URL
 */
function convertHysteriaToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy.password) {
            return null;
        }

        const protocol = proxy.type === 'hysteria2' ? 'hysteria2' : 'hysteria';

        let url = `${protocol}://${encodeURIComponent(proxy.password)}@${proxy.server}:${proxy.port}`;

        const params = [];

        if (proxy.name) {
            params.push(`name=${encodeURIComponent(proxy.name)}`);
        }

        if (proxy.protocol) {
            params.push(`protocol=${encodeURIComponent(proxy.protocol)}`);
        }

        if (proxy.up) {
            params.push(`up=${proxy.up}`);
        }

        if (proxy.down) {
            params.push(`down=${proxy.down}`);
        }

        if (proxy['alpn']) {
            params.push(`alpn=${encodeURIComponent(proxy['alpn'].join(','))}`);
        }

        if (proxy['obfs']) {
            params.push(`obfs=${encodeURIComponent(proxy['obfs'].type || proxy['obfs'])}`);
            if (proxy['obfs'].host) {
                params.push(`obfs-host=${encodeURIComponent(proxy['obfs'].host)}`);
            }
        }

        if (proxy['skip-cert-verify'] !== undefined) {
            params.push(`insecure=${proxy['skip-cert-verify'] ? 1 : 0}`);
        }

        if (params.length > 0) {
            url += `?${params.join('&')}`;
        } else {
            if (proxy.name) {
                url += `#${encodeURIComponent(proxy.name)}`;
            }
        }

        return url;
    } catch (e) {
        console.error('Hysteria转换失败:', e);
        return null;
    }
}

/**
 * TUIC配置转换为URL
 */
function convertTuicToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy.uuid || !proxy.password) {
            return null;
        }

        const params = new URLSearchParams({
            congestion: proxy.congestion || 'bbr',
            udp_relay: proxy['udp-relay'] ? '1' : '0',
            alpn: proxy['alpn']?.join(',') || 'h3'
        });

        if (proxy['reduce-rtt'] !== undefined) {
            params.set('reduce_rtt', proxy['reduce-rtt'] ? '1' : '0');
        }

        const url = `tuic://${encodeURIComponent(proxy.uuid)}:${encodeURIComponent(proxy.password)}@${proxy.server}:${proxy.port}?${params.toString()}`;

        if (proxy.name) {
            return `${url}#${encodeURIComponent(proxy.name)}`;
        }

        return url;
    } catch (e) {
        console.error('TUIC转换失败:', e);
        return null;
    }
}

/**
 * 转换Clash代理配置为标准URL
 */
export function convertClashProxyToUrl(proxy) {
    if (!proxy || typeof proxy !== 'object' || !proxy.type) {
        return null;
    }

    const type = proxy.type.toLowerCase();

    switch (type) {
        case 'vmess':
            return convertVmessToUrl(proxy);
        case 'ss':
        case 'shadowsocks':
            return convertShadowsocksToUrl(proxy);
        case 'ssr':
        case 'shadowsocksr':
            return convertShadowsockRToUrl(proxy);
        case 'trojan':
            return convertTrojanToUrl(proxy);
        case 'vless':
            return convertVlessToUrl(proxy);
        case 'hysteria':
        case 'hysteria2':
            return convertHysteriaToUrl(proxy);
        case 'tuic':
            return convertTuicToUrl(proxy);
        case 'socks5':
            return convertSocks5ToUrl(proxy);
        case 'http':
            return convertHttpToUrl(proxy);
        case 'wireguard':
            return convertWireguardToUrl(proxy);
        default:
            console.warn(`不支持的代理类型: ${type}`);
            return null;
    }
}

/**
 * SOCKS5代理转换为URL
 */
function convertSocks5ToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port) {
            return null;
        }

        let userinfo = '';
        if (proxy.username) {
            const password = proxy.password || '';
            userinfo = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(password)}@`;
        }

        let url = `socks5://${userinfo}${proxy.server}:${proxy.port}`;

        const params = new URLSearchParams();
        if (proxy.tls || proxy['skip-cert-verify'] !== undefined) {
            params.set('tls', proxy.tls ? 'true' : 'false');
        }
        if (proxy.udp) {
            params.set('udp', proxy.udp ? 'true' : 'false');
        }

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        if (proxy.name) {
            url += `#${encodeURIComponent(proxy.name)}`;
        }

        return url;
    } catch (e) {
        console.error('SOCKS5转换失败:', e);
        return null;
    }
}

/**
 * HTTP代理转换为URL
 */
function convertHttpToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port) {
            return null;
        }

        let userinfo = '';
        if (proxy.username) {
            const password = proxy.password || '';
            userinfo = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(password)}@`;
        }

        let url = `http://${userinfo}${proxy.server}:${proxy.port}`;

        const params = new URLSearchParams();
        if (proxy.tls || proxy['skip-cert-verify'] !== undefined) {
            params.set('tls', proxy.tls ? 'true' : 'false');
        }

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        if (proxy.name) {
            url += `#${encodeURIComponent(proxy.name)}`;
        }

        return url;
    } catch (e) {
        console.error('HTTP转换失败:', e);
        return null;
    }
}

/**
 * WireGuard转换为URL（简化版本）
 */
function convertWireguardToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy['private-key']) {
            return null;
        }

        // WireGuard需要特殊处理，这里提供基础支持
        const params = new URLSearchParams({
            private_key: proxy['private-key'],
            public_key: proxy['public-key'] || '',
            endpoint: `${proxy.server}:${proxy.port}`,
            allowed_ips: proxy['allowed-ips']?.join(',') || '0.0.0.0/0,::/0',
            mtu: proxy.mtu || '1420'
        });

        // 添加DNS配置
        if (proxy.dns) {
            params.set('dns', Array.isArray(proxy.dns) ? proxy.dns.join(',') : proxy.dns);
        }

        return `wireguard://${params.toString()}#${encodeURIComponent(proxy.name || 'WireGuard')}`;
    } catch (e) {
        console.error('WireGuard转换失败:', e);
        return null;
    }
}

/**
 * 解析Surge配置
 */
export function parseSurgeConfig(content) {
    const nodes = [];
    const lines = content.split('\n');

    let currentNode = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 匹配代理规则
        if (line.toLowerCase().startsWith('[proxy]') || line.toLowerCase().startsWith('[proxies]')) {
            // Surge代理配置
            continue;
        }

        // 解析不同类型的代理
        if (line.toLowerCase().startsWith('vmess')) {
            const node = parseSurgeVmess(line);
            if (node) nodes.push(node);
        } else if (line.toLowerCase().startsWith('ss')) {
            const node = parseSurgeSS(line);
            if (node) nodes.push(node);
        } else if (line.toLowerCase().startsWith('trojan')) {
            const node = parseSurgeTrojan(line);
            if (node) nodes.push(node);
        } else if (line.toLowerCase().startsWith('http-proxy') || line.toLowerCase().startsWith('https-proxy')) {
            const node = parseSurgeHTTP(line);
            if (node) nodes.push(node);
        }
    }

    return nodes;
}

/**
 * 解析Surge VMess配置
 */
function parseSurgeVmess(line) {
    try {
        const parts = line.match(/(\w+)\s*=\s*(.+)$/);
        if (!parts) return null;

        const params = parts[2].split(',').map(p => p.trim());
        const [name, server, port] = params;

        if (!name || !server || !port) return null;

        // Surge VMess需要更复杂的参数解析
        return {
            id: crypto.randomUUID(),
            name: name.trim().replace(/"/g, ''),
            url: `vmess://${server}:${port}#${encodeURIComponent(name.trim().replace(/"/g, ''))}`,
            enabled: true,
            protocol: 'vmess',
            source: 'surge'
        };
    } catch (e) {
        return null;
    }
}

/**
 * 解析Surge Shadowsocks配置
 */
function parseSurgeSS(line) {
    try {
        const parts = line.match(/(\w+)\s*=\s*(.+)$/);
        if (!parts) return null;

        const params = parts[2].split(',').map(p => p.trim());
        const [name, server, port, method, password] = params;

        if (!name || !server || !port || !method || !password) return null;

        const userinfo = base64Encode(`${method}:${password}`);
        return {
            id: crypto.randomUUID(),
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
        const parts = line.match(/(\w+)\s*=\s*(.+)$/);
        if (!parts) return null;

        const params = parts[2].split(',').map(p => p.trim());
        const [name, server, port, password] = params;

        if (!name || !server || !port || !password) return null;

        return {
            id: crypto.randomUUID(),
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
        const parts = line.match(/(\w+)\s*=\s*(.+)$/);
        if (!parts) return null;

        const params = parts[2].split(',').map(p => p.trim());
        const [name, server, port] = params;

        if (!name || !server || !port) return null;

        const isHTTPS = line.toLowerCase().startsWith('https-proxy');
        const protocol = isHTTPS ? 'https' : 'http';

        return {
            id: crypto.randomUUID(),
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
function parseQuantumletXVmess(line) {
    try {
        const parts = line.split('=');
        if (parts.length < 2) return null;

        const config = parts[1];
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
            id: crypto.randomUUID(),
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
        const parts = line.split('=');
        if (parts.length < 2) return null;

        const config = parts[1];
        const params = config.split(',').map(p => p.trim());

        if (params.length < 5) return null;

        const [name, server, port, method, password, ...extra] = params;

        if (!name || !server || !port || !method || !password) return null;

        const userinfo = base64Encode(`${method.trim()}:${password.trim()}`);

        return {
            id: crypto.randomUUID(),
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
        const parts = line.split('=');
        if (parts.length < 2) return null;

        const config = parts[1];
        const params = config.split(',').map(p => p.trim());

        if (params.length < 4) return null;

        const [name, server, port, password, ...extra] = params;

        if (!name || !server || !port || !password) return null;

        return {
            id: crypto.randomUUID(),
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
        const parts = line.split('=');
        if (parts.length < 2) return null;

        const config = parts[1];
        const params = config.split(',').map(p => p.trim());

        if (params.length < 3) return null;

        const [name, server, port, username, password] = params;

        if (!name || !server || !port) return null;

        let userinfo = '';
        if (username && password) {
            userinfo = `${encodeURIComponent(username.trim())}:${encodeURIComponent(password.trim())}@`;
        }

        return {
            id: crypto.randomUUID(),
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

/**
 * 转换通用代理类型
 */
function convertGenericProxyToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port) {
            return null;
        }

        const userinfo = proxy.username ?
            `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password || '')}@` : '';

        return `${proxy.type}://${userinfo}${proxy.server}:${proxy.port}#${encodeURIComponent(proxy.name || proxy.type)}`;
    } catch (e) {
        console.error('通用代理转换失败:', e);
        return null;
    }
}

/**
 * 验证生成的URL是否有效
 */
export function validateGeneratedUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    try {
        const supportedProtocols = ['vmess', 'vless', 'trojan', 'ss', 'ssr', 'hysteria', 'hysteria2', 'tuic', 'socks5', 'http'];
        const protocol = url.split('://')[0];

        return supportedProtocols.includes(protocol.toLowerCase());
    } catch {
        return false;
    }
}

/**
 * 批量转换Clash代理
 */
export function batchConvertClashProxies(proxies) {
    if (!Array.isArray(proxies)) {
        return [];
    }

    const results = [];
    for (const proxy of proxies) {
        const url = convertClashProxyToUrl(proxy);
        if (url && validateGeneratedUrl(url)) {
            results.push({
                name: proxy.name || 'Unknown',
                url: url,
                type: proxy.type,
                original: proxy
            });
        }
    }

    return results;
}