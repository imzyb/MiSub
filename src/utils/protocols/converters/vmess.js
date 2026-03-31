import { base64Encode } from '../common/base64.js';

/**
 * VMess配置转换为URL
 * 支持完整参数：TLS、WebSocket、gRPC、HTTP/2、fingerprint
 */
export function convertVmessToUrl(proxy) {
    try {
        // 兼容 uuid 和 UUID 两种写法
        const uuid = proxy.uuid || proxy.UUID;
        if (!proxy.server || !proxy.port || !uuid) {
            return null;
        }

        const config = {
            v: "2",
            ps: proxy.name || proxy['server-name'] || 'VMess',
            add: proxy.server,
            port: String(proxy.port),
            id: uuid || proxy['client-id'] || '',
            aid: String(proxy.alterId || proxy['alter-id'] || 0),
            scy: proxy.cipher || 'auto',  // 加密方式
            net: proxy.network || 'tcp',
            type: 'none',  // HTTP 伪装类型
            host: '',
            path: '',
            tls: proxy.tls ? 'tls' : '',
            sni: '',
            alpn: '',
            fp: ''  // fingerprint
        };

        // 处理不同的网络类型
        switch (config.net) {
            case 'ws':
                if (proxy['ws-opts']) {
                    config.host = proxy['ws-opts']['headers']?.Host || '';
                    config.path = proxy['ws-opts'].path || '/';
                    // Early data
                    if (proxy['ws-opts']['max-early-data']) {
                        config.path += `?ed=${proxy['ws-opts']['max-early-data']}`;
                    }
                }
                break;

            case 'grpc':
                if (proxy['grpc-opts']) {
                    config.path = proxy['grpc-opts']['grpc-service-name'] || '';
                    config.type = proxy['grpc-opts']['grpc-mode'] || 'gun';
                }
                break;

            case 'h2':
                if (proxy['h2-opts']) {
                    config.path = proxy['h2-opts'].path || '/';
                    if (proxy['h2-opts'].host) {
                        config.host = Array.isArray(proxy['h2-opts'].host)
                            ? proxy['h2-opts'].host.join(',')
                            : proxy['h2-opts'].host;
                    }
                }
                break;

            case 'http':
                config.net = 'tcp';
                config.type = 'http';
                if (proxy['http-opts']) {
                    if (proxy['http-opts'].path) {
                        config.path = Array.isArray(proxy['http-opts'].path)
                            ? proxy['http-opts'].path[0]
                            : proxy['http-opts'].path;
                    }
                    if (proxy['http-opts'].headers?.Host) {
                        config.host = Array.isArray(proxy['http-opts'].headers.Host)
                            ? proxy['http-opts'].headers.Host[0]
                            : proxy['http-opts'].headers.Host;
                    }
                }
                break;

            case 'tcp':
                // TCP with HTTP 伪装
                if (proxy['http-opts']) {
                    config.type = 'http';
                    if (proxy['http-opts'].path) {
                        config.path = Array.isArray(proxy['http-opts'].path)
                            ? proxy['http-opts'].path[0]
                            : proxy['http-opts'].path;
                    }
                    if (proxy['http-opts'].headers?.Host) {
                        config.host = Array.isArray(proxy['http-opts'].headers.Host)
                            ? proxy['http-opts'].headers.Host[0]
                            : proxy['http-opts'].headers.Host;
                    }
                }
                break;
        }

        // TLS 相关配置
        if (proxy.tls) {
            config.tls = 'tls';

            // SNI
            if (proxy.servername || proxy.sni) {
                config.sni = proxy.servername || proxy.sni;
            }

            // Fingerprint
            if (proxy['client-fingerprint'] || proxy.fingerprint) {
                config.fp = proxy['client-fingerprint'] || proxy.fingerprint;
            }

            // ALPN
            if (proxy.alpn) {
                config.alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            }

            // 跳过证书验证 (非标准字段，部分客户端支持)
            if (proxy['skip-cert-verify']) {
                config.allowInsecure = '1';
            }
        }

        // 清理空字段，减少 URL 长度
        const cleanConfig = {};
        for (const [key, value] of Object.entries(config)) {
            if (value !== '' && value !== undefined && value !== null) {
                cleanConfig[key] = value;
            }
        }

        return 'vmess://' + base64Encode(JSON.stringify(cleanConfig));
    } catch (e) {
        console.error('VMess转换失败:', e);
        return null;
    }
}
