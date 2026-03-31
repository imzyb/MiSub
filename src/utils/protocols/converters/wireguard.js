/**
 * WireGuard配置转换为URL
 * 采用标准格式，支持 reserved、preshared-key、IPv6
 */
export function convertWireguardToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy['private-key']) {
            return null;
        }

        const params = new URLSearchParams();

        // 必需参数
        params.set('privatekey', proxy['private-key']);

        if (proxy['public-key'] || proxy.publicKey) {
            params.set('publickey', proxy['public-key'] || proxy.publicKey);
        }

        // 本地地址 (支持 IPv4 和 IPv6)
        if (proxy.ip || proxy['local-address']) {
            let addresses = proxy.ip || proxy['local-address'];
            if (Array.isArray(addresses)) {
                addresses = addresses.join(',');
            }
            params.set('address', addresses);
        }

        // 允许的 IP 范围
        if (proxy['allowed-ips'] || proxy.allowedIPs) {
            let allowedIPs = proxy['allowed-ips'] || proxy.allowedIPs;
            if (Array.isArray(allowedIPs)) {
                allowedIPs = allowedIPs.join(',');
            }
            params.set('allowedips', allowedIPs);
        }

        // MTU
        if (proxy.mtu) {
            params.set('mtu', String(proxy.mtu));
        }

        // DNS
        if (proxy.dns) {
            let dns = proxy.dns;
            if (Array.isArray(dns)) {
                dns = dns.join(',');
            }
            params.set('dns', dns);
        }

        // Reserved (Cloudflare WARP 等需要)
        if (proxy.reserved) {
            let reserved = proxy.reserved;
            if (Array.isArray(reserved)) {
                reserved = reserved.join(',');
            }
            params.set('reserved', reserved);
        }

        // Preshared Key
        if (proxy['preshared-key'] || proxy.presharedKey) {
            params.set('presharedkey', proxy['preshared-key'] || proxy.presharedKey);
        }

        // Keepalive
        if (proxy['persistent-keepalive'] || proxy.keepalive) {
            params.set('keepalive', String(proxy['persistent-keepalive'] || proxy.keepalive));
        }

        // UDP 支持
        if (proxy.udp !== undefined) {
            params.set('udp', proxy.udp ? '1' : '0');
        }

        // Peers (多节点配置)
        if (proxy.peers && Array.isArray(proxy.peers) && proxy.peers.length > 0) {
            const peer = proxy.peers[0];
            if (peer['public-key']) {
                params.set('publickey', peer['public-key']);
            }
            if (peer.endpoint) {
                params.set('endpoint', peer.endpoint);
            }
            if (peer['allowed-ips']) {
                let allowedIPs = peer['allowed-ips'];
                if (Array.isArray(allowedIPs)) {
                    allowedIPs = allowedIPs.join(',');
                }
                params.set('allowedips', allowedIPs);
            }
            if (peer['preshared-key']) {
                params.set('presharedkey', peer['preshared-key']);
            }
        }

        // 处理服务器地址 (支持 IPv6)
        let serverAddr = proxy.server;
        if (serverAddr.includes(':') && !serverAddr.startsWith('[')) {
            // IPv6 地址需要加方括号
            serverAddr = `[${serverAddr}]`;
        }

        // 构建 URL
        // 格式: wireguard://privatekey@server:port?params#name
        const url = `wireguard://${encodeURIComponent(proxy['private-key'])}@${serverAddr}:${proxy.port}?${params.toString()}`;

        // Fragment (节点名称)
        if (proxy.name) {
            return `${url}#${encodeURIComponent(proxy.name)}`;
        }

        return url;
    } catch (e) {
        console.error('WireGuard转换失败:', e);
        return null;
    }
}
