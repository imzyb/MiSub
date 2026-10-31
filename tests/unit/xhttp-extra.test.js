import { describe, it, expect, vi } from 'vitest';
import { parseXhttpExtra, serializeXhttpExtra } from '../../functions/utils/xhttp-extra.js';
import { urlToClashProxy } from '../../functions/utils/url-to-clash.js';
import { convertClashProxyToUrl } from '../../functions/utils/clash-to-url.js';

// packet-up 模式下 extra 可用的完整字段集；同时覆盖下行非安全字段。
const FULL_EXTRA = {
    headers: {
        Host: 'extra.example.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
    xPaddingBytes: '100-1000',
    xPaddingObfsMode: true,
    xPaddingPlacement: 'queryInHeader',
    xPaddingMethod: 'tokenish',
    xPaddingKey: 'x',
    xPaddingHeader: 'Origin',
    sessionIDPlacement: 'query',
    sessionIDKey: 's',
    seqPlacement: 'query',
    seqKey: 'q',
    uplinkDataPlacement: 'header',
    uplinkDataKey: 'X-Data',
    sessionIDTable: 'Base62',
    sessionIDLength: '12-20',
    uplinkChunkSize: '2000-3000',
    uplinkHTTPMethod: 'GET',
    noGRPCHeader: false,
    scMaxEachPostBytes: '4000-8000',
    scMinPostsIntervalMs: '10-50',
    xmux: {
        maxConcurrency: 0,
        maxConnections: 0,
        cMaxReuseTimes: 0,
        hMaxRequestTimes: 0,
        hMaxReusableSecs: 0,
        hKeepAlivePeriod: 0,
    },
    downloadSettings: {
        address: 'cf2.example.com',
        port: 443,
        xhttpSettings: {
            path: '/dl',
            host: 'cf3.example.com',
            extra: { xmux: { maxConcurrency: 1 } },
        },
    },
};

const PARSED_OPTS = parseXhttpExtra(FULL_EXTRA);

describe('parseXhttpExtra 正向映射', () => {
    it('应完整映射 packet-up 的 extra 与非安全下载字段', () => {
        const opts = parseXhttpExtra(FULL_EXTRA);

        expect(opts).toEqual({
            headers: {
                Host: 'extra.example.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
            'x-padding-bytes': '100-1000',
            'x-padding-obfs-mode': true,
            'x-padding-placement': 'queryInHeader',
            'x-padding-method': 'tokenish',
            'x-padding-key': 'x',
            'x-padding-header': 'Origin',
            'session-placement': 'query',
            'session-key': 's',
            'seq-placement': 'query',
            'seq-key': 'q',
            'uplink-data-placement': 'header',
            'uplink-data-key': 'X-Data',
            'session-table': 'Base62',
            'session-length': '12-20',
            'uplink-chunk-size': '2000-3000',
            'uplink-http-method': 'GET',
            'sc-max-each-post-bytes': '4000-8000',
            'sc-min-posts-interval-ms': '10-50',
            'reuse-settings': {
                'max-connections': '0',
                'max-concurrency': '0',
                'c-max-reuse-times': '0',
                'h-max-request-times': '0',
                'h-max-reusable-secs': '0',
                'h-keep-alive-period': 0,
            },
            'download-settings': {
                server: 'cf2.example.com',
                port: 443,
                path: '/dl',
                host: 'cf3.example.com',
                'reuse-settings': { 'max-concurrency': '1' },
            },
        });
    });

    it('应兼容数字范围、旧 session 字段名并跳过非字符串头值', () => {
        const opts = parseXhttpExtra({
            headers: { 'X-Text': 'ok', 'X-Number': 1, 'X-Array': ['a'] },
            sessionPlacement: 'query',
            sessionKey: 'k',
            sessionIDLength: 12,
            uplinkChunkSize: 2000,
            scMaxEachPostBytes: 4000,
            scMinPostsIntervalMs: 10,
            xmux: { maxConnections: 2, hKeepAlivePeriod: 30 },
        });

        expect(opts).toEqual({
            headers: { 'X-Text': 'ok' },
            'session-placement': 'query',
            'session-key': 'k',
            'session-length': '12',
            'uplink-chunk-size': '2000',
            'sc-max-each-post-bytes': '4000',
            'sc-min-posts-interval-ms': '10',
            'reuse-settings': { 'max-connections': '2', 'h-keep-alive-period': 30 },
        });
    });
});

describe('serializeXhttpExtra 反向序列化', () => {
    it('应把 mihomo xhttp-opts 逆向为 extra，并剔除 Host 头', () => {
        const extra = serializeXhttpExtra({
            path: '/up',
            host: 'up.example.com',
            mode: 'packet-up',
            ...PARSED_OPTS,
        });

        expect(extra).toEqual({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
            xPaddingBytes: '100-1000',
            xPaddingObfsMode: true,
            xPaddingPlacement: 'queryInHeader',
            xPaddingMethod: 'tokenish',
            xPaddingKey: 'x',
            xPaddingHeader: 'Origin',
            sessionIDPlacement: 'query',
            sessionIDKey: 's',
            seqPlacement: 'query',
            seqKey: 'q',
            uplinkDataPlacement: 'header',
            uplinkDataKey: 'X-Data',
            sessionIDTable: 'Base62',
            sessionIDLength: '12-20',
            uplinkChunkSize: '2000-3000',
            uplinkHTTPMethod: 'GET',
            scMaxEachPostBytes: '4000-8000',
            scMinPostsIntervalMs: '10-50',
            xmux: {
                maxConnections: '0',
                maxConcurrency: '0',
                cMaxReuseTimes: '0',
                hMaxRequestTimes: '0',
                hMaxReusableSecs: '0',
                hKeepAlivePeriod: 0,
            },
            downloadSettings: {
                address: 'cf2.example.com',
                port: 443,
                network: 'xhttp',
                xhttpSettings: {
                    path: '/dl',
                    host: 'cf3.example.com',
                    extra: { xmux: { maxConcurrency: '1' } },
                },
            },
        });

        // mihomo 的字符串字段经弱类型转换也接受数字
        expect(serializeXhttpExtra({ 'x-padding-bytes': 1000, 'session-length': 16 })).toEqual({
            xPaddingBytes: '1000',
            sessionIDLength: '16',
        });
    });

    it('不含 extra 字段时返回 null', () => {
        expect(serializeXhttpExtra({ path: '/x', host: 'h', mode: 'auto' })).toBeNull();
        expect(serializeXhttpExtra(null)).toBeNull();
    });

    it('reuse-settings 没有可转换字段时不输出空 xmux', () => {
        expect(
            serializeXhttpExtra({ 'reuse-settings': { 'h-keep-alive-period': '30' } })
        ).toBeNull();
        expect(
            serializeXhttpExtra({
                'download-settings': { 'reuse-settings': { 'h-keep-alive-period': '30' } },
            })
        ).toBeNull();
    });

    it('应剔除上下行 headers 中任意大小写的 Host 头', () => {
        expect(serializeXhttpExtra({ headers: { host: 'lower.example.com', 'X-A': '1' } })).toEqual(
            {
                headers: { 'X-A': '1' },
            }
        );
        expect(
            serializeXhttpExtra({
                'download-settings': {
                    server: 'cdn.example.com',
                    port: 443,
                    headers: { Host: 'dl.example.com', 'X-A': '1' },
                },
            }).downloadSettings.xhttpSettings.headers
        ).toEqual({ 'X-A': '1' });
    });
});

const EXTRA_PARAM = encodeURIComponent(JSON.stringify(FULL_EXTRA));

const XHTTP_URL =
    'vless://uuid@1.2.3.4:443?encryption=none&security=none&type=xhttp' +
    `&path=%2Fup&host=url.example.com&mode=packet-up&extra=${EXTRA_PARAM}#node`;

describe('转换器接入', () => {
    it('parseVlessUrl 应合并 extra，并让 URL 的 Host 优先于 extra.headers.Host', () => {
        const proxy = urlToClashProxy(XHTTP_URL);
        const opts = proxy['xhttp-opts'];

        expect(opts.path).toBe('/up');
        expect(opts.host).toBe('url.example.com');
        expect(opts.headers).toEqual({
            Host: 'url.example.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        });
        expect(opts['x-padding-bytes']).toBe('100-1000');
        expect(opts['reuse-settings']['h-max-request-times']).toBe('0');
        expect(opts['download-settings']).toEqual({
            server: 'cf2.example.com',
            port: 443,
            path: '/dl',
            host: 'cf3.example.com',
            'reuse-settings': { 'max-concurrency': '1' },
            // 补偿步骤始终显式写出 tls，缺省即 false。
            tls: false,
        });
    });

    it('URL 的 host 应覆盖 extra.headers 中任意大小写的 host', () => {
        const url = buildXhttpUrl('security=none&host=url.example.com', {
            headers: { host: 'extra-lower.example.com', 'X-A': '1' },
        });
        const opts = urlToClashProxy(url)['xhttp-opts'];

        expect(opts.headers).toEqual({ 'X-A': '1', Host: 'url.example.com' });
    });

    it('extra 为非法 JSON 时仍按基础字段导入', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const url = 'vless://uuid@1.2.3.4:443?type=xhttp&path=%2Fup&extra=%7Bnot-json';
        const proxy = urlToClashProxy(url);

        expect(proxy['xhttp-opts']).toEqual({ path: '/up' });
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('convertClashProxyToUrl 应输出 path/host/mode 与 extra', () => {
        const url = convertClashProxyToUrl({
            name: 'node',
            type: 'vless',
            server: '1.2.3.4',
            port: 443,
            uuid: 'uuid',
            network: 'xhttp',
            'xhttp-opts': {
                path: '/up',
                host: 'up.example.com',
                mode: 'packet-up',
                'x-padding-bytes': '100-1000',
                'session-placement': 'query',
                'reuse-settings': { 'max-concurrency': '1' },
            },
        });

        expect(url).toContain('type=xhttp');
        expect(url).toContain('path=%2Fup');
        expect(url).toContain('host=up.example.com');
        expect(url).toContain('mode=packet-up');

        const match = url.match(/(?:\?|&)extra=([^&#]*)/);
        expect(match).not.toBeNull();
        const extra = JSON.parse(decodeURIComponent(match[1]));
        expect(extra.xPaddingBytes).toBe('100-1000');
        expect(extra.sessionIDPlacement).toBe('query');
        expect(extra.xmux).toEqual({ maxConcurrency: '1' });
    });

    it('convertClashProxyToUrl 应从任意大小写的 Host 头推导 host 参数', () => {
        const url = convertClashProxyToUrl({
            name: 'node',
            type: 'vless',
            server: '1.2.3.4',
            port: 443,
            uuid: 'uuid',
            network: 'xhttp',
            'xhttp-opts': { headers: { host: 'only.example.com' } },
        });

        expect(url).toContain('host=only.example.com');
        expect(url).not.toContain('extra=');
    });
});

describe('downloadSettings 安全块映射', () => {
    it('security 决定读取 tlsSettings 还是 realitySettings', () => {
        const tlsOpts = parseXhttpExtra({
            downloadSettings: {
                address: 'dl.example.com',
                port: 443,
                security: 'tls',
                tlsSettings: {
                    serverName: 'tls.example.com',
                    fingerprint: 'firefox',
                    // Xray 的 StringList 同时接受字符串形式
                    alpn: 'h2, http/1.1',
                    allowInsecure: true,
                },
                realitySettings: {
                    serverName: 'reality.example.com',
                    fingerprint: 'safari',
                    publicKey: 'rpk',
                    shortId: 'rsid',
                },
                xhttpSettings: { path: '/dl' },
            },
        });
        expect(tlsOpts['download-settings']).toEqual({
            server: 'dl.example.com',
            port: 443,
            tls: true,
            servername: 'tls.example.com',
            'client-fingerprint': 'firefox',
            alpn: ['h2', 'http/1.1'],
            'skip-cert-verify': true,
            path: '/dl',
        });

        const realityOpts = parseXhttpExtra({
            downloadSettings: {
                address: 'dl.example.com',
                port: 443,
                security: 'reality',
                tlsSettings: { serverName: 'tls.example.com', fingerprint: 'firefox' },
                realitySettings: {
                    serverName: 'reality.example.com',
                    fingerprint: 'safari',
                    publicKey: 'rpk',
                    shortId: 'rsid',
                },
            },
        });
        expect(realityOpts['download-settings']).toEqual({
            server: 'dl.example.com',
            port: 443,
            tls: true,
            servername: 'reality.example.com',
            'client-fingerprint': 'safari',
            'reality-opts': { 'public-key': 'rpk', 'short-id': 'rsid' },
        });
    });

    it('security=reality 缺少 publicKey 时应显式清空并告警', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const opts = parseXhttpExtra({
            downloadSettings: {
                address: 'dl.example.com',
                security: 'reality',
                tlsSettings: { serverName: 'tls.example.com', fingerprint: 'firefox' },
                realitySettings: { serverName: 'reality.example.com', fingerprint: 'safari' },
            },
        });

        expect(opts['download-settings']).toEqual({
            server: 'dl.example.com',
            tls: true,
            servername: 'reality.example.com',
            'client-fingerprint': 'safari',
            'reality-opts': { 'public-key': '' },
        });
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('security=none 时不读取任何安全块', () => {
        const opts = parseXhttpExtra({
            downloadSettings: {
                address: 'dl.example.com',
                security: 'none',
                tlsSettings: {
                    serverName: 'tls.example.com',
                    fingerprint: 'firefox',
                    allowInsecure: true,
                },
                realitySettings: { publicKey: 'pk', serverName: 'reality.example.com' },
                xhttpSettings: { path: '/dl' },
            },
        });

        expect(opts['download-settings']).toEqual({ server: 'dl.example.com', path: '/dl' });
    });
});

const UPSTREAM_REALITY_QUERY = 'security=reality&pbk=upPbk&sid=abcd&sni=up.example.com&fp=chrome';

function buildXhttpUrl(query, extra) {
    return (
        `vless://uuid@1.2.3.4:443?encryption=none&type=xhttp&path=%2Fup&mode=packet-up&${query}` +
        `&extra=${encodeURIComponent(JSON.stringify(extra))}#node`
    );
}

describe('下行继承补偿', () => {
    it('上行 REALITY + 下行 TLS：清空 REALITY 并显式写出 TLS 字段', () => {
        const url = buildXhttpUrl(UPSTREAM_REALITY_QUERY, {
            downloadSettings: {
                address: 'cf2.example.com',
                port: 443,
                security: 'tls',
                tlsSettings: {
                    serverName: 'cf2.example.com',
                    fingerprint: 'chrome',
                    alpn: ['h3'],
                },
                xhttpSettings: { path: '/up' },
            },
        });
        const ds = urlToClashProxy(url)['xhttp-opts']['download-settings'];

        expect(ds).toEqual({
            server: 'cf2.example.com',
            port: 443,
            tls: true,
            servername: 'cf2.example.com',
            'client-fingerprint': 'chrome',
            alpn: ['h3'],
            path: '/up',
            'skip-cert-verify': false,
            'reality-opts': { 'public-key': '' },
        });
    });

    it('上行 REALITY + 下行无 security：tls 置 false 并清空 REALITY', () => {
        const url = buildXhttpUrl(UPSTREAM_REALITY_QUERY, {
            downloadSettings: {
                address: 'cf2.example.com',
                port: 443,
                xhttpSettings: { path: '/up' },
            },
        });
        const ds = urlToClashProxy(url)['xhttp-opts']['download-settings'];

        expect(ds).toEqual({
            server: 'cf2.example.com',
            port: 443,
            path: '/up',
            tls: false,
            'reality-opts': { 'public-key': '' },
        });
    });

    it('上行 TLS + 下行 REALITY：读取 realitySettings 并补 chrome / 空 ALPN', () => {
        const url = buildXhttpUrl('security=tls&sni=up.example.com&alpn=h3&fp=chrome', {
            downloadSettings: {
                address: 'reality.example.com',
                port: 443,
                security: 'reality',
                realitySettings: {
                    serverName: 'www.reality-target.com',
                    fingerprint: 'firefox',
                    publicKey: 'dlPbk',
                    shortId: 'dlSid',
                },
                xhttpSettings: { path: '/up' },
            },
        });
        const ds = urlToClashProxy(url)['xhttp-opts']['download-settings'];

        expect(ds).toEqual({
            server: 'reality.example.com',
            port: 443,
            tls: true,
            servername: 'www.reality-target.com',
            'client-fingerprint': 'firefox',
            'reality-opts': { 'public-key': 'dlPbk', 'short-id': 'dlSid' },
            path: '/up',
            alpn: [],
            'skip-cert-verify': false,
        });
    });

    it('下行 TLS 未提供任何 tlsSettings 时写入显式缺省值', () => {
        const url = buildXhttpUrl(UPSTREAM_REALITY_QUERY, {
            downloadSettings: {
                address: 'cf2.example.com',
                port: 443,
                security: 'tls',
            },
        });
        const ds = urlToClashProxy(url)['xhttp-opts']['download-settings'];

        expect(ds).toEqual({
            server: 'cf2.example.com',
            port: 443,
            tls: true,
            'reality-opts': { 'public-key': '' },
            servername: '',
            'client-fingerprint': 'chrome',
            alpn: [],
            'skip-cert-verify': false,
        });
    });
});

describe('下行安全字段反向序列化', () => {
    it('空 public-key 不应被写成 reality，补偿默认值应被省略', () => {
        const url = convertClashProxyToUrl({
            name: 'node',
            type: 'vless',
            server: '1.2.3.4',
            port: 443,
            uuid: 'uuid',
            network: 'xhttp',
            tls: true,
            servername: 'up.example.com',
            'client-fingerprint': 'chrome',
            'xhttp-opts': {
                path: '/up',
                mode: 'packet-up',
                'download-settings': {
                    server: 'cf2.example.com',
                    port: 443,
                    tls: true,
                    servername: 'cf2.example.com',
                    'client-fingerprint': 'firefox',
                    alpn: ['h2'],
                    'skip-cert-verify': true,
                    path: '/up',
                    'reality-opts': { 'public-key': '' },
                },
            },
        });
        const extra = JSON.parse(decodeURIComponent(url.match(/(?:\?|&)extra=([^&#]*)/)[1]));

        expect(extra.downloadSettings).toEqual({
            address: 'cf2.example.com',
            port: 443,
            network: 'xhttp',
            security: 'tls',
            tlsSettings: {
                serverName: 'cf2.example.com',
                fingerprint: 'firefox',
                alpn: ['h2'],
                allowInsecure: true,
            },
            xhttpSettings: { path: '/up' },
        });
        expect(extra.downloadSettings.realitySettings).toBeUndefined();
    });

    it('上行 REALITY + 下行 TLS 的链接往返后仍为 security=tls', () => {
        const url = buildXhttpUrl(UPSTREAM_REALITY_QUERY, {
            downloadSettings: {
                address: 'cf2.example.com',
                port: 443,
                security: 'tls',
                tlsSettings: {
                    serverName: 'cf2.example.com',
                    fingerprint: 'firefox',
                    alpn: ['h2'],
                },
                xhttpSettings: { path: '/up' },
            },
        });
        const roundTrip = convertClashProxyToUrl(urlToClashProxy(url));
        const extra = JSON.parse(decodeURIComponent(roundTrip.match(/(?:\?|&)extra=([^&#]*)/)[1]));

        expect(extra.downloadSettings.security).toBe('tls');
        expect(extra.downloadSettings.realitySettings).toBeUndefined();
        expect(extra.downloadSettings.tlsSettings.fingerprint).toBe('firefox');
    });

    it('下行 REALITY 应写回 realitySettings 并省略默认指纹', () => {
        const extra = serializeXhttpExtra({
            'download-settings': {
                server: 'dl.example.com',
                port: 443,
                tls: true,
                servername: 'target.example.com',
                'client-fingerprint': 'chrome',
                alpn: [],
                'skip-cert-verify': false,
                'reality-opts': { 'public-key': 'pk', 'short-id': 'sid' },
            },
        });

        expect(extra.downloadSettings).toEqual({
            address: 'dl.example.com',
            port: 443,
            network: 'xhttp',
            security: 'reality',
            realitySettings: {
                publicKey: 'pk',
                shortId: 'sid',
                serverName: 'target.example.com',
            },
        });
    });
});

describe('下行继承的反向物化', () => {
    it('Clash 源依赖下行继承 REALITY 时，Clash→URL→Clash 仍保持 REALITY', () => {
        const url = convertClashProxyToUrl({
            name: 'node',
            type: 'vless',
            server: '1.2.3.4',
            port: 443,
            uuid: 'uuid',
            network: 'xhttp',
            tls: true,
            servername: 'up.example.com',
            'client-fingerprint': 'firefox',
            'reality-opts': { 'public-key': 'upPbk', 'short-id': 'abcd' },
            'xhttp-opts': {
                path: '/up',
                mode: 'stream-up',
                'download-settings': { server: 'cdn.example.com', port: 443 },
            },
        });
        const extra = JSON.parse(decodeURIComponent(url.match(/(?:\?|&)extra=([^&#]*)/)[1]));

        expect(extra.downloadSettings.network).toBe('xhttp');
        expect(extra.downloadSettings.security).toBe('reality');
        expect(extra.downloadSettings.realitySettings).toEqual({
            publicKey: 'upPbk',
            shortId: 'abcd',
            serverName: 'up.example.com',
            fingerprint: 'firefox',
        });

        const ds = urlToClashProxy(url)['xhttp-opts']['download-settings'];
        expect(ds.tls).toBe(true);
        expect(ds['reality-opts']).toEqual({ 'public-key': 'upPbk', 'short-id': 'abcd' });
        expect(ds.servername).toBe('up.example.com');
    });

    it('Clash 源依赖下行继承 TLS 时保持 TLS，显式 tls:false 则不继承', () => {
        const proxy = {
            name: 'node',
            type: 'vless',
            server: '1.2.3.4',
            port: 443,
            uuid: 'uuid',
            network: 'xhttp',
            tls: true,
            servername: 'up.example.com',
            alpn: ['h2'],
            'xhttp-opts': {
                path: '/up',
                mode: 'stream-up',
                'download-settings': { server: 'cdn.example.com', port: 443 },
            },
        };

        const url = convertClashProxyToUrl(proxy);
        const extra = JSON.parse(decodeURIComponent(url.match(/(?:\?|&)extra=([^&#]*)/)[1]));
        expect(extra.downloadSettings.security).toBe('tls');
        expect(extra.downloadSettings.tlsSettings).toEqual({
            serverName: 'up.example.com',
            alpn: ['h2'],
        });

        const ds = urlToClashProxy(url)['xhttp-opts']['download-settings'];
        expect(ds.tls).toBe(true);
        expect(ds.servername).toBe('up.example.com');
        expect(ds.alpn).toEqual(['h2']);

        const offUrl = convertClashProxyToUrl({
            ...proxy,
            'xhttp-opts': {
                ...proxy['xhttp-opts'],
                'download-settings': { server: 'cdn.example.com', port: 443, tls: false },
            },
        });
        const offExtra = JSON.parse(decodeURIComponent(offUrl.match(/(?:\?|&)extra=([^&#]*)/)[1]));
        expect(offExtra.downloadSettings.security).toBeUndefined();
    });
});
