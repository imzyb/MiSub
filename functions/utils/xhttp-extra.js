/**
 * VLESS xHTTP extra 字段双向映射。
 *
 * 字段表以 mihomo 的 common/convert/v.go 与 adapter/outbound/vless.go 为准。
 * 这里保持纯函数、不负责 URL 解析；除 REALITY 缺公钥的告警外不写日志，
 * 避免转换逻辑和 HTTP 细节互相牵扯。
 */

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// mihomo 中这些字段最终按字符串读取，空串等同于“未配置”；
// 直接丢弃空值，避免生成会覆盖默认值的空配置。
function setNonEmptyString(source, sourceKey, target, targetKey) {
    const value = source[sourceKey];
    if (typeof value === 'string' && value !== '') {
        target[targetKey] = value;
    }
}

// mihomo 的头表是 map[string]string；extra 由外部 JSON 控制，
// 非字符串值会让整份配置解码失败，因此按字段类型不符处理并跳过。
function copyStringHeaders(headers) {
    const result = {};
    for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string') {
            result[key] = value;
        }
    }
    return result;
}

// Xray 的 StringList 同时接受数组与逗号分隔字符串（infra/conf/common.go），
// 两种形态都要保留；空列表视为未配置。
function readStringList(value) {
    if (Array.isArray(value)) {
        const list = value.filter((item) => typeof item === 'string' && item !== '');
        return list.length > 0 ? list : null;
    }
    if (typeof value === 'string' && value !== '') {
        const list = value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item !== '');
        return list.length > 0 ? list : null;
    }
    return null;
}

// Xray 的分包参数允许数字或区间字符串，mihomo 的配置层统一按字符串处理。
function setRangeField(source, sourceKey, target, targetKey) {
    const value = source[sourceKey];
    if (typeof value === 'string' && value !== '') {
        target[targetKey] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
        target[targetKey] = String(Math.trunc(value));
    }
}

function xmuxToReuseSettings(xmux) {
    const reuse = {};
    const set = (sourceKey, targetKey) => {
        const value = xmux[sourceKey];
        if (typeof value === 'string') {
            if (value !== '') reuse[targetKey] = value;
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            reuse[targetKey] = String(Math.trunc(value));
        }
    };
    set('maxConnections', 'max-connections');
    set('maxConcurrency', 'max-concurrency');
    set('cMaxReuseTimes', 'c-max-reuse-times');
    set('hMaxRequestTimes', 'h-max-request-times');
    set('hMaxReusableSecs', 'h-max-reusable-secs');
    // mihomo 把该值当整数秒读取，写成字符串会被拒绝。
    if (typeof xmux.hKeepAlivePeriod === 'number' && Number.isFinite(xmux.hKeepAlivePeriod)) {
        reuse['h-keep-alive-period'] = Math.trunc(xmux.hKeepAlivePeriod);
    }
    return reuse;
}

function parseDownloadSettings(settings) {
    const ds = {};

    setNonEmptyString(settings, 'address', ds, 'server');
    if (typeof settings.port === 'number' && Number.isFinite(settings.port)) {
        ds.port = Math.trunc(settings.port);
    }

    // Xray 的 downloadSettings 是独立 StreamConfig，security 缺省即 none；
    // 这里只负责把“有 TLS / REALITY”映射为 true，false 由补偿步骤补齐。
    const security = typeof settings.security === 'string' ? settings.security.toLowerCase() : '';
    if (security === 'tls') {
        ds.tls = true;
        const tls = isPlainObject(settings.tlsSettings) ? settings.tlsSettings : null;
        if (tls) {
            setNonEmptyString(tls, 'serverName', ds, 'servername');
            setNonEmptyString(tls, 'fingerprint', ds, 'client-fingerprint');
            const alpn = readStringList(tls.alpn);
            if (alpn) ds.alpn = alpn;
            if (tls.allowInsecure === true) {
                ds['skip-cert-verify'] = true;
            }
        }
    } else if (security === 'reality') {
        ds.tls = true;
        // REALITY 下 Xray 只读 realitySettings；tlsSettings 即使存在也不参与握手。
        const reality = isPlainObject(settings.realitySettings) ? settings.realitySettings : {};
        setNonEmptyString(reality, 'serverName', ds, 'servername');
        setNonEmptyString(reality, 'fingerprint', ds, 'client-fingerprint');
        const publicKey = typeof reality.publicKey === 'string' ? reality.publicKey : '';
        if (publicKey !== '') {
            const realityOpts = { 'public-key': publicKey };
            setNonEmptyString(reality, 'shortId', realityOpts, 'short-id');
            ds['reality-opts'] = realityOpts;
        } else {
            // 声明 REALITY 却没有公钥时，显式清空比继承上行安全：
            // 否则会拿上行公钥握手，表现为“能建立连接但认证必然失败”。
            ds['reality-opts'] = { 'public-key': '' };
            console.warn('[MiSub] XHTTP downloadSettings security=reality 缺少 publicKey');
        }
    }

    const xhttp = isPlainObject(settings.xhttpSettings) ? settings.xhttpSettings : null;
    if (xhttp) {
        setNonEmptyString(xhttp, 'path', ds, 'path');
        setNonEmptyString(xhttp, 'host', ds, 'host');
        if (isPlainObject(xhttp.headers)) {
            const headers = copyStringHeaders(xhttp.headers);
            if (Object.keys(headers).length > 0) {
                ds.headers = headers;
            }
        }
        // 下行 extra 中只有 xmux 能独立于上行：padding/session/seq 是协议要求两端一致的字段，
        // mihomo 继承上行正好满足；其余字段属于客户端上行或服务端，没有下行语义。
        const xmux = isPlainObject(xhttp.extra) ? xhttp.extra.xmux : null;
        if (isPlainObject(xmux) && Object.keys(xmux).length > 0) {
            const reuse = xmuxToReuseSettings(xmux);
            if (Object.keys(reuse).length > 0) {
                ds['reuse-settings'] = reuse;
            }
        }
    }

    return ds;
}

