function base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function base64UrlSafeEncode(str) {
    return base64Encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function convertClashProxyToUrl(proxy) {
    try {
        const type = (proxy.type || '').toLowerCase();
        const name = proxy.name || 'Untitled';
        const server = proxy.server;
        const port = proxy.port;

        if (!server || !port) return null;

        if (type === 'ss' || type === 'shadowsocks') {
            const userInfo = base64Encode(`${proxy.cipher}:${proxy.password}`);
            let url = `ss://${userInfo}@${server}:${port}`;
            if (proxy.plugin === 'anytls' || proxy.plugin === 'obfs-local') {
                const params = [];
                if (proxy.plugin) params.push(`plugin=${proxy.plugin}`);
                const pluginOpts = proxy['plugin-opts'];
                if (pluginOpts) {
                    if (pluginOpts.enabled !== undefined) params.push(`enabled=${pluginOpts.enabled}`);
                    if (pluginOpts.padding !== undefined) params.push(`padding=${pluginOpts.padding}`);
                    if (pluginOpts.mode) params.push(`obfs=${pluginOpts.mode}`);
                    if (pluginOpts.host) params.push(`obfs-host=${encodeURIComponent(pluginOpts.host)}`);
                }
                if (params.length > 0) url += `?${params.join('&')}`;
            }
            return `${url}#${encodeURIComponent(name)}`;
        }

        if (type === 'ssr' || type === 'shadowsocksr') {
            const password = base64UrlSafeEncode(proxy.password);
            const params = `obfs=${proxy.obfs || 'plain'}&obfsparam=${base64UrlSafeEncode(proxy['obfs-param'] || '')}&protocol=${proxy.protocol || 'origin'}&protoparam=${base64UrlSafeEncode(proxy['protocol-param'] || '')}&remarks=${base64UrlSafeEncode(name)}`;
            const ssrBody = `${server}:${port}:${proxy.protocol || 'origin'}:${proxy.cipher || 'none'}:${proxy.obfs || 'plain'}:${password}/?${params}`;
            return `ssr://${base64UrlSafeEncode(ssrBody)}`;
        }

        if (type === 'vmess') {
            const uuid = proxy.uuid || proxy.UUID || '';
            const vmessConfig = {
                v: '2',
                ps: name,
                add: server,
                port,
                id: uuid,
                aid: proxy.alterId || 0,
                net: proxy.network || 'tcp',
                type: 'none',
                host: proxy.servername || proxy.wsOpts?.headers?.Host || proxy['ws-opts']?.headers?.Host || '',
                path: proxy.wsOpts?.path || proxy['ws-opts']?.path || '',
                tls: proxy.tls ? 'tls' : ''
            };
            return `vmess://${base64Encode(JSON.stringify(vmessConfig))}`;
        }

        if (type === 'trojan') {
            const params = [];
            const network = proxy.network || 'tcp';
            if (network === 'ws') params.push('type=ws');
            const wsOpts = proxy.wsOpts || proxy['ws-opts'];
            if (wsOpts) {
                if (wsOpts.path) params.push(`path=${encodeURIComponent(wsOpts.path)}`);
                if (wsOpts.headers?.Host) params.push(`host=${encodeURIComponent(wsOpts.headers.Host)}`);
            }
            if (proxy.sni) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.skipCertVerify || proxy['skip-cert-verify']) params.push('allowInsecure=1');
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `trojan://${encodeURIComponent(proxy.password)}@${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'vless') {
            const uuid = proxy.uuid || proxy.UUID;
            if (!uuid) return null;
            const params = ['encryption=none'];
            if (proxy.network) params.push(`type=${proxy.network}`);
            const wsOpts = proxy.wsOpts || proxy['ws-opts'];
            if (wsOpts) {
                if (wsOpts.path) params.push(`path=${encodeURIComponent(wsOpts.path)}`);
                if (wsOpts.headers?.Host) params.push(`host=${encodeURIComponent(wsOpts.headers.Host)}`);
            }
            const realityOpts = proxy['reality-opts'];
            if (realityOpts) {
                params.push('security=reality');
                if (realityOpts['public-key']) params.push(`pbk=${encodeURIComponent(realityOpts['public-key'])}`);
                if (realityOpts['short-id']) params.push(`sid=${encodeURIComponent(realityOpts['short-id'])}`);
            } else if (proxy.tls) {
                params.push('security=tls');
            }
            if (proxy.flow) params.push(`flow=${proxy.flow}`);
            if (proxy.servername || proxy.sni) params.push(`sni=${encodeURIComponent(proxy.servername || proxy.sni)}`);
            if (proxy['client-fingerprint']) params.push(`fp=${encodeURIComponent(proxy['client-fingerprint'])}`);
            if (proxy['dialer-proxy']) params.push(`dp=${encodeURIComponent(proxy['dialer-proxy'])}`);
            return `vless://${uuid}@${server}:${port}?${params.join('&')}#${encodeURIComponent(name)}`;
        }

        if (type === 'hysteria2' || type === 'hy2' || type === 'hy') {
            const params = [];
            const password = proxy.password || proxy.auth || '';
            if (proxy.obfs) params.push(`obfs=${encodeURIComponent(proxy.obfs)}`);
            if (proxy['obfs-password']) params.push(`obfs-password=${encodeURIComponent(proxy['obfs-password'])}`);
            if (proxy.sni) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.skipCertVerify || proxy['skip-cert-verify']) params.push('insecure=1');
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `hysteria2://${encodeURIComponent(password)}@${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'hysteria') {
            const params = [];
            const password = proxy.password || proxy.auth || '';
            if (proxy.protocol === 'udp') params.push('protocol=udp');
            if (proxy.sni) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.skipCertVerify || proxy['skip-cert-verify']) params.push('insecure=1');
            if (proxy.up || proxy['up-mbps']) params.push(`up=${proxy.up || proxy['up-mbps']}`);
            if (proxy.down || proxy['down-mbps']) params.push(`down=${proxy.down || proxy['down-mbps']}`);
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `hysteria://${encodeURIComponent(password)}@${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'socks5') {
            const auth = proxy.username && proxy.password ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@` : '';
            return `socks5://${auth}${server}:${port}#${encodeURIComponent(name)}`;
        }

        if (type === 'http') {
            const auth = proxy.username && proxy.password ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@` : '';
            return `http://${auth}${server}:${port}#${encodeURIComponent(name)}`;
        }

        if (type === 'snell') {
            const params = [];
            if (proxy.version) params.push(`version=${proxy.version}`);
            if (proxy.reuse !== undefined) params.push(`reuse=${proxy.reuse}`);
            if (proxy.tfo !== undefined) params.push(`tfo=${proxy.tfo}`);
            const obfsOpts = proxy['obfs-opts'] || proxy.pluginOpts;
            if (obfsOpts) {
                if (obfsOpts.mode) params.push(`obfs=${obfsOpts.mode}`);
                if (obfsOpts.host) params.push(`obfs-host=${encodeURIComponent(obfsOpts.host)}`);
            }
            const psk = proxy.psk || proxy.password || '';
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `snell://${encodeURIComponent(psk)}@${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'naive' || proxy.protocol === 'naive') {
            const username = proxy.username || '';
            const password = proxy.password || '';
            const auth = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
            const params = [];
            if (proxy.padding !== undefined) params.push(`padding=${proxy.padding}`);
            if (proxy['extra-headers']) params.push(`extra-headers=${encodeURIComponent(proxy['extra-headers'])}`);
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            const scheme = proxy.quic ? 'naive+quic' : 'naive+https';
            return `${scheme}://${auth}${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'anytls') {
            const password = proxy.password || '';
            const params = [];
            if (proxy.sni) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.alpn) {
                const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
                params.push(`alpn=${encodeURIComponent(alpn)}`);
            }
            if (proxy['skip-cert-verify']) params.push('insecure=1');
            if (proxy.padding !== undefined) params.push(`padding=${proxy.padding}`);
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `anytls://${encodeURIComponent(password)}@${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'wireguard') {
            if (!proxy['private-key'] || !proxy.server || !proxy.port) return null;
            const params = new URLSearchParams();
            if (proxy['public-key'] || proxy.publicKey) params.set('publickey', proxy['public-key'] || proxy.publicKey);
            if (proxy.ip || proxy['local-address']) {
                const addr = Array.isArray(proxy.ip || proxy['local-address']) ? (proxy.ip || proxy['local-address']).join(',') : (proxy.ip || proxy['local-address']);
                params.set('address', addr);
            }
            if (proxy['allowed-ips'] || proxy.allowedIPs) {
                const ips = Array.isArray(proxy['allowed-ips'] || proxy.allowedIPs) ? (proxy['allowed-ips'] || proxy.allowedIPs).join(',') : (proxy['allowed-ips'] || proxy.allowedIPs);
                params.set('allowedips', ips);
            }
            if (proxy.reserved) params.set('reserved', Array.isArray(proxy.reserved) ? proxy.reserved.join(',') : String(proxy.reserved));
            if (proxy.mtu) params.set('mtu', String(proxy.mtu));
            if (proxy.dns) params.set('dns', Array.isArray(proxy.dns) ? proxy.dns.join(',') : proxy.dns);
            if (proxy['persistent-keepalive']) params.set('keepalive', String(proxy['persistent-keepalive']));
            if (proxy['preshared-key'] || proxy.presharedKey) params.set('presharedkey', proxy['preshared-key'] || proxy.presharedKey);
            let serverAddr = proxy.server;
            if (serverAddr.includes(':') && !serverAddr.startsWith('[')) serverAddr = `[${serverAddr}]`;
            return `wireguard://${encodeURIComponent(proxy['private-key'])}@${serverAddr}:${proxy.port}?${params.toString()}#${encodeURIComponent(name)}`;
        }

        return null;
    } catch (e) {
        console.error('Error converting proxy:', e);
        return null;
    }
}
