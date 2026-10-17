import { serializeXhttpExtra } from './xhttp-extra.js';

function base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function base64UrlSafeEncode(str) {
    return base64Encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function formatUriServer(server) {
    return server.includes(':') && !server.startsWith('[') ? `[${server}]` : server;
}

function appendHysteria2RealmParams(params, realmOpts) {
    if (!realmOpts || typeof realmOpts !== 'object') return;
    if (realmOpts['realm-id']) params.push(`realm-id=${encodeURIComponent(realmOpts['realm-id'])}`);
    if (realmOpts.token) params.push(`realm-token=${encodeURIComponent(realmOpts.token)}`);
    if (realmOpts['server-url'])
        params.push(`realm-server=${encodeURIComponent(realmOpts['server-url'])}`);
    if (Array.isArray(realmOpts['stun-servers']) && realmOpts['stun-servers'].length > 0) {
        params.push(`stun-servers=${encodeURIComponent(realmOpts['stun-servers'].join(','))}`);
    }
}

export function convertClashProxyToUrl(proxy) {
    try {
        const type = (proxy.type || '').toLowerCase();
        const name = proxy.name || 'Untitled';
        const server = proxy.server;
        const uriServer = formatUriServer(server);
        const port = proxy.port;

        if (!server || !port) return null;

        if (type === 'mieru') {
            const params = new URLSearchParams();
            for (const key of ['username', 'password', 'transport', 'udp', 'multiplexing', 'handshake-mode', 'mtu', 'profile']) {
                if (proxy[key] !== undefined && proxy[key] !== null) params.set(key, String(proxy[key]));
            }
            return `mierus://${formatUriServer(server)}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
        }

        if (type === 'http' || type === 'https') {
            const useTls = type === 'https' || proxy.tls === true;
            const scheme = useTls ? 'https' : 'http';
            const userInfo = proxy.username
                ? `${encodeURIComponent(proxy.username)}${proxy.password ? `:${encodeURIComponent(proxy.password)}` : ''}@`
                : '';
            const params = new URLSearchParams();
            if (useTls) {
                const sni = proxy.sni || proxy.servername;
                if (sni) params.set('sni', sni);
                if (proxy['skip-cert-verify'] !== undefined) {
                    params.set('allowInsecure', proxy['skip-cert-verify'] ? '1' : '0');
                }
                const fingerprint = proxy['client-fingerprint'] || proxy.fingerprint;
                if (fingerprint) params.set('fp', fingerprint);
                if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn);
            }
            const query = params.toString();
            return `${scheme}://${userInfo}${uriServer}:${port}${query ? `?${query}` : ''}#${encodeURIComponent(name)}`;
        }

        if (type === 'ss' || type === 'shadowsocks') {
            const userInfo = base64Encode(`${proxy.cipher}:${proxy.password}`);
            let url = `ss://${userInfo}@${uriServer}:${port}`;
            if (proxy.plugin) {
                const params = [];
                params.push(`plugin=${encodeURIComponent(proxy.plugin)}`);
                const pluginOpts = proxy['plugin-opts'];
                if (pluginOpts) {
                    if (pluginOpts.enabled !== undefined)
                        params.push(`enabled=${pluginOpts.enabled}`);
                    if (pluginOpts.padding !== undefined)
                        params.push(`padding=${pluginOpts.padding}`);
                    if (pluginOpts.mode) params.push(`obfs=${encodeURIComponent(pluginOpts.mode)}`);
                    if (pluginOpts.host)
                        params.push(`obfs-host=${encodeURIComponent(pluginOpts.host)}`);
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
            const network = proxy.network || 'tcp';
            const vmessConfig = {
                v: '2',
                ps: name,
                add: server,
                port,
                id: uuid,
                aid: proxy.alterId || 0,
                net: network,
                type: 'none',
                host: '',
                path: '',
                tls: proxy.tls ? 'tls' : '',
                sni: proxy.sni || proxy.servername || '',
                fp: proxy['client-fingerprint'] || '',
            };

            // Mapping network specific options
            if (network === 'ws') {
                const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
                if (wsOpts) {
                    vmessConfig.path = wsOpts.path || '';
                    if (wsOpts.headers?.Host) vmessConfig.host = wsOpts.headers.Host;
                }
            } else if (network === 'grpc') {
                const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
                if (grpcOpts) vmessConfig.path = grpcOpts['grpc-service-name'] || '';
            } else if (network === 'h2' || network === 'http') {
                const opts = proxy[`${network}-opts`] || proxy[`${network}Opts`];
                if (opts) {
                    vmessConfig.path = opts.path || '';
                    vmessConfig.host = Array.isArray(opts.host)
                        ? opts.host.join(',')
                        : opts.host || '';
                }
            } else if (network === 'quic') {
                const quicOpts = proxy['quic-opts'] || proxy.quicOpts;
                if (quicOpts) {
                    vmessConfig.type = quicOpts.header?.type || 'none';
                    vmessConfig.host = quicOpts.security || '';
                    vmessConfig.path = quicOpts.key || '';
                }
            }

            return `vmess://${base64Encode(JSON.stringify(vmessConfig))}`;
        }

        if (type === 'trojan') {
            const params = [];
            const network = proxy.network || 'tcp';
            if (network !== 'tcp') params.push(`type=${encodeURIComponent(network)}`);
            const wsOpts = proxy.wsOpts || proxy['ws-opts'];
            if (wsOpts) {
                if (wsOpts.path) params.push(`path=${encodeURIComponent(wsOpts.path)}`);
                if (wsOpts.headers?.Host)
                    params.push(`host=${encodeURIComponent(wsOpts.headers.Host)}`);
            }
            const grpcOpts = proxy.grpcOpts || proxy['grpc-opts'];
            if (grpcOpts) {
                if (grpcOpts['grpc-service-name'])
                    params.push(`serviceName=${encodeURIComponent(grpcOpts['grpc-service-name'])}`);
                if (grpcOpts['grpc-mode'])
                    params.push(`mode=${encodeURIComponent(grpcOpts['grpc-mode'])}`);
            }
            const sni = proxy.servername ?? proxy.sni;
            if (sni !== undefined) params.push(`sni=${encodeURIComponent(sni)}`);
            if (proxy['client-fingerprint'])
                params.push(`fp=${encodeURIComponent(proxy['client-fingerprint'])}`);
            if (proxy['dialer-proxy'])
                params.push(`dp=${encodeURIComponent(proxy['dialer-proxy'])}`);
            if (proxy.skipCertVerify || proxy['skip-cert-verify']) params.push('allowInsecure=1');
            const realityOpts = proxy['reality-opts'];
            if (realityOpts) {
                params.push('security=reality');
                if (realityOpts['public-key'])
                    params.push(`pbk=${encodeURIComponent(realityOpts['public-key'])}`);
                if (realityOpts['short-id'])
                    params.push(`sid=${encodeURIComponent(realityOpts['short-id'])}`);
                if (realityOpts['spider-x'])
                    params.push(`spx=${encodeURIComponent(realityOpts['spider-x'])}`);
                const sxm =
                    realityOpts['support-x25519mlkem768'] ?? realityOpts.support_x25519mlkem768;
                if (sxm !== undefined) {
                    if (sxm === false || sxm === 'false' || sxm === 0 || sxm === '0') {
                        params.push('support-x25519mlkem768=false');
                    } else if (sxm === true || sxm === 'true' || sxm === 1 || sxm === '1') {
                        params.push('support-x25519mlkem768=true');
                    }
                }
            }
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `trojan://${encodeURIComponent(proxy.password)}@${uriServer}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'vless') {
            const uuid = proxy.uuid || proxy.UUID;
            if (!uuid) return null;
            const params = ['encryption=none'];
            if (proxy.network) params.push(`type=${proxy.network}`);
            const wsOpts = proxy.wsOpts || proxy['ws-opts'];
            if (wsOpts) {
                if (wsOpts.path) params.push(`path=${encodeURIComponent(wsOpts.path)}`);
                if (wsOpts.headers?.Host)
                    params.push(`host=${encodeURIComponent(wsOpts.headers.Host)}`);
            }
            const grpcOpts = proxy.grpcOpts || proxy['grpc-opts'];
            if (grpcOpts) {
                if (grpcOpts['grpc-service-name'])
                    params.push(`serviceName=${encodeURIComponent(grpcOpts['grpc-service-name'])}`);
                if (grpcOpts['grpc-mode'])
                    params.push(`mode=${encodeURIComponent(grpcOpts['grpc-mode'])}`);
            }
            const httpupgradeOpts = proxy['httpupgrade-opts'] || proxy.httpupgradeOpts;
            if (httpupgradeOpts) {
                if (httpupgradeOpts.path)
                    params.push(`path=${encodeURIComponent(httpupgradeOpts.path)}`);
                if (httpupgradeOpts.host)
                    params.push(`host=${encodeURIComponent(httpupgradeOpts.host)}`);
            }
            const xhttpOpts = proxy['xhttp-opts'] || proxy.xhttpOpts;
            if (xhttpOpts) {
                if (xhttpOpts.path) params.push(`path=${encodeURIComponent(xhttpOpts.path)}`);
                // Clash 源的 headers 由人工书写，Host 的大小写不受约束。
                const headerHost = Object.entries(xhttpOpts.headers || {}).find(
                    ([key]) => key.toLowerCase() === 'host'
                )?.[1];
                const xhttpHost = xhttpOpts.host || headerHost;
                if (xhttpHost) params.push(`host=${encodeURIComponent(xhttpHost)}`);
                if (xhttpOpts.mode) params.push(`mode=${encodeURIComponent(xhttpOpts.mode)}`);
                const extraObj = serializeXhttpExtra(xhttpOpts);
                if (extraObj) {
                    params.push(`extra=${encodeURIComponent(JSON.stringify(extraObj))}`);
                }
            }
            const realityOpts = proxy['reality-opts'];
            if (realityOpts) {
                params.push('security=reality');
                if (realityOpts['public-key'])
                    params.push(`pbk=${encodeURIComponent(realityOpts['public-key'])}`);
                if (realityOpts['short-id'])
                    params.push(`sid=${encodeURIComponent(realityOpts['short-id'])}`);
                if (realityOpts['spider-x'])
                    params.push(`spx=${encodeURIComponent(realityOpts['spider-x'])}`);
                const sxm =
                    realityOpts['support-x25519mlkem768'] ?? realityOpts.support_x25519mlkem768;
                if (sxm !== undefined) {
                    if (sxm === false || sxm === 'false' || sxm === 0 || sxm === '0') {
                        params.push('support-x25519mlkem768=false');
                    } else if (sxm === true || sxm === 'true' || sxm === 1 || sxm === '1') {
                        params.push('support-x25519mlkem768=true');
                    }
                }
            } else if (proxy.tls) {
                params.push('security=tls');
            }
            if (proxy.flow) params.push(`flow=${proxy.flow}`);
            const sniVal = proxy.servername !== undefined ? proxy.servername : proxy.sni;
            if (sniVal !== undefined) params.push(`sni=${encodeURIComponent(sniVal)}`);
            if (proxy['client-fingerprint'])
                params.push(`fp=${encodeURIComponent(proxy['client-fingerprint'])}`);
            if (proxy['dialer-proxy'])
                params.push(`dp=${encodeURIComponent(proxy['dialer-proxy'])}`);
            return `vless://${uuid}@${uriServer}:${port}?${params.join('&')}#${encodeURIComponent(name)}`;
        }

        if (type === 'hysteria2' || type === 'hy2' || type === 'hy') {
            const params = [];
            const password = proxy.password || proxy.auth || '';
            if (proxy.obfs) params.push(`obfs=${encodeURIComponent(proxy.obfs)}`);
            if (proxy['obfs-password'])
                params.push(`obfs-password=${encodeURIComponent(proxy['obfs-password'])}`);
            const sni = proxy.servername ?? proxy.sni;
            if (sni !== undefined) params.push(`sni=${encodeURIComponent(sni)}`);
            if (proxy.skipCertVerify || proxy['skip-cert-verify']) params.push('insecure=1');
            if (proxy.ports !== undefined) params.push(`ports=${encodeURIComponent(proxy.ports)}`);
            if (proxy['hop-interval'] !== undefined)
                params.push(`hop-interval=${encodeURIComponent(proxy['hop-interval'])}`);
            if (proxy.up !== undefined || proxy['up-mbps'] !== undefined)
                params.push(`up=${encodeURIComponent(proxy.up ?? proxy['up-mbps'])}`);
            if (proxy.down !== undefined || proxy['down-mbps'] !== undefined)
                params.push(`down=${encodeURIComponent(proxy.down ?? proxy['down-mbps'])}`);
            if (proxy['fast-open'] !== undefined)
                params.push(`fast_open=${proxy['fast-open'] ? '1' : '0'}`);
            if (proxy['dialer-proxy'])
                params.push(`dp=${encodeURIComponent(proxy['dialer-proxy'])}`);
            appendHysteria2RealmParams(params, proxy['realm-opts']);
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `hysteria2://${encodeURIComponent(password)}@${uriServer}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'hysteria') {
            const params = [];
            const password = proxy.password || proxy.auth || '';
            if (proxy.protocol === 'udp') params.push('protocol=udp');
            if (proxy.sni !== undefined) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.skipCertVerify || proxy['skip-cert-verify']) params.push('insecure=1');
            if (proxy.up || proxy['up-mbps']) params.push(`up=${proxy.up || proxy['up-mbps']}`);
            if (proxy.down || proxy['down-mbps'])
                params.push(`down=${proxy.down || proxy['down-mbps']}`);
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `hysteria://${encodeURIComponent(password)}@${uriServer}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'socks5') {
            const auth =
                proxy.username && proxy.password
                    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
                    : '';
            return `socks5://${auth}${server}:${port}#${encodeURIComponent(name)}`;
        }

        if (type === 'http') {
            const auth =
                proxy.username && proxy.password
                    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
                    : '';
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
            if (proxy.ecn) params.push('ecn=true');
            const psk = proxy.psk || proxy.password || '';
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `snell://${encodeURIComponent(psk)}@${uriServer}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'naive' || proxy.protocol === 'naive') {
            const username = proxy.username || '';
            const password = proxy.password || '';
            const auth =
                username && password
                    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
                    : '';
            const params = [];
            if (proxy.padding !== undefined) params.push(`padding=${proxy.padding}`);
            if (proxy['extra-headers'])
                params.push(`extra-headers=${encodeURIComponent(proxy['extra-headers'])}`);
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            const scheme = proxy.quic ? 'naive+quic' : 'naive+https';
            return `${scheme}://${auth}${server}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'anytls') {
            const password = proxy.password || '';
            const params = [];
            if (proxy.sni !== undefined) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.alpn) {
                const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
                params.push(`alpn=${encodeURIComponent(alpn)}`);
            }
            if (proxy['skip-cert-verify']) params.push('insecure=1');
            const pinnedPeerCertSha256 =
                proxy.pinnedPeerCertSha256 ||
                proxy['pinned-peer-cert-sha256'] ||
                proxy['peer-cert-sha256'] ||
                proxy.certSha256;
            if (pinnedPeerCertSha256)
                params.push(`pinnedPeerCertSha256=${encodeURIComponent(pinnedPeerCertSha256)}`);
            if (proxy.padding !== undefined) params.push(`padding=${proxy.padding}`);
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `anytls://${encodeURIComponent(password)}@${uriServer}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'tuic') {
            const uuid = proxy.uuid || '';
            const password = proxy.password || proxy.token || '';
            const auth = password
                ? `${encodeURIComponent(uuid)}:${encodeURIComponent(password)}`
                : encodeURIComponent(uuid);
            const params = [];
            if (proxy.sni !== undefined) params.push(`sni=${encodeURIComponent(proxy.sni)}`);
            if (proxy.alpn) {
                const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
                params.push(`alpn=${encodeURIComponent(alpn)}`);
            }
            if (proxy['skip-cert-verify']) params.push('allow_insecure=1');
            const congestionControl =
                proxy['congestion-controller'] || proxy['congestion-control'] || proxy.congestion;
            if (congestionControl)
                params.push(`congestion_control=${encodeURIComponent(congestionControl)}`);
            if (proxy['udp-relay-mode'])
                params.push(`udp_relay_mode=${encodeURIComponent(proxy['udp-relay-mode'])}`);
            if (proxy['udp-over-stream'] !== undefined)
                params.push(`udp_over_stream=${proxy['udp-over-stream'] ? '1' : '0'}`);
            if (proxy['zero-rtt-handshake'] !== undefined)
                params.push(`zero_rtt_handshake=${proxy['zero-rtt-handshake'] ? '1' : '0'}`);
            else if (proxy['reduce-rtt'] !== undefined)
                params.push(`zero_rtt_handshake=${proxy['reduce-rtt'] ? '1' : '0'}`);
            if (proxy.heartbeat) params.push(`heartbeat=${encodeURIComponent(proxy.heartbeat)}`);
            if (proxy['heartbeat-interval'])
                params.push(
                    `heartbeat_interval=${encodeURIComponent(proxy['heartbeat-interval'])}`
                );
            if (proxy['request-timeout'])
                params.push(
                    `request_timeout=${encodeURIComponent(String(proxy['request-timeout']))}`
                );
            if (proxy.cwnd) params.push(`cwnd=${encodeURIComponent(String(proxy.cwnd))}`);
            if (proxy['bbr-profile'])
                params.push(`bbr_profile=${encodeURIComponent(proxy['bbr-profile'])}`);
            if (proxy['max-udp-relay-packet-size'])
                params.push(
                    `max_udp_relay_packet_size=${encodeURIComponent(String(proxy['max-udp-relay-packet-size']))}`
                );
            if (proxy['max-open-streams'])
                params.push(
                    `max_open_streams=${encodeURIComponent(String(proxy['max-open-streams']))}`
                );
            if (proxy['disable-sni'] !== undefined)
                params.push(`disable_sni=${proxy['disable-sni'] ? '1' : '0'}`);
            if (proxy['fast-open'] !== undefined)
                params.push(`fast_open=${proxy['fast-open'] ? '1' : '0'}`);
            if (proxy['dialer-proxy'])
                params.push(`dp=${encodeURIComponent(proxy['dialer-proxy'])}`);
            const query = params.length > 0 ? `?${params.join('&')}` : '';
            return `tuic://${auth}@${uriServer}:${port}${query}#${encodeURIComponent(name)}`;
        }

        if (type === 'wireguard') {
            if (!proxy['private-key'] || !proxy.server || !proxy.port) return null;
            const params = new URLSearchParams();
            if (proxy['public-key'] || proxy.publicKey)
                params.set('publickey', proxy['public-key'] || proxy.publicKey);
            // if (proxy.ip || proxy['local-address']) {
            //     const addr = Array.isArray(proxy.ip || proxy['local-address']) ? (proxy.ip || proxy['local-address']).join(',') : (proxy.ip || proxy['local-address']);
            //     params.set('address', addr);
            // }
            // IPv6 Support
            const addresses = [];
            const ipv4 = proxy.ip || proxy['local-address'];
            if (ipv4) {
                if (Array.isArray(ipv4)) {
                    addresses.push(...ipv4.filter(Boolean));
                } else {
                    addresses.push(ipv4);
                }
            }
            if (proxy.ipv6) {
                if (Array.isArray(proxy.ipv6)) {
                    addresses.push(...proxy.ipv6.filter(Boolean));
                } else {
                    addresses.push(proxy.ipv6);
                }
            }
            if (addresses.length > 0) {
                params.set('address', [...new Set(addresses)].join(','));
            }
            if (proxy['allowed-ips'] || proxy.allowedIPs) {
                const ips = Array.isArray(proxy['allowed-ips'] || proxy.allowedIPs)
                    ? (proxy['allowed-ips'] || proxy.allowedIPs).join(',')
                    : proxy['allowed-ips'] || proxy.allowedIPs;
                params.set('allowedips', ips);
            }
            if (proxy.reserved)
                params.set(
                    'reserved',
                    Array.isArray(proxy.reserved)
                        ? proxy.reserved.join(',')
                        : String(proxy.reserved)
                );
            if (proxy.mtu) params.set('mtu', String(proxy.mtu));
            if (proxy.dns)
                params.set('dns', Array.isArray(proxy.dns) ? proxy.dns.join(',') : proxy.dns);
            if (proxy['persistent-keepalive'])
                params.set('keepalive', String(proxy['persistent-keepalive']));
            if (proxy['preshared-key'] || proxy.presharedKey)
                params.set('presharedkey', proxy['preshared-key'] || proxy.presharedKey);
            let serverAddr = proxy.server;
            if (serverAddr.includes(':') && !serverAddr.startsWith('['))
                serverAddr = `[${serverAddr}]`;
            return `wireguard://${encodeURIComponent(proxy['private-key'])}@${serverAddr}:${proxy.port}?${params.toString()}#${encodeURIComponent(name)}`;
        }

        return null;
    } catch (e) {
        console.error('Error converting proxy:', e);
        return null;
    }
}