function reuseSettingsToXmux(reuse) {
    const xmux = {};
    const set = (sourceKey, targetKey) => {
        const value = reuse[sourceKey];
        if (typeof value === 'string') {
            if (value !== '') xmux[targetKey] = value;
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            xmux[targetKey] = String(Math.trunc(value));
        }
    };
    set('max-connections', 'maxConnections');
    set('max-concurrency', 'maxConcurrency');
    set('c-max-reuse-times', 'cMaxReuseTimes');
    set('h-max-request-times', 'hMaxRequestTimes');
    set('h-max-reusable-secs', 'hMaxReusableSecs');
    if (
        typeof reuse['h-keep-alive-period'] === 'number' &&
        Number.isFinite(reuse['h-keep-alive-period'])
    ) {
        xmux.hKeepAlivePeriod = Math.trunc(reuse['h-keep-alive-period']);
    }
    return xmux;
}

function serializeDownloadSettings(ds, upstream) {
    const out = {};
    const context = isPlainObject(upstream) ? upstream : null;

    // mihomo 对 download-settings 的 server/port 也会回退到上行；
    // Xray 的 downloadSettings.address 实际必填，反向导出时必须物化。
    const server = typeof ds.server === 'string' && ds.server !== '' ? ds.server : context?.server;
    if (typeof server === 'string' && server !== '') out.address = server;
    const port =
        typeof ds.port === 'number' && Number.isFinite(ds.port)
            ? Math.trunc(ds.port)
            : context?.port;
    if (typeof port === 'number' && Number.isFinite(port)) out.port = Math.trunc(port);

    // mihomo 对下行缺省项按指针逐项回退到上行（adapter/outbound/vless.go:725-770）：
    // 只有显式值才能切断继承。反向时必须把“生效值”物化，否则重新导入后安全层会退化。
    const dsReality = isPlainObject(ds['reality-opts']) ? ds['reality-opts'] : null;
    const dsPublicKey =
        dsReality && typeof dsReality['public-key'] === 'string' ? dsReality['public-key'] : '';
    const upstreamReality =
        context &&
        isPlainObject(context.realityOpts) &&
        typeof context.realityOpts['public-key'] === 'string' &&
        context.realityOpts['public-key'] !== ''
            ? context.realityOpts
            : null;
    const explicitTls = typeof ds.tls === 'boolean' ? ds.tls : null;
    const effectiveTls = explicitTls === null ? context?.tls === true : explicitTls;

    // 显式空值（'' / [] / false）同样意味着“不要回退上行”，这里必须区分“字段缺失”。
    const effectiveServerName =
        typeof ds.servername === 'string'
            ? ds.servername
            : typeof context?.servername === 'string'
              ? context.servername
              : '';
    const effectiveFingerprint =
        typeof ds['client-fingerprint'] === 'string'
            ? ds['client-fingerprint']
            : typeof context?.clientFingerprint === 'string'
              ? context.clientFingerprint
              : '';
    const effectiveAlpn = Array.isArray(ds.alpn)
        ? ds.alpn
        : Array.isArray(context?.alpn)
          ? context.alpn
          : null;
    const effectiveSkipCertVerify =
        typeof ds['skip-cert-verify'] === 'boolean'
            ? ds['skip-cert-verify']
            : context?.skipCertVerify === true;

    // 空 public-key 既不是有效 REALITY，又是补偿步骤写入的清除标记；
    // 但 reality-opts 存在本身就会阻止 mihomo 继承上行 REALITY。
    let security = 'none';
    if (dsReality) {
        security = dsPublicKey !== '' ? 'reality' : effectiveTls ? 'tls' : 'none';
    } else if (upstreamReality) {
        security = 'reality';
    } else if (effectiveTls) {
        security = 'tls';
    }

    if (security === 'reality') {
        out.security = 'reality';
        const realitySettings = {};
        if (dsPublicKey !== '') {
            realitySettings.publicKey = dsPublicKey;
            setNonEmptyString(dsReality, 'short-id', realitySettings, 'shortId');
        } else if (upstreamReality) {
            realitySettings.publicKey = upstreamReality['public-key'];
            setNonEmptyString(upstreamReality, 'short-id', realitySettings, 'shortId');
        }
        if (effectiveServerName !== '') {
            realitySettings.serverName = effectiveServerName;
        }
        // chrome 是 Xray 两种 security 的缺省指纹；写回会把缺省值固化成配置。
        if (effectiveFingerprint !== '' && effectiveFingerprint !== 'chrome') {
            realitySettings.fingerprint = effectiveFingerprint;
        }
        out.realitySettings = realitySettings;
    } else if (security === 'tls') {
        out.security = 'tls';
        const tlsSettings = {};
        if (effectiveServerName !== '') {
            tlsSettings.serverName = effectiveServerName;
        }
        if (effectiveFingerprint !== '' && effectiveFingerprint !== 'chrome') {
            tlsSettings.fingerprint = effectiveFingerprint;
        }
        if (effectiveAlpn && effectiveAlpn.length > 0) {
            const alpn = effectiveAlpn.filter((item) => typeof item === 'string' && item !== '');
            if (alpn.length > 0) tlsSettings.alpn = alpn;
        }
        if (effectiveSkipCertVerify === true) {
            tlsSettings.allowInsecure = true;
        }
        if (Object.keys(tlsSettings).length > 0) {
            out.tlsSettings = tlsSettings;
        }
    }

    const xhttpSettings = {};
    if (typeof ds.path === 'string' && ds.path !== '') xhttpSettings.path = ds.path;
    if (typeof ds.host === 'string' && ds.host !== '') xhttpSettings.host = ds.host;
    if (isPlainObject(ds.headers)) {
        const headers = copyStringHeaders(ds.headers);
        // 与上行一致：Host 由 host 参数表达；Xray 也禁止 xhttp headers 含 host。
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'host') delete headers[key];
        }
        if (Object.keys(headers).length > 0) {
            xhttpSettings.headers = headers;
        }
    }
    if (isPlainObject(ds['reuse-settings']) && Object.keys(ds['reuse-settings']).length > 0) {
        const xmux = reuseSettingsToXmux(ds['reuse-settings']);
        // 与正向映射一致：没有可转换字段时不输出空对象，避免生成无意义的 xmux。
        if (Object.keys(xmux).length > 0) {
            xhttpSettings.extra = { xmux };
        }
    }
    if (Object.keys(xhttpSettings).length > 0) {
        out.xhttpSettings = xhttpSettings;
    }

    // Xray 的 downloadSettings 是独立 StreamConfig，缺 network 会按 tcp 构建，
    // 下行 transport 无法成立；只有确有下行字段时才输出。
    if (Object.keys(out).length > 0) out.network = 'xhttp';

    return out;
}

