/**
 * v2rayN 私有分享格式解析
 * 格式: v2rayn://<protocol>/<base64url(JSON)>
 *
 * 该 scheme 不在标准分享链接白名单内，需先解出 JSON 再转成标准分享 URI。
 * 拆成独立文件是为了让新增逻辑不污染 node-parser.js 的主流程。
 */

const V2RAYN_SCHEME = /^v2rayn:\/\/([a-z0-9+.-]+)\/(.+)$/i;

const V2RAYN_PROTOCOL_ALIAS = {
    hy2: 'hysteria2',
    hy: 'hysteria2',
    hysteria: 'hysteria2',
    hysteria2: 'hysteria2',
    ss: 'ss',
    shadowsocks: 'ss',
    vmess: 'vmess',
    vless: 'vless',
    trojan: 'trojan',
    tuic: 'tuic',
    anytls: 'anytls',
};

const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** 同步 SHA-256（Workers 无同步 crypto，用于从 PEM 算出证书指纹） */
function sha256Hex(bytes) {
    const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
    const len = bytes.length;
    const total = (((len + 8) >>> 6) + 1) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[len] = 0x80;
    const view = new DataView(buf.buffer);
    const bits = len * 8;
    view.setUint32(total - 8, Math.floor(bits / 0x100000000), false);
    view.setUint32(total - 4, bits >>> 0, false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let off = 0; off < total; off += 64) {
        for (let t = 0; t < 16; t++) w[t] = view.getUint32(off + t * 4, false);
        for (let t = 16; t < 64; t++) {
            const x = w[t - 15];
            const y = w[t - 2];
            const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
            const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
            w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let t = 0; t < 64; t++) {
            const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
            const ch = ((e & f) ^ (~e & g)) >>> 0;
            const t1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
            const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
            const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
            const t2 = (S0 + maj) >>> 0;
            h = g; g = f; f = e; e = (d + t1) >>> 0;
            d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** base64 / base64url -> Uint8Array */
function base64ToBytes(input) {
    let s = String(input).replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4;
    if (pad) s += '='.repeat(4 - pad);
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

/** PEM 证书 -> SHA-256 指纹（AA:BB:... 格式，供 pinSHA256 / fingerprint 使用） */
function certPemToPinSha256(pem) {
    if (!pem || typeof pem !== 'string') return '';
    // 先剥掉 BEGIN/END 标记行：否则 "BEGINCERTIFICATE" 这些字母本身就是合法 base64 字符，
    // 会被当成证书内容拼进去，导致算出的指纹完全错误
    const body = pem.replace(/-----[^-]+-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (body.length < 64) return '';
    try {
        const hex = sha256Hex(base64ToBytes(body));
        return hex.toUpperCase().match(/.{2}/g).join(':');
    } catch (e) {
        console.debug('[NodeParser] cert fingerprint failed:', e);
        return '';
    }
}

function decodeV2rayNJson(payload) {
    const clean = String(payload).split('#')[0].split('?')[0];
    try {
        const text = new TextDecoder('utf-8').decode(base64ToBytes(clean));
        const obj = JSON.parse(text);
        return obj && typeof obj === 'object' ? obj : null;
    } catch (e) {
        console.debug('[NodeParser] v2rayn payload decode failed:', e);
        return null;
    }
}

function v2rayNFlag(value) {
    if (value === true || value === 1) return true;
    const s = String(value ?? '').toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
}

function v2rayNHost(server) {
    return server.includes(':') && !server.startsWith('[') ? `[${server}]` : server;
}

/** v2rayN JSON 对象 -> 标准分享 URI */
function v2rayNToUri(tag, cfg) {
    const protocol = V2RAYN_PROTOCOL_ALIAS[String(tag || '').toLowerCase()];
    if (!protocol) return null;

    const server = cfg.Address || cfg.address || cfg.Server || cfg.server || '';
    const port = cfg.Port || cfg.port || '';
    if (!server || !port) return null;

    const host = v2rayNHost(String(server));
    const name = cfg.Remarks || cfg.remarks || cfg.Name || `${protocol}-${server}`;
    const sni = cfg.Sni || cfg.sni || cfg.ServerName || cfg.Host || '';
    const pin = certPemToPinSha256(cfg.Cert || cfg.cert || cfg.Certificate || '');
    // 有证书但算不出指纹时，必须跳过证书校验，否则客户端一定握手失败
    const insecure = v2rayNFlag(cfg.AllowInsecure ?? cfg.allowInsecure ?? cfg.Insecure) || (!pin && !!(cfg.Cert || cfg.cert));
    const extra = cfg.ProtoExtraObj || {};
    const up = cfg.UpMbps ?? extra.UpMbps ?? cfg.upMbps;
    const down = cfg.DownMbps ?? extra.DownMbps ?? cfg.downMbps;
    const password = cfg.Password || cfg.password || cfg.Auth || cfg.auth || '';

    if (protocol === 'hysteria2') {
        if (!password) return null;
        const params = new URLSearchParams();
        if (sni) params.set('sni', sni);
        params.set('insecure', insecure ? '1' : '0');
        if (pin) params.set('pinSHA256', pin);
        if (up !== undefined && up !== null && up !== '') params.set('up', `${up} Mbps`);
        if (down !== undefined && down !== null && down !== '') params.set('down', `${down} Mbps`);
        const obfs = cfg.Obfs || cfg.obfs;
        if (obfs && obfs !== 'none') {
            params.set('obfs', obfs);
            const obfsPwd = cfg.ObfsPassword || cfg['obfs-password'];
            if (obfsPwd) params.set('obfs-password', obfsPwd);
        }
        return `hysteria2://${encodeURIComponent(password)}@${host}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
    }

    if (protocol === 'trojan') {
        const params = new URLSearchParams();
        if (sni) params.set('sni', sni);
        if (insecure) params.set('allowInsecure', '1');
        if (pin) params.set('pinSHA256', pin);
        return `trojan://${encodeURIComponent(password)}@${host}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
    }

    if (protocol === 'anytls') {
        const params = new URLSearchParams();
        if (sni) params.set('sni', sni);
        if (insecure) params.set('insecure', '1');
        return `anytls://${encodeURIComponent(password)}@${host}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
    }

    if (protocol === 'tuic') {
        const uuid = cfg.Id || cfg.id || cfg.UUID || '';
        const params = new URLSearchParams();
        if (sni) params.set('sni', sni);
        if (insecure) params.set('allow_insecure', '1');
        if (cfg.CongestionControl || cfg.congestionControl) {
            params.set('congestion_control', cfg.CongestionControl || cfg.congestionControl);
        }
        return `tuic://${encodeURIComponent(uuid)}:${encodeURIComponent(password)}@${host}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
    }

    if (protocol === 'vless') {
        const uuid = cfg.Id || cfg.id || cfg.UUID || '';
        if (!uuid) return null;
        const params = new URLSearchParams();
        params.set('encryption', 'none');
        params.set('security', (cfg.StreamSecurity || cfg.streamSecurity || 'tls').toLowerCase());
        if (sni) params.set('sni', sni);
        if (cfg.Network || cfg.network) params.set('type', String(cfg.Network || cfg.network).toLowerCase());
        if (cfg.Path || cfg.path) params.set('path', cfg.Path || cfg.path);
        if (cfg.Host || cfg.host) params.set('host', cfg.Host || cfg.host);
        if (insecure) params.set('allowInsecure', '1');
        if (pin) params.set('pinSHA256', pin);
        return `vless://${uuid}@${host}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
    }

    if (protocol === 'vmess') {
        const uuid = cfg.Id || cfg.id || cfg.UUID || '';
        if (!uuid) return null;
        const vmessObj = {
            v: '2',
            ps: name,
            add: String(server),
            port: String(port),
            id: uuid,
            aid: String(cfg.AlterId ?? cfg.aid ?? 0),
            scy: cfg.Security || cfg.security || 'auto',
            net: String(cfg.Network || cfg.network || 'tcp').toLowerCase(),
            type: 'none',
            host: cfg.Host || cfg.host || sni || '',
            path: cfg.Path || cfg.path || '/',
            tls: (cfg.StreamSecurity || cfg.streamSecurity || '').toLowerCase() === 'tls' ? 'tls' : '',
            sni: sni || '',
        };
        return `vmess://${btoa(unescape(encodeURIComponent(JSON.stringify(vmessObj))))}`;
    }

    if (protocol === 'ss') {
        const method = cfg.Method || cfg.method || '';
        if (!method || !password) return null;
        const userInfo = btoa(unescape(encodeURIComponent(`${method}:${password}`)));
        return `ss://${userInfo}@${host}:${port}#${encodeURIComponent(name)}`;
    }

    return null;
}

/**
 * 解析单条 v2rayN 分享链接，返回标准分享 URI；无法识别时返回 null
 */
export function parseV2rayNLink(link) {
    if (!link || typeof link !== 'string') return null;
    const matched = V2RAYN_SCHEME.exec(link.trim());
    if (!matched) return null;

    const cfg = decodeV2rayNJson(matched[2]);
    if (!cfg) return null;

    const tag = cfg.Protocol || cfg.protocol || matched[1];
    const uri = v2rayNToUri(tag, cfg);
    if (!uri) {
        console.debug('[NodeParser] v2rayn 无法识别协议或缺少必要字段:', tag);
        return null;
    }
    return uri;
}
