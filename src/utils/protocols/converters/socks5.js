/**
 * SOCKS5代理转换为URL
 * 支持完整参数：认证、TLS、UDP
 */
export function convertSocks5ToUrl(proxy) {
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

        let url = `socks5://${userinfo}${serverAddr}:${proxy.port}`;

        const params = new URLSearchParams();

        // TLS 配置
        if (proxy.tls) {
            params.set('tls', '1');

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
        }

        // UDP 支持
        if (proxy.udp !== undefined) {
            params.set('udp', proxy.udp ? '1' : '0');
        }

        // 版本 (socks4/socks4a/socks5)
        if (proxy.version && proxy.version !== 5) {
            params.set('version', String(proxy.version));
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
        console.error('SOCKS5转换失败:', e);
        return null;
    }
}
