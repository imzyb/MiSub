/**
 * Hysteria/Hysteria2配置转换为URL
 * 支持完整参数：TLS、端口跳跃、混淆、带宽限制
 */
export function convertHysteriaToUrl(proxy) {
    try {
        if (!proxy.server || !proxy.port) {
            return null;
        }

        const isHysteria2 = proxy.type === 'hysteria2' || proxy.type === 'hy2';
        const protocol = isHysteria2 ? 'hysteria2' : 'hysteria';

        // 获取认证信息
        const auth = proxy.password || proxy.auth || proxy['auth-str'] || '';

        if (!auth) {
            return null;
        }

        // 处理端口（支持端口跳跃）
        let portStr = String(proxy.port);
        if (proxy.ports) {
            // 端口跳跃: "1000-2000" 或 "1000,2000,3000"
            portStr = proxy.ports;
        }

        // 构建基础 URL
        let url = `${protocol}://${encodeURIComponent(auth)}@${proxy.server}:${portStr}`;

        const params = new URLSearchParams();

        // Hysteria1 特有参数
        if (!isHysteria2) {
            if (proxy.protocol) {
                params.set('protocol', proxy.protocol);
            }
            if (proxy['auth-str']) {
                params.set('auth', proxy['auth-str']);
            }
            // 上下行带宽 (Hysteria1 必须)
            if (proxy.up) {
                params.set('upmbps', String(proxy.up).replace(/\D/g, ''));
            }
            if (proxy.down) {
                params.set('downmbps', String(proxy.down).replace(/\D/g, ''));
            }
        }

        // 通用 TLS 参数
        if (proxy.sni || proxy.servername) {
            params.set('sni', proxy.sni || proxy.servername);
        }

        if (proxy['client-fingerprint'] || proxy.fingerprint) {
            params.set('pinSHA256', proxy['client-fingerprint'] || proxy.fingerprint);
        }

        // ALPN
        if (proxy.alpn) {
            const alpn = Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn;
            params.set('alpn', alpn);
        }

        // 混淆配置
        if (isHysteria2) {
            // Hysteria2 混淆
            if (proxy.obfs) {
                params.set('obfs', proxy.obfs);
            }
            if (proxy['obfs-password']) {
                params.set('obfs-password', proxy['obfs-password']);
            }
        } else {
            // Hysteria1 混淆
            if (proxy.obfs) {
                if (typeof proxy.obfs === 'string') {
                    params.set('obfs', proxy.obfs);
                } else if (proxy.obfs.type) {
                    params.set('obfs', proxy.obfs.type);
                    if (proxy.obfs.host) {
                        params.set('obfsParam', proxy.obfs.host);
                    }
                }
            }
        }

        // 跳过证书验证
        if (proxy['skip-cert-verify'] !== undefined) {
            params.set('insecure', proxy['skip-cert-verify'] ? '1' : '0');
        }

        // 快速打开
        if (proxy['fast-open'] !== undefined) {
            params.set('fastopen', proxy['fast-open'] ? '1' : '0');
        }

        // Lazy 模式 (Hysteria2)
        if (isHysteria2 && proxy.lazy !== undefined) {
            params.set('lazy', proxy.lazy ? '1' : '0');
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
        console.error('Hysteria转换失败:', e);
        return null;
    }
}
