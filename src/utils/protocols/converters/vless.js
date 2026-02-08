/**
 * VLESS配置转换为URL
 * 支持完整参数：TLS、Reality、WebSocket、gRPC、HTTP/2、HTTPUpgrade
 */
export function convertVlessToUrl(proxy) {
    try {
        // 兼容 uuid 和 UUID 两种写法
        const uuid = proxy.uuid || proxy.UUID;
        if (!proxy.server || !proxy.port || !uuid) {
            return null;
        }

        const params = new URLSearchParams();

        // 基础参数
        params.set('encryption', proxy.encryption || 'none');

        // 传输类型
        const network = proxy.network || 'tcp';
        params.set('type', network);

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
                    if (proxy['ws-opts']['max-early-data']) {
                        params.set('ed', proxy['ws-opts']['max-early-data']);
                    }
                    if (proxy['ws-opts']['early-data-header-name']) {
                        params.set('eh', proxy['ws-opts']['early-data-header-name']);
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
                            ? proxy['h2-opts'].host.join(',')
                            : proxy['h2-opts'].host;
                        params.set('host', hosts);
                    }
                }
                break;

            case 'httpupgrade':
                if (proxy['httpupgrade-opts']) {
                    if (proxy['httpupgrade-opts'].path) {
                        params.set('path', proxy['httpupgrade-opts'].path);
                    }
                    if (proxy['httpupgrade-opts'].host) {
                        params.set('host', proxy['httpupgrade-opts'].host);
                    }
                }
                break;

            case 'splithttp':
                if (proxy['splithttp-opts']) {
                    if (proxy['splithttp-opts'].path) {
                        params.set('path', proxy['splithttp-opts'].path);
                    }
                    if (proxy['splithttp-opts'].host) {
                        params.set('host', proxy['splithttp-opts'].host);
                    }
                }
                break;

            case 'tcp':
                // TCP with HTTP header
                if (proxy['http-opts']) {
                    params.set('headerType', 'http');
                    if (proxy['http-opts'].path) {
                        const paths = Array.isArray(proxy['http-opts'].path)
                            ? proxy['http-opts'].path[0]
                            : proxy['http-opts'].path;
                        params.set('path', paths);
                    }
                    if (proxy['http-opts'].headers?.Host) {
                        const hosts = Array.isArray(proxy['http-opts'].headers.Host)
                            ? proxy['http-opts'].headers.Host[0]
                            : proxy['http-opts'].headers.Host;
                        params.set('host', hosts);
                    }
                }
                break;
        }

        // Flow 流控
        if (proxy.flow) {
            params.set('flow', proxy.flow);
        }

        // TLS/Reality 安全配置
        // 修复: Clash 配置使用 reality-opts 字段，不是 reality 布尔值
        if (proxy['reality-opts'] || proxy.reality) {
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
        } else if (proxy.tls) {
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
        } else {
            params.set('security', 'none');
        }

        // dialer-proxy 链式代理支持 (使用自定义参数 dp)
        if (proxy['dialer-proxy']) {
            params.set('dp', proxy['dialer-proxy']);
        }

        // 构建 URL
        const url = `vless://${uuid}@${proxy.server}:${proxy.port}?${params.toString()}`;

        // Fragment (节点名称)
        if (proxy.name) {
            return `${url}#${encodeURIComponent(proxy.name)}`;
        }

        return url;
    } catch (e) {
        console.error('VLESS转换失败:', e);
        return null;
    }
}
