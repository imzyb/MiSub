import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { convertClashProxyToUrl } from '../../functions/utils/clash-to-url.js';
import { urlToClashProxy, urlsToClashProxies } from '../../functions/utils/url-to-clash.js';
import { extractValidNodes } from '../../functions/modules/utils/node-parser.js';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';

const stripGeneratedFields = (proxy) => {
    const { metadata, ...rest } = proxy;
    return rest;
};

const expectRoundTrip = (proxy, expected) => {
    const url = convertClashProxyToUrl(proxy);
    expect(url).toBeTruthy();

    const parsed = urlToClashProxy(url);
    expect(parsed).toMatchObject(expected);

    const [batched] = urlsToClashProxies([url], { addFlagEmoji: false });
    expect(stripGeneratedFields(batched)).toMatchObject(expected);
};

const expectParseOnly = (url, expected) => {
    const parsed = urlToClashProxy(url);
    expect(parsed).toMatchObject(expected);

    const [batched] = urlsToClashProxies([url], { addFlagEmoji: false });
    expect(stripGeneratedFields(batched)).toMatchObject(expected);
};

const base64UrlSafeEncode = (value) => Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

describe('protocol conversion fixtures', () => {
    it('preserves common proxy fields across Clash proxy -> URL -> Clash proxy round trips', () => {
        const fixtures = [
            {
                proxy: {
                    name: 'Fixture SS Obfs',
                    type: 'ss',
                    server: 'ss.example.com',
                    port: 8388,
                    cipher: 'chacha20-ietf-poly1305',
                    password: 'ss-pass',
                    plugin: 'obfs',
                    'plugin-opts': {
                        mode: 'tls',
                        host: 'cdn.example.com'
                    }
                },
                expected: {
                    name: 'Fixture SS Obfs',
                    type: 'ss',
                    server: 'ss.example.com',
                    port: 8388,
                    cipher: 'chacha20-ietf-poly1305',
                    password: 'ss-pass',
                    plugin: 'obfs',
                    'plugin-opts': {
                        mode: 'tls',
                        host: 'cdn.example.com'
                    }
                }
            },
            {
                proxy: {
                    name: 'Fixture SSR',
                    type: 'ssr',
                    server: 'ssr.example.com',
                    port: 12345,
                    protocol: 'auth_aes128_sha1',
                    cipher: 'chacha20-ietf',
                    obfs: 'http_simple',
                    password: 'ssr-pass',
                    'obfs-param': 'download.example.com',
                    'protocol-param': '32:token'
                },
                expected: {
                    name: 'Fixture SSR',
                    type: 'ssr',
                    server: 'ssr.example.com',
                    port: 12345,
                    protocol: 'auth_aes128_sha1',
                    cipher: 'chacha20-ietf',
                    obfs: 'http_simple',
                    password: 'ssr-pass',
                    'obfs-param': 'download.example.com',
                    'protocol-param': '32:token'
                }
            },
            {
                proxy: {
                    name: 'Fixture VMess WS',
                    type: 'vmess',
                    server: 'vmess.example.com',
                    port: 443,
                    uuid: '11111111-1111-4111-8111-111111111111',
                    alterId: 0,
                    cipher: 'auto',
                    network: 'ws',
                    tls: true,
                    sni: 'vmess-sni.example.com',
                    'client-fingerprint': 'chrome',
                    'ws-opts': {
                        path: '/ws',
                        headers: { Host: 'front.example.com' }
                    }
                },
                expected: {
                    name: 'Fixture VMess WS',
                    type: 'vmess',
                    server: 'vmess.example.com',
                    port: 443,
                    uuid: '11111111-1111-4111-8111-111111111111',
                    alterId: 0,
                    cipher: 'auto',
                    network: 'ws',
                    tls: true,
                    servername: 'vmess-sni.example.com',
                    'client-fingerprint': 'chrome',
                    'ws-opts': {
                        path: '/ws',
                        headers: { Host: 'front.example.com' }
                    }
                }
            },
            {
                proxy: {
                    name: 'Fixture VLESS Reality',
                    type: 'vless',
                    server: 'vless.example.com',
                    port: 443,
                    uuid: '22222222-2222-4222-8222-222222222222',
                    network: 'grpc',
                    tls: true,
                    servername: 'www.example.com',
                    flow: 'xtls-rprx-vision',
                    'client-fingerprint': 'chrome',
                    'dialer-proxy': '前置节点',
                    'reality-opts': {
                        'public-key': 'public-key-value',
                        'short-id': 'abcd',
                        'spider-x': '/'
                    },
                    'grpc-opts': {
                        'grpc-service-name': 'update',
                        'grpc-mode': 'gun'
                    }
                },
                expected: {
                    name: 'Fixture VLESS Reality',
                    type: 'vless',
                    server: 'vless.example.com',
                    port: 443,
                    uuid: '22222222-2222-4222-8222-222222222222',
                    network: 'grpc',
                    tls: true,
                    servername: 'www.example.com',
                    sni: 'www.example.com',
                    flow: 'xtls-rprx-vision',
                    'client-fingerprint': 'chrome',
                    'dialer-proxy': '前置节点',
                    'reality-opts': {
                        'public-key': 'public-key-value',
                        'short-id': 'abcd',
                        'spider-x': '/'
                    },
                    'grpc-opts': {
                        'grpc-service-name': 'update',
                        'grpc-mode': 'gun'
                    }
                }
            },
            {
                proxy: {
                    name: 'Fixture Trojan WS',
                    type: 'trojan',
                    server: 'trojan.example.com',
                    port: 443,
                    password: 'tr@jan:pass',
                    network: 'ws',
                    sni: 'trojan-sni.example.com',
                    'skip-cert-verify': true,
                    'ws-opts': {
                        path: '/trojan',
                        headers: { Host: 'trojan-front.example.com' }
                    }
                },
                expected: {
                    name: 'Fixture Trojan WS',
                    type: 'trojan',
                    server: 'trojan.example.com',
                    port: 443,
                    password: 'tr@jan:pass',
                    network: 'ws',
                    servername: 'trojan-sni.example.com',
                    sni: 'trojan-sni.example.com',
                    'skip-cert-verify': true,
                    'ws-opts': {
                        path: '/trojan',
                        headers: { Host: 'trojan-front.example.com' }
                    }
                }
            },
            {
                proxy: {
                    name: 'Fixture HY2 Realm',
                    type: 'hysteria2',
                    server: 'hy2.example.com',
                    port: 443,
                    password: 'hy2-pass',
                    sni: 'hy2-sni.example.com',
                    obfs: 'salamander',
                    'obfs-password': 'obfs-pass',
                    'skip-cert-verify': true,
                    'realm-opts': {
                        enable: true,
                        'realm-id': 'realm-id-value',
                        token: 'realm-token-value',
                        'server-url': 'https://realm.example.com',
                        'stun-servers': ['stun.example.com:3478', 'stun2.example.com:3478']
                    }
                },
                expected: {
                    name: 'Fixture HY2 Realm',
                    type: 'hysteria2',
                    server: 'hy2.example.com',
                    port: 443,
                    password: 'hy2-pass',
                    servername: 'hy2-sni.example.com',
                    sni: 'hy2-sni.example.com',
                    obfs: 'salamander',
                    'obfs-password': 'obfs-pass',
                    'skip-cert-verify': true,
                    'realm-opts': {
                        enable: true,
                        'realm-id': 'realm-id-value',
                        token: 'realm-token-value',
                        'server-url': 'https://realm.example.com',
                        'stun-servers': ['stun.example.com:3478', 'stun2.example.com:3478']
                    }
                }
            },
            {
                proxy: {
                    name: 'Fixture TUIC',
                    type: 'tuic',
                    server: 'tuic.example.com',
                    port: 443,
                    uuid: '33333333-3333-4333-8333-333333333333',
                    password: 'p@ss:word%23?x',
                    sni: 'tuic-sni.example.com',
                    alpn: ['h3'],
                    'skip-cert-verify': true,
                    'congestion-controller': 'bbr',
                    'udp-relay-mode': 'native',
                    'zero-rtt-handshake': true,
                    heartbeat: '10s'
                },
                expected: {
                    name: 'Fixture TUIC',
                    type: 'tuic',
                    server: 'tuic.example.com',
                    port: 443,
                    uuid: '33333333-3333-4333-8333-333333333333',
                    password: 'p@ss:word%23?x',
                    servername: 'tuic-sni.example.com',
                    sni: 'tuic-sni.example.com',
                    alpn: ['h3'],
                    'skip-cert-verify': true,
                    'congestion-controller': 'bbr',
                    'udp-relay-mode': 'native',
                    'zero-rtt-handshake': true,
                    'reduce-rtt': true,
                    heartbeat: '10s'
                }
            },
            {
                proxy: {
                    name: 'Fixture SOCKS5',
                    type: 'socks5',
                    server: 'socks.example.com',
                    port: 1080,
                    username: 'user',
                    password: 'p@ss:word'
                },
                expected: {
                    name: 'Fixture SOCKS5',
                    type: 'socks5',
                    server: 'socks.example.com',
                    port: 1080,
                    username: 'user',
                    password: 'p@ss:word',
                    udp: false
                }
            },
            {
                proxy: {
                    name: 'Fixture Snell',
                    type: 'snell',
                    server: 'snell.example.com',
                    port: 440,
                    psk: 'snell-pass',
                    version: 3,
                    reuse: true,
                    tfo: true,
                    'obfs-opts': {
                        mode: 'tls',
                        host: 'snell-front.example.com'
                    },
                    ecn: true
                },
                expected: {
                    name: 'Fixture Snell',
                    type: 'snell',
                    server: 'snell.example.com',
                    port: 440,
                    psk: 'snell-pass',
                    version: 3,
                    reuse: true,
                    tfo: true,
                    'obfs-opts': {
                        mode: 'tls',
                        host: 'snell-front.example.com'
                    },
                    ecn: true
                }
            },
            {
                proxy: {
                    name: 'Fixture AnyTLS',
                    type: 'anytls',
                    server: 'anytls.example.com',
                    port: 443,
                    password: 'anytls-pass',
                    sni: 'anytls-sni.example.com',
                    alpn: ['h2', 'http/1.1'],
                    'skip-cert-verify': true,
                    pinnedPeerCertSha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                    padding: true
                },
                expected: {
                    name: 'Fixture AnyTLS',
                    type: 'anytls',
                    server: 'anytls.example.com',
                    port: 443,
                    password: 'anytls-pass',
                    servername: 'anytls-sni.example.com',
                    sni: 'anytls-sni.example.com',
                    alpn: ['h2', 'http/1.1'],
                    'skip-cert-verify': true,
                    pinnedPeerCertSha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                    udp: true
                }
            },
            {
                proxy: {
                    name: 'Fixture WireGuard',
                    type: 'wireguard',
                    server: 'wg.example.com',
                    port: 51820,
                    'private-key': 'private-key-value',
                    'public-key': 'public-key-value',
                    ip: ['172.16.0.2/32', '2606:4700:110:abcd::2/128'],
                    'allowed-ips': ['0.0.0.0/0', '::/0'],
                    reserved: [1, 2, 3],
                    mtu: 1280,
                    dns: ['1.1.1.1', '2606:4700:4700::1111'],
                    'persistent-keepalive': 25,
                    'preshared-key': 'psk-value'
                },
                expected: {
                    name: 'Fixture WireGuard',
                    type: 'wireguard',
                    server: 'wg.example.com',
                    port: 51820,
                    'private-key': 'private-key-value',
                    'remote-dns-resolve': true,
                    udp: true,
                    'public-key': 'public-key-value',
                    ip: ['172.16.0.2/32', '2606:4700:110:abcd::2/128'],
                    'allowed-ips': ['0.0.0.0/0', '::/0'],
                    reserved: [1, 2, 3],
                    mtu: 1280,
                    dns: ['1.1.1.1', '2606:4700:4700::1111'],
                    'persistent-keepalive': 25,
                    'preshared-key': 'psk-value'
                }
            }
        ];

        for (const fixture of fixtures) {
            expectRoundTrip(fixture.proxy, fixture.expected);
        }
    });

    it('preserves parse-only protocol contracts for supported import schemes', () => {
        const ssdUrl = `ssd://${base64UrlSafeEncode(JSON.stringify({
            encryption: 'aes-256-gcm',
            password: 'shared-pass',
            servers: [
                {
                    server: 'ssd.example.com',
                    port: 8443,
                    remarks: 'Fixture SSD',
                    plugin: 'obfs-local',
                    plugin_options: 'cdn.example.com'
                }
            ]
        }))}`;

        const fixtures = [
            {
                url: ssdUrl,
                expected: {
                    name: 'Fixture SSD',
                    type: 'ss',
                    server: 'ssd.example.com',
                    port: 8443,
                    cipher: 'aes-256-gcm',
                    password: 'shared-pass',
                    plugin: 'obfs-local',
                    'plugin-opts': {
                        host: 'cdn.example.com'
                    }
                }
            },
            {
                url: 'https://user:p%40ss%3Aword@https.example.com:443?sni=https-sni.example.com&allowInsecure=1#Fixture%20HTTPS',
                expected: {
                    name: 'Fixture HTTPS',
                    type: 'https',
                    server: 'https.example.com',
                    port: 443,
                    username: 'user',
                    password: 'p@ss:word',
                    servername: 'https-sni.example.com',
                    sni: 'https-sni.example.com',
                    'skip-cert-verify': true,
                    udp: false
                }
            },
            {
                url: 'socks5://user:p%40ss%3Aword@socks-tls.example.com:1081?tls=1&sni=socks-sni.example.com&allowInsecure=1#Fixture%20SOCKS5%20TLS',
                expected: {
                    name: 'Fixture SOCKS5 TLS',
                    type: 'socks5-tls',
                    server: 'socks-tls.example.com',
                    port: 1081,
                    username: 'user',
                    password: 'p@ss:word',
                    udp: false,
                    servername: 'socks-sni.example.com',
                    sni: 'socks-sni.example.com',
                    'skip-cert-verify': true
                }
            },
            {
                url: 'anytls://anytls-parse-pass@anytls-parse.example.com:443?sni=anytls-sni.example.com&pinnedPeerCertSha256=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789#Fixture%20AnyTLS%20Pinned',
                expected: {
                    name: 'Fixture AnyTLS Pinned',
                    type: 'anytls',
                    server: 'anytls-parse.example.com',
                    port: 443,
                    password: 'anytls-parse-pass',
                    servername: 'anytls-sni.example.com',
                    sni: 'anytls-sni.example.com',
                    pinnedPeerCertSha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
                    udp: true
                }
            }
        ];

        for (const fixture of fixtures) {
            expectParseOnly(fixture.url, fixture.expected);
        }
    });

    it('preserves VLESS gRPC service options from Clash YAML through URL and builtin Clash output', () => {
        const clashConfig = `
proxies:
  - name: JP-1
    type: vless
    server: vless.example.com
    port: 443
    uuid: 22222222-2222-4222-8222-222222222222
    network: grpc
    tls: true
    servername: www.example.com
    client-fingerprint: chrome
    reality-opts:
      public-key: public-key-value
      short-id: abcd
    grpc-opts:
      grpc-service-name: update
      grpc-mode: gun
`;

        const nodes = extractValidNodes(clashConfig);

        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toContain('type=grpc');
        expect(nodes[0]).toContain('serviceName=update');
        expect(nodes[0]).toContain('mode=gun');

        const fullConfig = yaml.load(generateBuiltinClashConfig(nodes.join('\n'), { addFlagEmoji: false }));
        expect(fullConfig.proxies[0]).toMatchObject({
            name: 'JP-1',
            type: 'vless',
            network: 'grpc',
            'grpc-opts': {
                'grpc-service-name': 'update',
                'grpc-mode': 'gun'
            }
        });
    });

    it('documents one-way exports whose emitted schemes are not parsed back yet', () => {
        const fixtures = [
            {
                proxy: {
                    name: 'Fixture Hysteria Legacy',
                    type: 'hysteria',
                    server: 'hy.example.com',
                    port: 8443,
                    password: 'hy-pass',
                    protocol: 'udp',
                    sni: 'hy-sni.example.com',
                    'skip-cert-verify': true,
                    up: 100,
                    down: 200
                },
                urlPattern: /^hysteria:\/\/hy-pass@hy\.example\.com:8443\?/,
                requiredParts: [
                    'protocol=udp',
                    'sni=hy-sni.example.com',
                    'insecure=1',
                    'up=100',
                    'down=200',
                    '#Fixture%20Hysteria%20Legacy'
                ]
            },
            {
                proxy: {
                    name: 'Fixture HTTP Export',
                    type: 'http',
                    server: 'http.example.com',
                    port: 8080,
                    username: 'user',
                    password: 'p@ss:word'
                },
                urlPattern: /^http:\/\/user:p%40ss%3Aword@http\.example\.com:8080#Fixture%20HTTP%20Export$/,
                requiredParts: []
            },
            {
                proxy: {
                    name: 'Fixture Naive Export',
                    type: 'naive',
                    server: 'naive.example.com',
                    port: 443,
                    username: 'user',
                    password: 'p@ss:word',
                    padding: true,
                    'extra-headers': 'Host: naive-front.example.com'
                },
                urlPattern: /^naive\+https:\/\/user:p%40ss%3Aword@naive\.example\.com:443\?/,
                requiredParts: [
                    'padding=true',
                    'extra-headers=Host%3A%20naive-front.example.com',
                    '#Fixture%20Naive%20Export'
                ]
            }
        ];

        for (const fixture of fixtures) {
            const url = convertClashProxyToUrl(fixture.proxy);
            expect(url).toMatch(fixture.urlPattern);
            for (const part of fixture.requiredParts) {
                expect(url).toContain(part);
            }
            expect(urlToClashProxy(url)).toBeNull();
            expect(urlsToClashProxies([url])).toEqual([]);
        }
    });
});
