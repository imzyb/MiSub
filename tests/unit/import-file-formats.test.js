import { describe, it, expect } from 'vitest';
import { parseNodeList } from '../../functions/modules/utils/node-parser.js';

/**
 * 覆盖 /api/parse_subscription 的后端解析能力：
 * 上传文件导入（纯文本 / Base64 / Clash / Surge / sing-box JSON）时
 * 内容都会送到 parseNodeList。这里保证各格式都能解析出节点。
 */

const SAMPLE_VLESS =
    'vless://9fc428ed-70fd-4885-8964-636c4678044e@au01.bsxis.org:443?encryption=none&security=reality&type=tcp&sni=www.apple.com&fp=chrome&pbk=Vc8ycAgKqfRvtXjvGP0ry_U91o5wgrQlqOhHq72HYRs&sid=1bc2c1ef1c&flow=xtls-rprx-vision#au01';
const SAMPLE_TROJAN =
    'trojan://Trojan%4082164024@ca.tronsg.com:443?sni=ca.tronsg.com&security=tls&type=tcp#ca';
const SAMPLE_SS = 'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@1.2.3.4:8388#ssnode';

const count = (content) => parseNodeList(content).filter((node) => node && node.url).length;

describe('parseNodeList supports uploaded file formats', () => {
    it('parses plaintext node links', () => {
        const text = [SAMPLE_VLESS, SAMPLE_TROJAN, SAMPLE_SS].join('\n');
        expect(count(text)).toBe(3);
    });

    it('parses base64-encoded subscription body', () => {
        const text = [SAMPLE_VLESS, SAMPLE_TROJAN, SAMPLE_SS].join('\n');
        const encoded = Buffer.from(text, 'utf8').toString('base64');
        expect(count(encoded)).toBe(3);
    });

    it('parses clash yaml proxies', () => {
        const yaml = `proxies:
  - name: "hk-node"
    type: vmess
    server: 1.2.3.4
    port: 443
    uuid: 9fc428ed-70fd-4885-8964-636c4678044e
    cipher: auto
    tls: true
  - name: "jp-node"
    type: ss
    server: 5.6.7.8
    port: 8388
    cipher: aes-256-gcm
    password: testpass
`;
        expect(count(yaml)).toBe(2);
    });

    it('parses Clash HTTP proxies with plaintext credentials during file import', () => {
        const yaml = `proxies:\n  - name: \"office-http\"\n    type: http\n    server: 192.0.2.10\n    port: 8080\n    username: alice\n    password: secret\n    tls: false\n`;
        const nodes = parseNodeList(yaml).filter((node) => node && node.url);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].url).toBe('http://alice:secret@192.0.2.10:8080#office-http');
        expect(nodes[0].protocol).toBe('http');
    });

    it('parses full clash meta config (proxies + rules)', () => {
        const yaml = `mixed-port: 7890
proxies:
  - name: "n1"
    type: trojan
    server: 9.9.9.9
    port: 443
    password: pw
    sni: a.com
rules:
  - MATCH,DIRECT
`;
        expect(count(yaml)).toBe(1);
    });

    it('parses surge proxy section', () => {
        const surge = `[Proxy]
hk = vmess, 1.2.3.4, 443, username=9fc428ed-70fd-4885-8964-636c4678044e, tls=true
jp = ss, 5.6.7.8, 8388, encrypt-method=aes-256-gcm, password=testpass
`;
        expect(count(surge)).toBe(2);
    });

    it('parses sing-box outbounds json', () => {
        const cfg = {
            outbounds: [
                {
                    type: 'vless',
                    tag: 's1',
                    server: '1.2.3.4',
                    server_port: 443,
                    uuid: '9fc428ed-70fd-4885-8964-636c4678044e',
                    tls: { enabled: true, server_name: 'a.com' },
                },
            ],
        };
        expect(count(JSON.stringify(cfg))).toBe(1);
    });

    it('parses sing-box config across multiple protocols and skips non-proxy outbounds', () => {
        const cfg = {
            outbounds: [
                {
                    type: 'vless',
                    tag: 'vless-1',
                    server: '1.1.1.1',
                    server_port: 443,
                    uuid: '9fc428ed-70fd-4885-8964-636c4678044e',
                    flow: 'xtls-rprx-vision',
                    tls: {
                        enabled: true,
                        server_name: 'www.apple.com',
                        reality: { enabled: true, public_key: 'PBKEY', short_id: 'abcd' },
                    },
                },
                {
                    type: 'vmess',
                    tag: 'vmess-1',
                    server: '2.2.2.2',
                    server_port: 8080,
                    uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                    transport: { type: 'ws', path: '/ws', host: 'cdn.example.com' },
                },
                {
                    type: 'trojan',
                    tag: 'trojan-1',
                    server: '3.3.3.3',
                    server_port: 443,
                    password: 'mypass',
                    tls: { enabled: true, server_name: 'trojan.example.com' },
                },
                {
                    type: 'shadowsocks',
                    tag: 'ss-1',
                    server: '4.4.4.4',
                    server_port: 8388,
                    method: 'aes-256-gcm',
                    password: 'sspass',
                },
                {
                    type: 'hysteria2',
                    tag: 'hy2-1',
                    server: '5.5.5.5',
                    server_port: 443,
                    password: 'hy2pass',
                    tls: { enabled: true, server_name: 'hy2.example.com', insecure: true },
                },
                {
                    type: 'anytls',
                    tag: 'anytls-1',
                    server: '6.6.6.6',
                    server_port: 443,
                    password: 'atpass',
                    tls: { enabled: true, server_name: 'at.example.com' },
                },
                { type: 'direct', tag: 'DIRECT' },
                { type: 'selector', tag: 'select', outbounds: ['vless-1', 'DIRECT'] },
            ],
        };

        const nodes = parseNodeList(JSON.stringify(cfg)).filter((node) => node && node.url);
        expect(nodes).toHaveLength(6);
        const types = nodes.map((node) => node.url.split('://')[0]).sort();
        expect(types).toEqual(['anytls', 'hysteria2', 'ss', 'trojan', 'vless', 'vmess']);
    });

    it('parses anytls link', () => {
        const anytls =
            'anytls://YzQ6ZWI2YS1jNzU2LTQ1MzMtYWI5My0zMzY0LWNkMmQ0NjBiOGU3@103.152.37.88:443/?insecure=1&sni=a.com#jd1';
        expect(count(anytls)).toBe(1);
    });

    it('returns empty list for empty or junk content', () => {
        expect(count('')).toBe(0);
        expect(count('this is not a node file')).toBe(0);
    });
});