/**
 * 解析 Xray extra JSON 对象为 mihomo xhttp-opts 附加字段。
 * @param {Object} extra - xhttpSettings.extra 解析后的 JSON 对象
 * @returns {Object} mihomo xhttp-opts 附加字段（kebab-case）；无有效字段时为空对象
 */
export function parseXhttpExtra(extra) {
    const opts = {};
    if (!isPlainObject(extra)) return opts;

    if (extra.noGRPCHeader === true) {
        opts['no-grpc-header'] = true;
    }

    setNonEmptyString(extra, 'xPaddingBytes', opts, 'x-padding-bytes');
    if (typeof extra.xPaddingObfsMode === 'boolean') {
        opts['x-padding-obfs-mode'] = extra.xPaddingObfsMode;
    }
    setNonEmptyString(extra, 'xPaddingKey', opts, 'x-padding-key');
    setNonEmptyString(extra, 'xPaddingHeader', opts, 'x-padding-header');
    setNonEmptyString(extra, 'xPaddingPlacement', opts, 'x-padding-placement');
    setNonEmptyString(extra, 'xPaddingMethod', opts, 'x-padding-method');
    setNonEmptyString(extra, 'uplinkHTTPMethod', opts, 'uplink-http-method');

    // Xray 规范名是 sessionID*，但存量链接里仍有旧名；规范名优先，避免两者同时出现时行为不确定。
    if (typeof extra.sessionIDPlacement === 'string' && extra.sessionIDPlacement !== '') {
        opts['session-placement'] = extra.sessionIDPlacement;
    } else {
        setNonEmptyString(extra, 'sessionPlacement', opts, 'session-placement');
    }
    if (typeof extra.sessionIDKey === 'string' && extra.sessionIDKey !== '') {
        opts['session-key'] = extra.sessionIDKey;
    } else {
        setNonEmptyString(extra, 'sessionKey', opts, 'session-key');
    }
    setNonEmptyString(extra, 'sessionIDTable', opts, 'session-table');
    if (typeof extra.sessionIDLength === 'string' && extra.sessionIDLength !== '') {
        opts['session-length'] = extra.sessionIDLength;
    } else if (
        typeof extra.sessionIDLength === 'number' &&
        Number.isFinite(extra.sessionIDLength)
    ) {
        opts['session-length'] = String(Math.trunc(extra.sessionIDLength));
    }

    setNonEmptyString(extra, 'seqPlacement', opts, 'seq-placement');
    setNonEmptyString(extra, 'seqKey', opts, 'seq-key');
    setNonEmptyString(extra, 'uplinkDataPlacement', opts, 'uplink-data-placement');
    setNonEmptyString(extra, 'uplinkDataKey', opts, 'uplink-data-key');

    setRangeField(extra, 'uplinkChunkSize', opts, 'uplink-chunk-size');
    setRangeField(extra, 'scMaxEachPostBytes', opts, 'sc-max-each-post-bytes');
    setRangeField(extra, 'scMinPostsIntervalMs', opts, 'sc-min-posts-interval-ms');

    if (isPlainObject(extra.headers)) {
        const headers = copyStringHeaders(extra.headers);
        if (Object.keys(headers).length > 0) {
            opts.headers = headers;
        }
    }

    if (isPlainObject(extra.xmux) && Object.keys(extra.xmux).length > 0) {
        const reuse = xmuxToReuseSettings(extra.xmux);
        if (Object.keys(reuse).length > 0) {
            opts['reuse-settings'] = reuse;
        }
    }

    if (isPlainObject(extra.downloadSettings)) {
        const ds = parseDownloadSettings(extra.downloadSettings);
        if (Object.keys(ds).length > 0) {
            opts['download-settings'] = ds;
        }
    }

    return opts;
}

