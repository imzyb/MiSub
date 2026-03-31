/**
 * HTTP代理转换为URL
 * 支持完整参数：认证、TLS (HTTPS)、SNI
 */
export function convertHttpToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port) {
            return null;
        }

        // 处理服务器地址 (支持 IPv6)
        let serverAddr = proxy.server;
        if (serverAddr.includes(':') && !serverAddr.startsWith('[')) {
            serverAddr = `[${serverAddr}]`;
        }

        // 用户认证
        let userinfo = '';
        if (proxy.username) {
            const password = proxy.password || '';
            userinfo = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(password)}@`;
        }

        // 协议类型 (http/https)
        const protocol = proxy.tls ? 'https' : 'http';
        let url = `${protocol}://${userinfo}${serverAddr}:${proxy.port}`;

        const params = new URLSearchParams();

        // TLS 配置
        if (proxy.tls) {
            // SNI
            if (proxy.sni || proxy.servername) {
                params.set('sni', proxy.sni || proxy.servername);
            }

            // Fingerprint
            if (proxy['client-fingerprint'] || proxy.fingerprint) {
                params.set('fp', proxy['client-fingerprint'] || proxy.fingerprint);
            }

            // 跳过证书验证
            if (proxy['skip-cert-verify'] !== undefined) {
                params.set('allowInsecure', proxy['skip-cert-verify'] ? '1' : '0');
            }

            // ALPN
            if (proxy.alpn) {
                const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
                params.set('alpn', alpn);
            }
        }

        // 自定义 Headers
        if (proxy.headers) {
            for (const [key, value] of Object.entries(proxy.headers)) {
                params.set(`header-${key}`, value);
            }
        }

        // 添加参数
        const paramsStr = params.toString();
        if (paramsStr) {
            url += `?${paramsStr}`;
        }

        // Fragment (节点名称)
        if (proxy.name) {
            url += `#${encodeURIComponent(proxy.name)}`;
        }

        return url;
    } catch (e) {
        console.error('HTTP转换失败:', e);
        return null;
    }
}
