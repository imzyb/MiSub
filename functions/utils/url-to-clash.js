 * 支持特殊参数：dialer-proxy、reality-opts 等
 */

import { extractNodeMetadata } from '../modules/utils/metadata-extractor.js';

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
 * Base64 解码支持 (处理 URL Safe)
 */
function base64Decode(str) {
    try {
        let normalized = str.replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';
        return decodeURIComponent(escape(atob(normalized)));
    } catch {
        // 回退到纯 atob
        try {
            return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
        } catch {
            return str;
        }
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
        
        // xHTTP 配置 (Loon 3.0+ / Xray 1.8.7+)
        if (network === 'xhttp') {
            const xhttpOpts = {};
            const path = params.get('xhttp-path') || params.get('path');
            const host = params.get('xhttp-host') || params.get('host') || params.get('sni');
            if (path) xhttpOpts.path = path;
            if (host) {
                xhttpOpts.host = host;
                xhttpOpts.headers = { Host: host };
            }
            if (params.get('mode')) xhttpOpts.mode = params.get('mode');
            if (Object.keys(xhttpOpts).length > 0) {
                proxy['xhttp-opts'] = xhttpOpts;
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

        // HTTPUpgrade 配置
        if (network === 'httpupgrade') {
            const httpupgradeOpts = {};
            if (params.get('path')) httpupgradeOpts.path = params.get('path');
            if (params.get('host')) httpupgradeOpts.host = params.get('host');
            if (Object.keys(httpupgradeOpts).length > 0) {
                proxy['httpupgrade-opts'] = httpupgradeOpts;
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

        // Skip cert verify (统一支持 allowInsecure 和 insecure)
        if (params.get('allowInsecure') === '1' || params.get('insecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

// SNI (支持 sni 和 peer 两种参数名，Shadowrocket 使用 peer)
      if (params.get('sni')) {
        proxy.servername = params.get('sni');
        proxy.sni = params.get('sni');
      } else if (params.get('peer')) {
        proxy.servername = params.get('peer');
        proxy.sni = params.get('peer');
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

        // SNI (支持 sni 和 peer 两种参数名，Shadowrocket 使用 peer)
        if (params.get('sni')) {
            proxy.servername = params.get('sni');
            proxy.sni = params.get('sni');
        } else if (params.get('peer')) {
            proxy.servername = params.get('peer');
            proxy.sni = params.get('peer');
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
            server: config.add || config.host || config.sni || '',
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

        // gRPC 配置
        if (network === 'grpc') {
            const grpcOpts = {};
            if (config.path) grpcOpts['grpc-service-name'] = config.path; // vmess json sometimes use path for serviceName
            if (config.host) grpcOpts['grpc-service-name'] = config.host; 
            if (Object.keys(grpcOpts).length > 0) {
                proxy['grpc-opts'] = grpcOpts;
            }
        }

        // H2 (HTTP/2) 配置
        if (network === 'h2') {
            const h2Opts = {};
            if (config.path) h2Opts.path = config.path;
            if (config.host) h2Opts.host = config.host.split(',').map(h => h.trim());
            if (Object.keys(h2Opts).length > 0) {
                proxy['h2-opts'] = h2Opts;
            }
        }

        // HTTP 配置
        if (network === 'http') {
            const httpOpts = {
                path: config.path || '/',
                headers: {
                    Host: config.host ? config.host.split(',').map(h => h.trim()) : []
                }
            };
            proxy['http-opts'] = httpOpts;
        }

        // QUIC 配置
        if (network === 'quic') {
            const quicOpts = {};
            if (config.type) quicOpts.header = { type: config.type };
            if (config.host) quicOpts.security = config.host;
            if (config.path) quicOpts.key = config.path;
            if (Object.keys(quicOpts).length > 0) {
                proxy['quic-opts'] = quicOpts;
            }
        }

        // TLS
        if (config.tls === 'tls' || config.tls === 'reality') {
            proxy.tls = true;
            if (config.sni) proxy.servername = config.sni;
            if (config.fp) proxy['client-fingerprint'] = config.fp;
            if (config.alpn) proxy.alpn = String(config.alpn).split(',').map(s => s.trim());
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
            proxy.servername = params.get('sni');
            proxy.sni = params.get('sni');
        }

        // Skip cert verify
        if (params.get('insecure') === '1' || params.get('allowInsecure') === '1') {
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
 * 将 TUIC URL 转换为 Clash 代理对象
 * @param {string} url - TUIC URL
 * @returns {Object|null} Clash 代理对象
 */
function parseTuicUrl(url) {
    try {
        // tuic://token@server:port?sni=xxx&alpn=xxx#name
        const body = url.substring(7); // 去掉 tuic://

        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        let token = body.substring(0, atIndex);
        try {
            token = decodeURIComponent(token);
        } catch { }

        const tokenParts = token.split(':');
        const uuid = tokenParts[0] || '';
        const password = tokenParts[1] || '';

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
            name: name || `TUIC-${server}`,
            type: 'tuic',
            server,
            port,
            uuid,
            password
        };

        // SNI
        const sni = params.get('sni');
        if (sni) {
            proxy.servername = sni;
            proxy.sni = sni;
        }

        // ALPN
        if (params.get('alpn')) {
            proxy.alpn = params.get('alpn').split(',');
        }

        // Skip cert verify
        if (params.get('allowInsecure') === '1' || params.get('insecure') === '1' || params.get('allow_insecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }
        
        // 拥塞控制
        if (params.get('congestion_control')) {
            proxy['congestion-control'] = params.get('congestion_control');
        }

        // UDP Relay Mode
        if (params.get('udp_relay_mode')) {
            proxy['udp-relay-mode'] = params.get('udp_relay_mode');
        }

        // Reduce RTT & Fast Open
        if (params.get('reduce_rtt') === '1' || params.get('reduce_rtt') === 'true') {
            proxy['reduce-rtt'] = true;
        }
        if (params.get('fast_open') === '1' || params.get('fast_open') === 'true') {
            proxy['fast-open'] = true;
        }

        // [重要] dialer-proxy 链式代理
        if (params.get('dp')) {
            proxy['dialer-proxy'] = params.get('dp');
        }

        proxy.udp = true;

        return proxy;
    } catch (e) {
        console.error('解析 TUIC URL 失败:', e);
        return null;
    }
}

/**
* 将 WireGuard URL 转换为 Clash 代理对象
* @param {string} url - WireGuard URL
* @returns {Object|null} Clash 代理对象
*/
function parseWireguardUrl(url) {
try {
// wireguard://privatekey@server:port?params#name
const body = url.substring('wireguard://'.length);

const atIndex = body.indexOf('@');
if (atIndex === -1) return null;

let privateKey = body.substring(0, atIndex);
try {
privateKey = decodeURIComponent(privateKey);
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
name: name || `WireGuard-${server}`,
type: 'wireguard',
server,
port,
'private-key': privateKey,
'remote-dns-resolve': true,
udp: true
};

// 公钥
const publicKey = params.get('publickey') || params.get('public-key');
if (publicKey) {
proxy['public-key'] = publicKey;
}

// 本地地址
const address = params.get('address');
if (address) {
proxy.ip = address.split(',').map(a => a.trim());
}

// Allowed IPs
const allowedIPs = params.get('allowedips') || params.get('allowed-ips');
if (allowedIPs) {
proxy['allowed-ips'] = allowedIPs.split(',').map(a => a.trim());
}

// Reserved (Cloudflare WARP)
const reserved = params.get('reserved');
if (reserved) {
const reservedArr = reserved.split(',').map(n => parseInt(n.trim()));
if (reservedArr.every(n => !isNaN(n))) {
proxy.reserved = reservedArr;
}
}

// MTU
const mtu = params.get('mtu');
if (mtu) {
proxy.mtu = parseInt(mtu);
}

// DNS
const dns = params.get('dns');
if (dns) {
proxy.dns = dns.split(',').map(d => d.trim());
}

// Keepalive
const keepalive = params.get('keepalive');
if (keepalive) {
proxy['persistent-keepalive'] = parseInt(keepalive);
}

// Preshared Key
const presharedKey = params.get('presharedkey') || params.get('preshared-key');
if (presharedKey) {
proxy['preshared-key'] = presharedKey;
}

return proxy;
} catch (e) {
console.error('解析 WireGuard URL 失败:', e);
return null;
}
}

/**
* 将 Snell URL 转换为 Clash 代理对象
* @param {string} url - Snell URL
* @returns {Object|null} Clash 代理对象
*/
function parseSnellUrl(url) {
    try {
        const body = url.substring('snell://'.length);
        let psk = '';
        let serverPart = '';
        const atIndex = body.indexOf('@');
        if (atIndex !== -1) {
            psk = body.substring(0, atIndex);
            try { psk = decodeURIComponent(psk); } catch { }
            serverPart = body.substring(atIndex + 1);
        } else {
            serverPart = body;
        }

        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');
        let hostPortStr = serverPart;
        if (queryIndex !== -1) {
            hostPortStr = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            hostPortStr = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(hostPortStr);
        const params = parseQueryParams(url);
        const name = extractName(url);

        if (!psk) psk = params.get('psk') || params.get('password') || '';

        const proxy = { name: name || `Snell-${server}`, type: 'snell', server, port, psk };
        const version = params.get('version');
        if (version) proxy.version = parseInt(version);
        const reuse = params.get('reuse');
        if (reuse !== null) proxy.reuse = reuse === 'true';
        const tfo = params.get('tfo');
        if (tfo !== null) proxy.tfo = tfo === 'true';
        const obfs = params.get('obfs');
        const obfsHost = params.get('obfs-host');
        if (obfs || obfsHost) {
            proxy['obfs-opts'] = {};
            if (obfs) proxy['obfs-opts'].mode = obfs;
            if (obfsHost) proxy['obfs-opts'].host = obfsHost;
        }
        if (params.get('udp-relay') === 'true') proxy.udp = true;
        if (params.get('ecn') === 'true' || params.get('ecn') === '1') proxy.ecn = true;
        return proxy;
    } catch (e) {
        console.error('解析 Snell URL 失败:', e);
        return null;
    }
}

/**
 * 将 AnyTLS URL 转换为 Clash 代理对象
 * @param {string} url - AnyTLS URL
 * @returns {Object|null} Clash 代理对象
 */
function parseAnytlsUrl(url) {
    try {
        const body = url.substring(9);
        let password = '';
        let serverPart = '';
        const atIndex = body.indexOf('@');
        if (atIndex !== -1) {
            password = body.substring(0, atIndex);
            try { password = decodeURIComponent(password); } catch { }
            serverPart = body.substring(atIndex + 1);
        } else {
            serverPart = body;
        }

        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');
        let hostPortStr = serverPart;
        if (queryIndex !== -1) {
            hostPortStr = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            hostPortStr = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(hostPortStr);
        const safePort = isNaN(port) ? 443 : port;
        const params = parseQueryParams(url);
        const name = extractName(url);

        const proxy = { 
            name: name || `AnyTLS-${server}`, 
            type: 'anytls', 
            server, 
            port: safePort, 
            password 
        };
        
        const sni = params.get('sni') || params.get('peer');
        if (sni) {
            proxy.servername = sni;
            proxy.sni = sni;
        }
        
        if (params.get('alpn')) proxy.alpn = params.get('alpn').split(',');
        if (params.get('insecure') === '1' || params.get('allowInsecure') === '1') proxy['skip-cert-verify'] = true;

        proxy.udp = true;
        return proxy;
    } catch (e) {
        console.error('解析 AnyTLS URL 失败:', e);
        return null;
    }
}

/**
 * 将 HTTPS URL 转换为 Clash 代理对象
 * @param {string} url - HTTPS URL
 * @returns {Object|null} Clash 代理对象
 */
function parseHttpsUrl(url) {
    try {
        // https://username:password@server:port?params#name
        const body = url.substring(8);
        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        let userInfo = body.substring(0, atIndex);
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

        let username = '';
        let password = '';
        const colonIndex = userInfo.indexOf(':');
        if (colonIndex !== -1) {
            username = decodeURIComponent(userInfo.substring(0, colonIndex));
            password = decodeURIComponent(userInfo.substring(colonIndex + 1));
        } else {
            username = decodeURIComponent(userInfo);
        }

        const proxy = {
            name: name || `HTTPS-${server}`,
            type: 'https',
            server,
            port,
            username,
            password
        };

        if (params.get('sni')) {
            proxy.servername = params.get('sni');
            proxy.sni = params.get('sni');
        } else if (params.get('peer')) {
            proxy.servername = params.get('peer');
            proxy.sni = params.get('peer');
        }

        if (params.get('allowInsecure') === '1' || params.get('insecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        proxy.udp = false;
        return proxy;
    } catch (e) {
        console.error('解析 HTTPS URL 失败:', e);
        return null;
    }
}

/**
 * 将 SOCKS5 URL 转换为 Clash 代理对象
 * @param {string} url - SOCKS5 URL
 * @returns {Object|null} Clash 代理对象
 */
function parseSocks5Url(url) {
    try {
        // socks5://username:password@server:port?tls=1#name
        const body = url.substring(9);
        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        let userInfo = body.substring(0, atIndex);
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

        let username = '';
        let password = '';
        const colonIndex = userInfo.indexOf(':');
        if (colonIndex !== -1) {
            username = decodeURIComponent(userInfo.substring(0, colonIndex));
            password = decodeURIComponent(userInfo.substring(colonIndex + 1));
        } else {
            username = decodeURIComponent(userInfo);
        }

        const useTls = params.get('tls') === '1' || params.get('tls') === 'true' || params.get('secure') === '1';
        const proxy = {
            name: name || `SOCKS5-${server}`,
            type: useTls ? 'socks5-tls' : 'socks5',
            server,
            port,
            username,
            password,
            udp: false
        };

        if (params.get('sni')) {
            proxy.servername = params.get('sni');
            proxy.sni = params.get('sni');
        } else if (params.get('peer')) {
            proxy.servername = params.get('peer');
            proxy.sni = params.get('peer');
        }

        if (params.get('allowInsecure') === '1' || params.get('insecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        return proxy;
    } catch (e) {
        console.error('解析 SOCKS5 URL 失败:', e);
        return null;
    }
}


/**
 * 将 SSR URL 转换为 Clash 代理对象
 * @param {string} url - SSR URL
 * @returns {Object|null} Clash 代理对象
 */
function parseSsrUrl(url) {
    try {
        const b64 = url.substring(6);
        const decoded = base64Decode(b64);
        
        // server:port:protocol:method:obfs:password_base64/?params
        const mainParts = decoded.split(':');
        if (mainParts.length < 6) return null;

        const server = mainParts[0];
        const port = parseInt(mainParts[1]);
        const protocol = mainParts[2];
        const cipher = mainParts[3];
        const obfs = mainParts[4];
        
        const passwordPart = mainParts[5];
        const passwordEndIndex = passwordPart.indexOf('/');
        const passwordBase64 = passwordEndIndex !== -1 ? passwordPart.substring(0, passwordEndIndex) : passwordPart;
        const password = base64Decode(passwordBase64);

        const proxy = {
            name: `SSR-${server}`,
            type: 'ssr',
            server,
            port,
            protocol,
            cipher,
            obfs,
            password,
            udp: true
        };

        if (passwordEndIndex !== -1) {
            const paramsStr = passwordPart.substring(passwordEndIndex + 2); // skip /?
            const params = new URLSearchParams(paramsStr);
            
            if (params.get('obfsparam')) proxy['obfs-param'] = base64Decode(params.get('obfsparam'));
            if (params.get('protoparam')) proxy['protocol-param'] = base64Decode(params.get('protoparam'));
            if (params.get('remarks')) proxy.name = base64Decode(params.get('remarks'));
            if (params.get('group')) proxy.group = base64Decode(params.get('group'));
            if (params.get('udpport')) proxy.udpport = params.get('udpport');
        }

        return proxy;
    } catch (e) {
        console.error('解析 SSR URL 失败:', e);
        return null;
    }
}

/**
 * 将 SSD URL 转换为 Clash 代理对象
 * @param {string} url - SSD URL
 * @returns {Object|null} Clash 代理对象
 */
function parseSsdUrl(url) {
    try {
        const b64 = url.substring(6);
        const decoded = base64Decode(b64);
        const config = JSON.parse(decoded);
        
        // SSD 通常包含一个数组。这里为了简化，返回第一个有效的。
        // 实际上 SSD 应该被展开，但 builtin 流程目前是 1-to-1 映射。
        // 我们取第一个作为示范。
        if (!config.servers || !config.servers.length) return null;
        
        const s = config.servers[0];
        const proxy = {
            name: s.remarks || `SSD-${s.server}`,
            type: 'ss',
            server: s.server,
            port: s.port,
            cipher: config.encryption || s.encryption || 'aes-256-gcm',
            password: config.password || s.password,
            plugin: s.plugin,
            'plugin-opts': s.plugin_options ? { host: s.plugin_options } : undefined
        };
        
        return proxy;
    } catch (e) {
        console.error('解析 SSD URL 失败:', e);
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
    } else if (lowerUrl.startsWith('ssr://')) {
        return parseSsrUrl(url);
    } else if (lowerUrl.startsWith('ssd://')) {
        return parseSsdUrl(url);
    } else if (lowerUrl.startsWith('ss://')) {
        return parseSsUrl(url);
    } else if (lowerUrl.startsWith('hysteria2://') || lowerUrl.startsWith('hy2://')) {
        return parseHysteria2Url(url);
    } else if (lowerUrl.startsWith('tuic://')) {
        return parseTuicUrl(url);
    } else if (lowerUrl.startsWith('snell://')) {
        return parseSnellUrl(url);
    } else if (lowerUrl.startsWith('wireguard://')) {
        return parseWireguardUrl(url);
    } else if (lowerUrl.startsWith('anytls://')) {
        return parseAnytlsUrl(url);
    } else if (lowerUrl.startsWith('https://')) {
        return parseHttpsUrl(url);
    } else if (lowerUrl.startsWith('socks5://')) {
        return parseSocks5Url(url);
    }

    // 不支持的协议
    return null;
}


/**
 * 批量将节点 URL 转换为 Clash 代理列表
 * @param {string[]} urls - 节点 URL 数组
 * @param {Object} options - 参数增强选项 (tfo, udp, scv 等)
 * @returns {Object[]} Clash 代理对象数组
 */
export function urlsToClashProxies(urls, options = {}) {
    if (!Array.isArray(urls)) return [];

    return urls
        .map(url => {
            const proxy = urlToClashProxy(url);
            if (!proxy) return null;
            
            // [URL 参数覆盖] 补全对 TFO/UDP/SCV 的映射
            if (options.enableTfo !== undefined) proxy.tfo = options.enableTfo;
            if (options.enableUdp !== undefined) proxy.udp = options.enableUdp;
            if (options.skipCertVerify !== undefined) proxy['skip-cert-verify'] = options.skipCertVerify;

            // [智能增强] 注入元数据
            proxy.metadata = extractNodeMetadata(proxy.name);
            
            // [自动补全] 仅在名称中完全没有国旗/地球 Emoji 时才尝试补全，避免重复添加或干扰用户重命名
            const HAS_EMOJI_REGEX = /([\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F30D}-\u{1F30F}])/u;
            if (proxy.metadata.flag && !HAS_EMOJI_REGEX.test(proxy.name)) {
                proxy.name = `${proxy.metadata.flag} ${proxy.name}`;
            }
            
            return proxy;
        })
        .filter(proxy => proxy !== null);
}

/**
 * 生成完整的 Clash 配置
 * @param {string[]} urls - 节点 URL 数组
 * @param {Object} options - 配置选项
 * @returns {string} Clash YAML 配置
 */
export function generateClashConfig(urls, options = {}) {
    const proxies = urlsToClashProxies(urls, options);

    if (proxies.length === 0) {
        return '';
    }

    // 构建 YAML（简化版，不使用 js-yaml 以减少依赖）
    let yaml = 'proxies:\n';

    for (const proxy of proxies) {
        // [元数据清理] 移除内部元数据字段，避免污染 YAML
        const { metadata, ...rest } = proxy;
        yaml += `  - ${JSON.stringify(rest)}\n`;
    }

    return yaml;
}