/**
 * 把 mihomo xhttp-opts 逆向序列化为 Xray extra JSON 对象。
 * path/host/mode 不属于 extra，不输出。
 * @param {Object} xhttpOpts - mihomo xhttp-opts（含 path/host/mode 与 extra 派生字段）
 * @param {Object} [upstream] - 代理级上下文，用于物化 mihomo 下行对上行安全配置的继承
 * @returns {Object|null} Xray extra 对象；不含任何 extra 字段时返回 null
 */
export function serializeXhttpExtra(xhttpOpts, upstream = null) {
    if (!isPlainObject(xhttpOpts)) return null;

    const extra = {};
    const getString = (sourceKey, targetKey) => {
        if (typeof xhttpOpts[sourceKey] === 'string' && xhttpOpts[sourceKey] !== '') {
            extra[targetKey] = xhttpOpts[sourceKey];
        }
    };
    // mihomo 的字符串字段经 WeaklyTypedInput 也接受数字（如 session-length: 16）。
    const getStringOrNumber = (sourceKey, targetKey) => {
        const value = xhttpOpts[sourceKey];
        if (typeof value === 'string' && value !== '') {
            extra[targetKey] = value;
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            extra[targetKey] = String(Math.trunc(value));
        }
    };
    const getRange = (sourceKey, targetKey) => {
        const value = xhttpOpts[sourceKey];
        if (typeof value === 'string' && value !== '') {
            extra[targetKey] = value;
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            extra[targetKey] = String(Math.trunc(value));
        }
    };

    if (xhttpOpts['no-grpc-header'] === true) extra.noGRPCHeader = true;

    getStringOrNumber('x-padding-bytes', 'xPaddingBytes');
    if (typeof xhttpOpts['x-padding-obfs-mode'] === 'boolean') {
        extra.xPaddingObfsMode = xhttpOpts['x-padding-obfs-mode'];
    }
    getString('x-padding-key', 'xPaddingKey');
    getString('x-padding-header', 'xPaddingHeader');
    getString('x-padding-placement', 'xPaddingPlacement');
    getString('x-padding-method', 'xPaddingMethod');
    getString('uplink-http-method', 'uplinkHTTPMethod');

    // 输出 Xray 规范名；mihomo 正向解析同时接受新旧两种命名。
    getString('session-placement', 'sessionIDPlacement');
    getString('session-key', 'sessionIDKey');
    getString('session-table', 'sessionIDTable');
    getStringOrNumber('session-length', 'sessionIDLength');

    getString('seq-placement', 'seqPlacement');
    getString('seq-key', 'seqKey');
    getString('uplink-data-placement', 'uplinkDataPlacement');
    getString('uplink-data-key', 'uplinkDataKey');

    getRange('uplink-chunk-size', 'uplinkChunkSize');
    getRange('sc-max-each-post-bytes', 'scMaxEachPostBytes');
    getRange('sc-min-posts-interval-ms', 'scMinPostsIntervalMs');

    // Host 由 host 参数单独表达；头名大小写不敏感，避免小写 host 在往返后残留。
    if (isPlainObject(xhttpOpts.headers)) {
        const headers = copyStringHeaders(xhttpOpts.headers);
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'host') {
                delete headers[key];
            }
        }
        if (Object.keys(headers).length > 0) extra.headers = headers;
    }

    if (
        isPlainObject(xhttpOpts['reuse-settings']) &&
        Object.keys(xhttpOpts['reuse-settings']).length > 0
    ) {
        const xmux = reuseSettingsToXmux(xhttpOpts['reuse-settings']);
        if (Object.keys(xmux).length > 0) extra.xmux = xmux;
    }

    if (isPlainObject(xhttpOpts['download-settings'])) {
        const ds = serializeDownloadSettings(xhttpOpts['download-settings'], upstream);
        if (Object.keys(ds).length > 0) extra.downloadSettings = ds;
    }

    return Object.keys(extra).length > 0 ? extra : null;
}

