/**
 * URL 转 Clash 代理配置
 * 将节点 URL 转换为 Clash YAML 格式的代理对象
 * 支持：VLESS、Trojan、VMess、Shadowsocks、Hysteria2 等协议
 * 支持特殊参数：dialer-proxy、reality-opts 等
 */

/**
 * 解析 URL 查询参数
 * @param {string} url - 节点 URL
 * @returns {URLSearchParams} 查询参数对象
 */
function parseQueryParams(url) {
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) return new URLSearchParams();

    const hashIndex = url.indexOf('#');
    const queryString = hashIndex > queryIndex
        ? url.substring(queryIndex + 1, hashIndex)
        : url.substring(queryIndex + 1);

    return new URLSearchParams(queryString);
}

/**
 * 从 URL 提取节点名称
 * @param {string} url - 节点 URL
 * @returns {string} 节点名称
 */
function extractName(url) {
    const hashIndex = url.lastIndexOf('#');
    if (hashIndex === -1) return '';
    try {
        return decodeURIComponent(url.substring(hashIndex + 1));
    } catch {
        return url.substring(hashIndex + 1);
    }
}

/**
 * 解析服务器和端口
 * @param {string} hostPort - host:port 字符串
 * @returns {{server: string, port: number}}
 */
function parseHostPort(hostPort) {
    // 处理 IPv6: [::1]:port
    if (hostPort.startsWith('[')) {
        const closeBracket = hostPort.indexOf(']');
        if (closeBracket !== -1) {
            const server = hostPort.substring(1, closeBracket);
            const after = hostPort.substring(closeBracket + 1);
            const port = after.startsWith(':') ? parseInt(after.substring(1)) : 443;
            return { server, port };
        }
    }

    const parts = hostPort.split(':');
    return {
        server: parts[0],
        port: parseInt(parts[1]) || 443
    };
}

/**
 * 将 VLESS URL 转换为 Clash 代理对象
 * @param {string} url - VLESS URL
 * @returns {Object|null} Clash 代理对象
 */
function parseVlessUrl(url) {
    try {
        // vless://uuid@server:port?params#name
        const body = url.substring(8); // 去掉 vless://
        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        const uuid = body.substring(0, atIndex);

        // 解析 server:port
        let serverPart = body.substring(atIndex + 1);
        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');

        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            serverPart = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(serverPart);
        const params = parseQueryParams(url);
        const name = extractName(url);

        const proxy = {
            name: name || `VLESS-${server}`,
            type: 'vless',
            server,
            port,
            uuid
        };

        // 网络类型
        const network = params.get('type') || 'tcp';
        if (network !== 'tcp') {
            proxy.network = network;
        }

        // WebSocket 配置
        if (network === 'ws') {
            const wsOpts = {};
            if (params.get('path')) wsOpts.path = params.get('path');
            if (params.get('host')) {
                wsOpts.headers = { Host: params.get('host') };
            }
            if (Object.keys(wsOpts).length > 0) {
                proxy['ws-opts'] = wsOpts;
            }
        }

        // gRPC 配置
        if (network === 'grpc') {
            const grpcOpts = {};
            if (params.get('serviceName')) {
                grpcOpts['grpc-service-name'] = params.get('serviceName');
            }
            if (params.get('mode')) {
                grpcOpts['grpc-mode'] = params.get('mode');
            }
            if (Object.keys(grpcOpts).length > 0) {
                proxy['grpc-opts'] = grpcOpts;
            }
        }

        // 安全配置
        const security = params.get('security') || 'none';

        if (security === 'reality') {
            proxy.tls = true;
            const realityOpts = {};
            if (params.get('pbk')) realityOpts['public-key'] = params.get('pbk');
            if (params.get('sid')) realityOpts['short-id'] = params.get('sid');
            if (params.get('spx')) realityOpts['spider-x'] = params.get('spx');
            if (Object.keys(realityOpts).length > 0) {
                proxy['reality-opts'] = realityOpts;
            }
        } else if (security === 'tls') {
            proxy.tls = true;
        }

        // SNI
        if (params.get('sni')) {
            proxy.servername = params.get('sni');
        }

        // Fingerprint
        if (params.get('fp')) {
            proxy['client-fingerprint'] = params.get('fp');
        }

        // Flow (XTLS)
        if (params.get('flow')) {
            proxy.flow = params.get('flow');
        }

        // ALPN
        if (params.get('alpn')) {
            proxy.alpn = params.get('alpn').split(',');
        }

        // [重要] dialer-proxy 链式代理
        if (params.get('dp')) {
            proxy['dialer-proxy'] = params.get('dp');
        }

        // UDP
        proxy.udp = true;

        return proxy;
    } catch (e) {
        console.error('解析 VLESS URL 失败:', e);
        return null;
    }
}

