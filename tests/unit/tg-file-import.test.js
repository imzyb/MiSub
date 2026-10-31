import { describe, it, expect } from 'vitest';
import { extractValidNodes } from '../../functions/modules/utils/node-parser.js';

/**
 * TG 文件导入解析测试。
 *
 * 场景：用户把节点文件（Clash YAML / sing-box JSON / 纯文本 / Base64）
 * 直接甩给 Telegram Bot，Bot 下载后需能解析出节点。
 * 这里验证复用的 extractValidNodes 对各格式的解析能力。
 */

const SS_LINE = 'ss://YWVzLTI1Ni1nY206cHc@1.2.3.4:443#HK01';

describe('TG 文件导入 - 解析能力', () => {
    it('纯文本节点链接', () => {
        const text = [SS_LINE, 'vless://uuid-1234@5.6.7.8:443?security=tls#JP01'].join('\n');
        const nodes = extractValidNodes(text);
        expect(nodes).toHaveLength(2);
        expect(nodes[0]).toContain('ss://');
    });

    it('Base64 订阅内容', () => {
        const b64 = btoa(SS_LINE + '\n');
        const nodes = extractValidNodes(b64);
        expect(nodes.length).toBeGreaterThan(0);
        expect(nodes[0]).toContain('ss://');
    });

    it('Clash YAML（proxies 列表）', () => {
        const yaml = [
            'proxies:',
            '  - name: HK01',
            '    type: ss',
            '    server: 1.2.3.4',
            '    port: 443',
            '    cipher: aes-256-gcm',
            '    password: pw',
        ].join('\n');
        const nodes = extractValidNodes(yaml);
        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toContain('ss://');
        expect(nodes[0]).toContain('HK01');
    });

    it('sing-box JSON（outbounds）', () => {
        const cfg = JSON.stringify({
            outbounds: [
                {
                    type: 'anytls',
                    tag: 'at',
                    server: '1.1.1.1',
                    server_port: 443,
                    password: 'pw',
                    tls: { enabled: true, server_name: 'a.com' },
                },
                { type: 'direct', tag: 'direct' },
            ],
        });
        const nodes = extractValidNodes(cfg);
        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toContain('anytls://');
    });

    it('无法解析的内容返回空数组', () => {
        expect(extractValidNodes('这是一段普通文本，没有任何节点')).toEqual([]);
        expect(extractValidNodes('')).toEqual([]);
    });
});