/**
 * 切断 mihomo 下行配置对上行 TLS / REALITY 字段的继承。
 *
 * Xray 的 downloadSettings 是独立 StreamConfig，缺省值不继承上行；mihomo 则在字段缺省时
 * 回退上行值。这里把缺省值写成显式值，让两边语义一致。
 */
export function applyDownloadInheritanceGuard(xhttpOpts, { upstreamReality } = {}) {
    const ds = xhttpOpts && xhttpOpts['download-settings'];
    if (!isPlainObject(ds)) return xhttpOpts;

    ds.tls = ds.tls === true;

    const publicKey = ds['reality-opts'] && ds['reality-opts']['public-key'];
    const downlinkReality = typeof publicKey === 'string' && publicKey !== '';
    if (!downlinkReality && upstreamReality) {
        // mihomo 只在 reality-opts 缺省时整份继承上行；空 public-key 会解析成 nil，
        // 是唯一能表达“下行不是 REALITY”的写法（空对象会触发结构解码报错）。
        ds['reality-opts'] = { 'public-key': '' };
    }

    if (!ds.tls) return xhttpOpts;

    // 上行常是 REALITY 伪装域名，其 SNI / ALPN 对下行 CDN 是错误值；
    // 空串与空数组在 mihomo 中同样是显式覆盖，不会回退上行。
    if (typeof ds.servername !== 'string') ds.servername = '';
    if (typeof ds['client-fingerprint'] !== 'string' || ds['client-fingerprint'] === '') {
        ds['client-fingerprint'] = 'chrome';
    }
    if (!Array.isArray(ds.alpn)) ds.alpn = [];
    if (typeof ds['skip-cert-verify'] !== 'boolean') ds['skip-cert-verify'] = false;

    return xhttpOpts;
}