/**
 * 将 Trojan URL 转换为 Clash 代理对象
 * @param {string} url - Trojan URL
 * @returns {Object|null} Clash 代理对象
 */
function parseTrojanUrl(url) {
    try {
        // trojan://password@server:port?params#name
        const body = url.substring(9); // 去掉 trojan://
        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        let password = body.substring(0, atIndex);
        try {
            password = decodeURIComponent(password);
        } catch { }

        let serverPart = body.substring(atIndex + 1);
        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');

        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            serverPart = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(serverPart);
        const params = parseQueryParams(url);
        const name = extractName(url);

        const proxy = {
            name: name || `Trojan-${server}`,
            type: 'trojan',
            server,
            port,
            password
        };

        // 网络类型
        const network = params.get('type') || 'tcp';
        if (network !== 'tcp') {
            proxy.network = network;
        }

        // WebSocket 配置
        if (network === 'ws') {
            const wsOpts = {};
            if (params.get('path')) wsOpts.path = params.get('path');
            if (params.get('host')) {
                wsOpts.headers = { Host: params.get('host') };
            }
            if (Object.keys(wsOpts).length > 0) {
                proxy['ws-opts'] = wsOpts;
            }
        }

        // SNI
        if (params.get('sni')) {
            proxy.sni = params.get('sni');
        }

        // Fingerprint
        if (params.get('fp')) {
            proxy['client-fingerprint'] = params.get('fp');
        }

        // Skip cert verify
        if (params.get('allowInsecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        // [重要] dialer-proxy 链式代理
        if (params.get('dp')) {
            proxy['dialer-proxy'] = params.get('dp');
        }

        // UDP
        proxy.udp = true;

        return proxy;
    } catch (e) {
        console.error('解析 Trojan URL 失败:', e);
        return null;
    }
}

/**
 * 将 VMess URL 转换为 Clash 代理对象
 * @param {string} url - VMess URL
 * @returns {Object|null} Clash 代理对象
 */
function parseVmessUrl(url) {
    try {
        // vmess://base64(json)
        const base64Part = url.substring(8);

        // 标准化 Base64
        let normalized = base64Part.replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';

        // 使用 TextDecoder 正确解码 UTF-8 内容
        const binaryString = atob(normalized);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const jsonStr = new TextDecoder('utf-8').decode(bytes);
        const config = JSON.parse(jsonStr);

        const proxy = {
            name: config.ps || `VMess-${config.add}`,
            type: 'vmess',
            server: config.add,
            port: parseInt(config.port),
            uuid: config.id,
            alterId: parseInt(config.aid) || 0,
            cipher: config.scy || 'auto'
        };

        // 网络类型
        const network = config.net || 'tcp';
        if (network !== 'tcp') {
            proxy.network = network;
        }

        // WebSocket 配置
        if (network === 'ws') {
            const wsOpts = {};
            if (config.path) wsOpts.path = config.path;
            if (config.host) {
                wsOpts.headers = { Host: config.host };
            }
            if (Object.keys(wsOpts).length > 0) {
                proxy['ws-opts'] = wsOpts;
            }
        }

        // TLS
        if (config.tls === 'tls') {
            proxy.tls = true;
            if (config.sni) proxy.servername = config.sni;
            if (config.fp) proxy['client-fingerprint'] = config.fp;
        }

        // UDP
        proxy.udp = true;

        return proxy;
    } catch (e) {
        console.error('解析 VMess URL 失败:', e);
        return null;
    }
}

/**
 * 将 Shadowsocks URL 转换为 Clash 代理对象
 * @param {string} url - Shadowsocks URL
 * @returns {Object|null} Clash 代理对象
 */
function parseSsUrl(url) {
    try {
        // ss://base64(method:password)@server:port#name
        // 或 ss://base64(method:password@server:port)#name
        let body = url.substring(5); // 去掉 ss://
        const name = extractName(url);

        // 去掉 fragment
        const hashIndex = body.indexOf('#');
        if (hashIndex !== -1) body = body.substring(0, hashIndex);

        // 去掉 query
        const queryIndex = body.indexOf('?');
        let queryPart = '';
        if (queryIndex !== -1) {
            queryPart = body.substring(queryIndex);
            body = body.substring(0, queryIndex);
        }

        let method, password, server, port;

        const atIndex = body.lastIndexOf('@');
        if (atIndex !== -1) {
            // SIP002 格式: base64(method:password)@server:port
            const userInfo = body.substring(0, atIndex);
            const serverPart = body.substring(atIndex + 1);

            // 解码 userInfo
            let decoded;
            try {
                let normalized = userInfo.replace(/-/g, '+').replace(/_/g, '/');
                while (normalized.length % 4) normalized += '=';
                decoded = atob(normalized);
            } catch {
                decoded = userInfo;
            }

            const colonIndex = decoded.indexOf(':');
            if (colonIndex !== -1) {
                method = decoded.substring(0, colonIndex);
                password = decoded.substring(colonIndex + 1);
            }

            const parsed = parseHostPort(serverPart);
            server = parsed.server;
            port = parsed.port;
        } else {
            // 旧格式: base64(method:password@server:port)
            let normalized = body.replace(/-/g, '+').replace(/_/g, '/');
            while (normalized.length % 4) normalized += '=';
            const decoded = atob(normalized);

            const atIdx = decoded.lastIndexOf('@');
            if (atIdx !== -1) {
                const userPart = decoded.substring(0, atIdx);
                const serverPart = decoded.substring(atIdx + 1);

                const colonIndex = userPart.indexOf(':');
                if (colonIndex !== -1) {
                    method = userPart.substring(0, colonIndex);
                    password = userPart.substring(colonIndex + 1);
                }

                const parsed = parseHostPort(serverPart);
                server = parsed.server;
                port = parsed.port;
            }
        }

        if (!method || !password || !server || !port) {
            return null;
        }

        const proxy = {
            name: name || `SS-${server}`,
            type: 'ss',
            server,
            port,
            cipher: method,
            password
        };

        // UDP
        proxy.udp = true;

        return proxy;
    } catch (e) {
        console.error('解析 SS URL 失败:', e);
        return null;
    }
}

/**
 * 将 Hysteria2 URL 转换为 Clash 代理对象
 * @param {string} url - Hysteria2 URL
 * @returns {Object|null} Clash 代理对象
 */
function parseHysteria2Url(url) {
    try {
        // hysteria2://password@server:port?params#name
        // hy2://password@server:port?params#name
        const prefixLen = url.startsWith('hysteria2://') ? 12 : 6;
        const body = url.substring(prefixLen);

        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        let password = body.substring(0, atIndex);
        try {
            password = decodeURIComponent(password);
        } catch { }

        let serverPart = body.substring(atIndex + 1);
        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');

        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            serverPart = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(serverPart);
        const params = parseQueryParams(url);
        const name = extractName(url);

        const proxy = {
            name: name || `Hysteria2-${server}`,
            type: 'hysteria2',
            server,
            port,
            password
        };

        // SNI
        if (params.get('sni')) {
            proxy.sni = params.get('sni');
        }

        // Skip cert verify
        if (params.get('insecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        // Obfs
        if (params.get('obfs')) {
            proxy.obfs = params.get('obfs');
            if (params.get('obfs-password')) {
                proxy['obfs-password'] = params.get('obfs-password');
            }
        }

        // [重要] dialer-proxy 链式代理
        if (params.get('dp')) {
            proxy['dialer-proxy'] = params.get('dp');
        }

        return proxy;
    } catch (e) {
        console.error('解析 Hysteria2 URL 失败:', e);
        return null;
    }
}

/**
 * 将节点 URL 转换为 Clash 代理对象
 * @param {string} url - 节点 URL
 * @returns {Object|null} Clash 代理对象
 */
export function urlToClashProxy(url) {
    if (!url || typeof url !== 'string') return null;

    const lowerUrl = url.toLowerCase();

    if (lowerUrl.startsWith('vless://')) {
        return parseVlessUrl(url);
    } else if (lowerUrl.startsWith('trojan://')) {
        return parseTrojanUrl(url);
    } else if (lowerUrl.startsWith('vmess://')) {
        return parseVmessUrl(url);
    } else if (lowerUrl.startsWith('ss://')) {
        return parseSsUrl(url);
    } else if (lowerUrl.startsWith('hysteria2://') || lowerUrl.startsWith('hy2://')) {
        return parseHysteria2Url(url);
    }

    // 不支持的协议
    return null;
}

/**
 * 批量将节点 URL 转换为 Clash 代理列表
 * @param {string[]} urls - 节点 URL 数组
 * @returns {Object[]} Clash 代理对象数组
 */
export function urlsToClashProxies(urls) {
    if (!Array.isArray(urls)) return [];

    return urls
        .map(url => urlToClashProxy(url))
        .filter(proxy => proxy !== null);
}

/**
 * 生成完整的 Clash 配置
 * @param {string[]} urls - 节点 URL 数组
 * @param {Object} options - 配置选项
 * @returns {string} Clash YAML 配置
 */
export function generateClashConfig(urls, options = {}) {
    const proxies = urlsToClashProxies(urls);

    if (proxies.length === 0) {
        return '';
    }

    // 构建 YAML（简化版，不使用 js-yaml 以减少依赖）
    let yaml = 'proxies:\n';

    for (const proxy of proxies) {
        yaml += `  - ${JSON.stringify(proxy)}\n`;
    }

    return yaml;
}
