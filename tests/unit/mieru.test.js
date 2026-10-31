import { describe, expect, it, vi } from 'vitest';
import yaml from 'js-yaml';
import { generateBuiltinClashConfig, generateProxiesOnly } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { parseNodeList } from '../../functions/modules/utils/node-parser.js';
import { fetchSubscriptionNodes } from '../../functions/modules/subscription/node-fetcher.js';
import { convertClashProxyToUrl } from '../../functions/utils/clash-to-url.js';
import { urlToClashProxy } from '../../functions/utils/url-to-clash.js';

const MIHOMO_MIERU_YAML = `proxies:
  - name: Mieru 文档节点
    type: mieru
    server: mieru.example.com
    port: 443
    username: '[REDACTED]'
    password: '[REDACTED]'
    transport: TCP
    udp: true
    multiplexing: true
    handshake-mode: standard
    mtu: 1400
    profile: default
`;

describe('Mihomo mieru YAML 导入', () => {
    it('parseNodeList converts Mihomo mieru proxies to the internal mierus URL', () => {
        const nodes = parseNodeList(MIHOMO_MIERU_YAML);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].url).toMatch(/^mierus:\/\//);
        expect(urlToClashProxy(nodes[0].url)).toMatchObject({
            type: 'mieru', name: 'Mieru 文档节点', server: 'mieru.example.com', port: 443,
            username: '[REDACTED]', password: '[REDACTED]', transport: 'TCP', udp: true,
            multiplexing: true, 'handshake-mode': 'standard', mtu: 1400, profile: 'default',
        });
    });

    it('round-trips Mieru fields and safely encodes reserved URL characters', () => {
        const proxy = { name: 'Mieru 节点 #1', type: 'mieru', server: 'mieru.example.com', port: 443,
            username: '[REDACTED]', password: '[REDACTED]&+/#', transport: 'TCP', udp: true,
            multiplexing: true, 'handshake-mode': 'standard', mtu: 1400, profile: 'default' };
        const url = convertClashProxyToUrl(proxy);
        expect(url).toMatch(/^mierus:\/\//);
        expect(urlToClashProxy(url)).toMatchObject(proxy);
        expect(parseNodeList(url)).toHaveLength(1);
    });

    it('fetchSubscriptionNodes returns the Mieru URL from subscription YAML', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(MIHOMO_MIERU_YAML)));
        try {
            const result = await fetchSubscriptionNodes('https://sub.example.test', 'test', 'test');
            expect(result.nodes).toHaveLength(1);
            expect(result.nodes[0].url).toMatch(/^mierus:\/\//);
        } finally { vi.unstubAllGlobals(); }
    });

    it('generateProxiesOnly sends Mieru through the URL pipeline into YAML', () => {
        const nodeUrl = parseNodeList(MIHOMO_MIERU_YAML)[0].url;
        const output = yaml.load(generateProxiesOnly(nodeUrl));
        expect(output.proxies[0]).toMatchObject({ type: 'mieru', server: 'mieru.example.com', port: 443,
            username: '[REDACTED]', password: '[REDACTED]', transport: 'TCP', udp: true,
            multiplexing: true, 'handshake-mode': 'standard', mtu: 1400, profile: 'default' });
    });

    it('应将 mierus URL 经 Clash 订阅生成器输出为 Mihomo 节点', () => {
        const nodeUrl = parseNodeList(MIHOMO_MIERU_YAML)[0].url;
        const output = yaml.load(generateBuiltinClashConfig(nodeUrl));
        expect(output.proxies[0]).toMatchObject({
            name: expect.stringContaining('Mieru 文档节点'), server: 'mieru.example.com', port: 443,
            username: '[REDACTED]', password: '[REDACTED]', transport: 'TCP', udp: true,
            multiplexing: true, 'handshake-mode': 'standard', mtu: 1400, profile: 'default',
        });
    });

    it('应将 mierus URL 经 Clash 订阅生成器输出为 Mihomo 节点', () => {
        const nodeUrl = parseNodeList(MIHOMO_MIERU_YAML)[0].url;
        const output = yaml.load(generateBuiltinClashConfig(nodeUrl));
        expect(output.proxies[0]).toMatchObject({
            name: expect.stringContaining('Mieru 文档节点'), server: 'mieru.example.com', port: 443,
            username: '[REDACTED]', password: '[REDACTED]', transport: 'TCP', udp: true,
            multiplexing: true, 'handshake-mode': 'standard', mtu: 1400, profile: 'default',
        });
    });
});
