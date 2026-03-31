/**
 * TUIC配置转换为URL
 * 支持完整参数：TUIC v4/v5、TLS、拥塞控制、UDP中继
 */
export function convertTuicToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port) {
            return null;
        }

        // TUIC v5 使用 uuid:password，v4 只用 uuid
        const uuid = proxy.uuid || '';
        const password = proxy.password || proxy.token || '';

        if (!uuid) {
            return null;
        }

        // 构建认证部分
        let auth;
        if (password) {
            // TUIC v5 格式
            auth = `${encodeURIComponent(uuid)}:${encodeURIComponent(password)}`;
        } else {
            // TUIC v4 格式
            auth = encodeURIComponent(uuid);
        }

        let url = `tuic://${auth}@${proxy.server}:${proxy.port}`;

        const params = new URLSearchParams();

        // 拥塞控制算法
        if (proxy['congestion-controller'] || proxy.congestion) {
            params.set('congestion_control', proxy['congestion-controller'] || proxy.congestion);
        }

        // UDP 中继模式 (native/quic)
        if (proxy['udp-relay-mode']) {
            params.set('udp_relay_mode', proxy['udp-relay-mode']);
        }

        // ALPN
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            params.set('alpn', alpn);
        }

        // TLS SNI
        if (proxy.sni || proxy.servername) {
            params.set('sni', proxy.sni || proxy.servername);
        }

        // TLS Fingerprint
        if (proxy['client-fingerprint'] || proxy.fingerprint) {
            params.set('fingerprint', proxy['client-fingerprint'] || proxy.fingerprint);
        }

        // 跳过证书验证
        if (proxy['skip-cert-verify'] !== undefined) {
            params.set('allow_insecure', proxy['skip-cert-verify'] ? '1' : '0');
        }

        // 禁用 SNI
        if (proxy['disable-sni'] !== undefined) {
            params.set('disable_sni', proxy['disable-sni'] ? '1' : '0');
        }

        // 减少 RTT
        if (proxy['reduce-rtt'] !== undefined) {
            params.set('reduce_rtt', proxy['reduce-rtt'] ? '1' : '0');
        }

        // 心跳间隔
        if (proxy.heartbeat) {
            params.set('heartbeat', proxy.heartbeat);
        }

        // UDP 中继
        if (proxy['udp-relay'] !== undefined) {
            params.set('udp', proxy['udp-relay'] ? '1' : '0');
        }

        // CWND 初始窗口
        if (proxy.cwnd) {
            params.set('cwnd', String(proxy.cwnd));
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
        console.error('TUIC转换失败:', e);
        return null;
    }
}
