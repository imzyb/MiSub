/**
 * sing-box 出站配置 → 节点链接 的最小实现。
 *
 * 仅覆盖可无损映射回 URL 的代理类型（vless / vmess / trojan / shadowsocks /
 * hysteria2 / tuic / anytls）。selector / urltest / direct / block / dns 等
 * 非节点出站会被忽略。
 *
 * 返回链接数组；无法识别的出站跳过。
 */

function toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

function b64url(input) {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function tlsParams(outbound) {
    const tls = outbound.tls || {};
    const params = [];
    if (tls.enabled) {
        if (tls.server_name) params.push(['sni', tls.server_name]);
        if (tls.insecure) params.push(['allowInsecure', '1']);
        if (tls.alpn) params.push(['alpn', toArray(tls.alpn).join(',')]);
        const reality = tls.reality || {};
        if (reality.enabled) {
            params.push(['security', 'reality']);
            if (reality.public_key) params.push(['pbk', reality.public_key]);
            if (reality.short_id) params.push(['sid', reality.short_id]);
        } else {
            params.push(['security', 'tls']);
        }
    }
    if (outbound.flow) params.push(['flow', outbound.flow]);
    const transport = outbound.transport || {};
    if (transport.type && transport.type !== 'tcp') {
        params.push(['type', transport.type]);
        if (transport.path) params.push(['path', transport.path]);
        if (transport.host) params.push(['host', transport.host]);
        if (transport.service_name) params.push(['serviceName', transport.service_name]);
    }
    return params;
}

function buildQuery(params) {
    const search = new URLSearchParams();
    for (const [key, value] of params) {
        if (value !== undefined && value !== null && value !== '') search.set(key, value);
    }
    const qs = search.toString();
    return qs ? `?${qs}` : '';
}

/**
 * @param {object} ob sing-box outbound 对象
 * @returns {string|null} 节点链接，或 null（不支持）
 */
export function singboxOutboundToUrl(ob) {
    if (!ob || typeof ob !== 'object') return null;
    const type = String(ob.type || '').toLowerCase();
    const server = ob.server;
    const port = ob.server_port ?? ob.port;
    const name = ob.tag || '';
    if (!server || !port) return null;

    const hash = name ? `#${encodeURIComponent(name)}` : '';

    switch (type) {
        case 'vless': {
            const params = tlsParams(ob);
            if (ob.encryption) params.push(['encryption', ob.encryption]);
            else params.push(['encryption', 'none']);
            return `vless://${ob.uuid}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        case 'vmess': {
            const obj = {
                v: '2',
                ps: name,
                add: server,
                port: String(port),
                id: ob.uuid,
                aid: String(ob.alter_id ?? 0),
                scy: ob.security || 'auto',
                net: (ob.transport && ob.transport.type) || 'tcp',
                type: 'none',
                host: (ob.transport && ob.transport.host) || '',
                path: (ob.transport && ob.transport.path) || '',
                tls: ob.tls && ob.tls.enabled ? 'tls' : '',
                sni: (ob.tls && ob.tls.server_name) || '',
            };
            return `vmess://${b64url(JSON.stringify(obj))}`;
        }
        case 'trojan': {
            const params = tlsParams(ob);
            return `trojan://${encodeURIComponent(ob.password || '')}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        case 'shadowsocks': {
            const method = ob.method || 'aes-256-gcm';
            const pwd = ob.password || '';
            const userinfo = btoa(unescape(encodeURIComponent(`${method}:${pwd}`))).replace(
                /=+$/,
                ''
            );
            return `ss://${userinfo}@${server}:${port}${hash}`;
        }
        case 'hysteria2':
        case 'hy2': {
            const params = tlsParams(ob);
            if (ob.obfs && ob.obfs.type) {
                params.push(['obfs', ob.obfs.type]);
                if (ob.obfs.password) params.push(['obfs-password', ob.obfs.password]);
            }
            return `hysteria2://${encodeURIComponent(ob.password || '')}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        case 'tuic': {
            const params = tlsParams(ob);
            if (ob.congestion_control) params.push(['congestion_control', ob.congestion_control]);
            const auth = `${ob.uuid || ''}:${ob.password || ''}`;
            return `tuic://${auth}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        case 'anytls': {
            const params = tlsParams(ob);
            return `anytls://${encodeURIComponent(ob.password || '')}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        default:
            return null;
    }
}

/**
 * 从 sing-box 配置对象中提取节点链接。
 * @param {object} config 解析后的 sing-box 配置
 * @returns {string[]}
 */
export function extractSingboxNodes(config) {
    if (!config || typeof config !== 'object') return [];
    const outbounds = toArray(config.outbounds);
    return outbounds.map(singboxOutboundToUrl).filter(Boolean);
}
