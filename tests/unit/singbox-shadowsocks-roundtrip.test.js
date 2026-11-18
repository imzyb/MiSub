import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { parseNodeList } from '../../functions/modules/utils/node-parser.js';
import { urlToClashProxy } from '../../functions/utils/url-to-clash.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
} from '../../functions/modules/subscription/template-pipeline.js';

const source = {
    type: 'shadowsocks',
    tag: 'SS 测试',
    server: 'ss.example.com',
    server_port: 2377,
    method: 'chacha20-ietf-poly1305',
    password: 'test-password',
    plugin: 'obfs-local',
    plugin_opts: 'obfs=tls;obfs-host=cdn.example.com:123456',
    udp_over_tcp: true,
};

function importOutbound(outbound) {
    return parseNodeList(JSON.stringify({ outbounds: [outbound] }))[0].url;
}

describe('Sing-box Shadowsocks 参数保留', () => {
    it('导入时使用 SIP002 插件参数并保留 UDP-over-TCP', () => {
        const url = new URL(importOutbound(source));

        expect(url.searchParams.get('plugin')).toBe(`${source.plugin};${source.plugin_opts}`);
        expect(url.searchParams.get('uot')).toBe('1');
    });

    it.each(['http', 'tls'])('将 %s 混淆映射为 Clash 参数而非普通 TLS', (mode) => {
        const proxy = urlToClashProxy(
            importOutbound({
                ...source,
                plugin_opts: `obfs=${mode};obfs-host=cdn.example.com:123456`,
            })
        );

        expect(proxy).toMatchObject({
            server: source.server,
            port: source.server_port,
            cipher: source.method,
            password: source.password,
            plugin: 'obfs',
            'plugin-opts': { mode, host: 'cdn.example.com:123456' },
            udp: true,
            'udp-over-tcp': true,
        });
        expect(proxy.tls).toBeUndefined();
    });

    it.each([
        ['内置', (nodeList) => generateBuiltinSingboxConfig(nodeList, { addFlagEmoji: false })],
        [
            '模板',
            (nodeList) =>
                renderSingboxFromIniTemplate('[Proxy]', { nodeList, addFlagEmoji: false }),
        ],
    ])('%s Sing-box 输出保留完整 SS 出站配置', (_name, render) => {
        const config = JSON.parse(render(importOutbound(source)));
        const outbound = config.outbounds.find((item) => item.type === 'shadowsocks');

        expect(outbound).toMatchObject(source);
        expect(outbound.tls).toBeUndefined();
        expect(outbound.transport).toBeUndefined();
    });

    it('Clash 模板输出保留混淆和 UDP-over-TCP', () => {
        const config = yaml.load(
            renderClashFromIniTemplate('[Proxy]', {
                nodeList: importOutbound(source),
                addFlagEmoji: false,
            })
        );

        expect(config.proxies.find((item) => item.type === 'ss')).toMatchObject({
            plugin: 'obfs',
            'plugin-opts': { mode: 'tls', host: 'cdn.example.com:123456' },
            udp: true,
            'udp-over-tcp': true,
        });
    });

    it('完整模板中的自动测速分组不含选择器专属的 default 字段', () => {
        const config = JSON.parse(
            renderSingboxFromIniTemplate(
                '[Proxy Group]\n测速组 = url-test, SS 测试\n手动组 = select, SS 测试, DIRECT\n[Rule]\nMATCH,手动组',
                { nodeList: importOutbound(source), addFlagEmoji: false }
            )
        );
        const urltest = config.outbounds.find((item) => item.tag === '测速组');
        const selector = config.outbounds.find((item) => item.tag === '手动组');

        expect(urltest.type).toBe('urltest');
        expect(urltest.default).toBeUndefined();
        expect(selector.default).toBe('SS 测试');
    });

    it('普通 SS 出站不会新增插件或 UDP-over-TCP 参数', () => {
        const { plugin, plugin_opts, udp_over_tcp, ...plain } = source;
        const url = new URL(importOutbound(plain));

        expect(url.search).toBe('');
        expect(urlToClashProxy(url.toString()).password).toBe(source.password);
    });
});
