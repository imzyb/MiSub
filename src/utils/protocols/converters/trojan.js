/**
 * Trojan配置转换为URL
 * 支持完整参数：TLS、Reality、WebSocket、gRPC、fingerprint
 */
export function convertTrojanToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port || !proxy.password) {
            return null;
        }

        const params = new URLSearchParams();

        // 传输类型
        const network = proxy.network || 'tcp';
        if (network !== 'tcp') {
            params.set('type', network);
        }

        // 传输层配置
        switch (network) {
            case 'ws':
                if (proxy['ws-opts']) {
                    if (proxy['ws-opts'].path) {
                        params.set('path', proxy['ws-opts'].path);
                    }
                    if (proxy['ws-opts']['headers']?.Host) {
                        params.set('host', proxy['ws-opts']['headers'].Host);
                    }
                }
                break;

            case 'grpc':
                if (proxy['grpc-opts']) {
                    if (proxy['grpc-opts']['grpc-service-name']) {
                        params.set('serviceName', proxy['grpc-opts']['grpc-service-name']);
                    }
                    if (proxy['grpc-opts']['grpc-mode']) {
                        params.set('mode', proxy['grpc-opts']['grpc-mode']);
                    }
                }
                break;

            case 'h2':
                if (proxy['h2-opts']) {
                    if (proxy['h2-opts'].path) {
                        params.set('path', proxy['h2-opts'].path);
                    }
                    if (proxy['h2-opts'].host) {
                        const hosts = Array.isArray(proxy['h2-opts'].host)
                            ? proxy['h2-opts'].host[0]
                            : proxy['h2-opts'].host;
                        params.set('host', hosts);
                    }
                }
                break;
        }

        // Flow 流控 (XTLS)
        if (proxy.flow) {
            params.set('flow', proxy.flow);
        }

        // TLS/Reality 安全配置
        if (proxy.reality) {
            params.set('security', 'reality');
            if (proxy['reality-opts']) {
                if (proxy['reality-opts']['public-key']) {
                    params.set('pbk', proxy['reality-opts']['public-key']);
                }
                if (proxy['reality-opts']['short-id']) {
                    params.set('sid', proxy['reality-opts']['short-id']);
                }
                if (proxy['reality-opts']['spider-x']) {
                    params.set('spx', proxy['reality-opts']['spider-x']);
                }
            }
            // Reality SNI
            if (proxy.servername || proxy.sni) {
                params.set('sni', proxy.servername || proxy.sni);
            }
            // Reality fingerprint
            if (proxy['client-fingerprint'] || proxy.fingerprint) {
                params.set('fp', proxy['client-fingerprint'] || proxy.fingerprint);
            }
        } else {
            // 默认 TLS (Trojan 基本都是 TLS)
            params.set('security', 'tls');

            // TLS SNI
            if (proxy.servername || proxy.sni) {
                params.set('sni', proxy.servername || proxy.sni);
            }

            // TLS Fingerprint
            if (proxy['client-fingerprint'] || proxy.fingerprint) {
                params.set('fp', proxy['client-fingerprint'] || proxy.fingerprint);
            }

            // ALPN
            if (proxy.alpn) {
                const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
                params.set('alpn', alpn);
            }

            // 跳过证书验证
            if (proxy['skip-cert-verify'] !== undefined) {
                params.set('allowInsecure', proxy['skip-cert-verify'] ? '1' : '0');
            }
        }

        // 构建 URL
        let url = `trojan://${encodeURIComponent(proxy.password)}@${proxy.server}:${proxy.port}`;

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
        console.error('Trojan转换失败:', e);
        return null;
    }
}
