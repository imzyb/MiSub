/**
 * AnyTLS配置转换为URL
 * 支持：TLS、SNI、ALPN、跳过证书验证
 */
export function convertAnytlsToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy.password) {
            return null;
        }

        const params = new URLSearchParams();

        // TLS SNI
        if (proxy.servername || proxy.sni) {
            params.set('sni', proxy.servername || proxy.sni);
        }

        // ALPN
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            if (alpn) params.set('alpn', alpn);
        }

        // 跳过证书验证
        if (proxy['skip-cert-verify'] !== undefined) {
            params.set('allowInsecure', proxy['skip-cert-verify'] ? '1' : '0');
        }

        // 构建 URL
        let url = `anytls://${encodeURIComponent(proxy.password)}@${proxy.server}:${proxy.port}`;

        // 添加参数
        const paramsStr = params.toString();
        if (paramsStr) {
            url += `?${paramsStr}`;
        }

        // Fragment (节点名称) - 必须在最后
        if (proxy.name) {
            url += `#${encodeURIComponent(proxy.name)}`;
        }

        return url;
    } catch (e) {
        console.error('AnyTLS转换失败:', e);
        return null;
    }
}
