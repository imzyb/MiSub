import { describe, it, expect } from 'vitest';
import { parseSnellUrl, validateSnellNode, extractValidNodes, parseNodeList } from '../../functions/modules/utils/node-parser.js';
import { parseSurgeConfig } from '../../src/utils/protocolConverter.js';

describe('Snell 协议支持', () => {
    describe('parseSnellUrl', () => {
        it('应正确解析基础 Snell URL', () => {
            const url = 'snell://password123@example.com:443?version=5#TestNode';
            const result = parseSnellUrl(url);

            expect(result).toBeTruthy();
            expect(result.type).toBe('snell');
            expect(result.server).toBe('example.com');
            expect(result.port).toBe(443);
            expect(result.psk).toBe('password123');
            expect(result.version).toBe(5);
            expect(result.name).toBe('TestNode');
        });

        it('应正确解析带 reuse 和 tfo 参数的 Snell URL', () => {
            const url = 'snell://password123@example.com:443?version=5&reuse=true&tfo=true#TestNode';
            const result = parseSnellUrl(url);

            expect(result).toBeTruthy();
            expect(result.reuse).toBe(true);
            expect(result.tfo).toBe(true);
        });

        it('应忽略不支持的参数（如 ecn）', () => {
            const url = 'snell://password123@example.com:443?version=5&reuse=true&tfo=true&ecn=true#TestNode';
            const result = parseSnellUrl(url);

            expect(result).toBeTruthy();
            expect(result.reuse).toBe(true);
            expect(result.tfo).toBe(true);
        });

        it('应正确解析带混淆参数的 Snell URL', () => {
            const url = 'snell://password123@example.com:443?version=5&obfs=http&obfs-host=cloudflare.com#TestNode';
            const result = parseSnellUrl(url);

            expect(result).toBeTruthy();
            expect(result['obfs-opts']).toBeTruthy();
            expect(result['obfs-opts'].mode).toBe('http');
            expect(result['obfs-opts'].host).toBe('cloudflare.com');
        });

        it('应处理 URL 编码的参数', () => {
            const url = 'snell://pass%40word%23123@example.com:443?version=5#Test%20Node';
            const result = parseSnellUrl(url);

            expect(result).toBeTruthy();
            expect(result.psk).toBe('pass@word#123');
            expect(result.name).toBe('Test Node');
        });
    });

    describe('validateSnellNode', () => {
        it('应验证有效的 Snell 节点', () => {
            const url = 'snell://password123@example.com:443?version=5#TestNode';
            const result = validateSnellNode(url);

            expect(result.valid).toBe(true);
            expect(result.proxy).toBeTruthy();
        });

        it('应拒绝无效的版本号', () => {
            const url = 'snell://password123@example.com:443?version=10#TestNode';
            const result = validateSnellNode(url);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('版本号无效');
            expect(result.details.version).toBe(10);
        });

        it('应拒绝不支持的混淆模式', () => {
            const url = 'snell://password123@example.com:443?obfs=invalid#TestNode';
            const result = validateSnellNode(url);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('不支持的混淆模式');
        });

        it('应拒绝无效的端口号', () => {
            const url = 'snell://password123@example.com:99999#TestNode';
            const result = validateSnellNode(url);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('端口号无效');
        });

        it('应拒绝非 Snell 协议 URL', () => {
            const url = 'ss://password123@example.com:443#TestNode';
            const result = validateSnellNode(url);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('不是 Snell 协议');
        });
    });

    describe('Surge Snell 配置解析', () => {
        it('应正确解析基础 Surge Snell 配置', () => {
            const config = `[Proxy]
US-Snell = snell, us.example.com, 443, psk=password123, version=5`;

            const nodes = parseSurgeConfig(config);

            expect(nodes).toHaveLength(1);
            expect(nodes[0].name).toBe('US-Snell');
            expect(nodes[0].protocol).toBe('snell');
            expect(nodes[0].url).toContain('snell://');
            expect(nodes[0].url).toContain('version=5');
        });

        it('应正确解析带 reuse 和 tfo 的 Surge Snell 配置', () => {
            const config = `[Proxy]
HK-Snell = snell, hk.example.com, 443, psk=password123, version=5, reuse=true, tfo=true`;

            const nodes = parseSurgeConfig(config);

            expect(nodes).toHaveLength(1);
            expect(nodes[0].url).toContain('version=5');
            expect(nodes[0].url).toContain('reuse=true');
            expect(nodes[0].url).toContain('tfo=true');
        });

        it('应正确解析带混淆的 Surge Snell 配置', () => {
            const config = `[Proxy]
JP-Snell = snell, jp.example.com, 443, psk=password123, version=5, obfs=http, obfs-host=cloudflare.com`;

            const nodes = parseSurgeConfig(config);

            expect(nodes).toHaveLength(1);
            expect(nodes[0].url).toContain('obfs=http');
            expect(nodes[0].url).toContain('obfs-host=cloudflare.com');
        });

        it('应正确解析完整参数的 Surge Snell 配置', () => {
            // 测试包含各类参数以及等号周围带有空格的配置
            const config = `Full-Snell = snell, full.example.com, 443, psk=password123, version=5, obfs=tls, obfs-host=example.com, reuse=true, tfo=true
🇺🇸Snell - US = snell, image.apple.com, 443, psk = RygGbqC47muxRlJUaWiS, version = 5, reuse = true, tfo = true`;
            const nodes = extractValidNodes(config);
            
            expect(nodes.length).toBe(2);
            expect(nodes[0]).toContain('Full-Snell');
            expect(nodes[0]).toContain('obfs=tls');
            expect(nodes[0]).toContain('reuse=true');

            // 验证用户提供的带空格格式的解析
            expect(nodes[1]).toContain('Snell%20-%20US'); // hash URL encoded
            expect(nodes[1]).toContain('image.apple.com');
            expect(nodes[1]).toContain('443');
            expect(nodes[1]).toContain('RygGbqC47muxRlJUaWiS');
            expect(nodes[1]).toContain('version=5');
            expect(nodes[1]).toContain('reuse=true');
            expect(nodes[1]).toContain('tfo=true');
        });

        it('应在前端 Surge 解析器中兼容带空格名称和键值空格的 Snell 配置', () => {
            const config = `🇺🇸Snell - US = snell, image.apple.com, 443, psk = RygGbqC47muxRlJUaWiS, version = 5, reuse = true, tfo = true`;

            const nodes = parseSurgeConfig(config);

            expect(nodes).toHaveLength(1);
            expect(nodes[0].name).toBe('🇺🇸Snell - US');
            expect(nodes[0].protocol).toBe('snell');
            expect(nodes[0].url).toContain('image.apple.com');
            expect(nodes[0].url).toContain('version=5');
            expect(nodes[0].url).toContain('reuse=true');
            expect(nodes[0].url).toContain('tfo=true');
        });

        it('应忽略缺少 PSK 的 Snell 配置', () => {
            const config = `[Proxy]
Invalid-Snell = snell, invalid.example.com, 443, version=5`;

            const nodes = parseSurgeConfig(config);

            expect(nodes).toHaveLength(0);
        });
    });

    describe('Surge VMess 配置解析增强', () => {
        it('应正确解析带完整参数的 VMess 配置', () => {
            const config = `[Proxy]
VMess-Node = vmess, vmess.example.com, 443, username=uuid-1234, alterid=0, network=ws, path=/path, host=example.com, tls=true`;

            const nodes = parseSurgeConfig(config);

            expect(nodes).toHaveLength(1);
            expect(nodes[0].name).toBe('VMess-Node');
            expect(nodes[0].protocol).toBe('vmess');
            expect(nodes[0].url).toContain('vmess://');
        });
    });

    describe('Shadowsocks cipher=none 回归测试', () => {
        it('应解析 Clash YAML 中显式声明 cipher: none 的 SS 节点', () => {
            const config = `proxies:
  - name: SS-None
    type: ss
    server: 1.2.3.4
    port: 8388
    cipher: none
    password: testpass`;

            const nodes = parseNodeList(config);

            expect(nodes).toHaveLength(1);
            expect(nodes[0].protocol).toBe('ss');
            expect(nodes[0].server).toBe('1.2.3.4');
            expect(nodes[0].port).toBe('8388');
        });

        it('应解析 Quantumult X 中 method=none 的 SS 节点', () => {
            const config = 'shadowsocks=1.2.3.4:8388, method=none, password=testpass, tag=SS None';

            const nodes = parseNodeList(config);

            expect(nodes).toHaveLength(1);
            expect(nodes[0].protocol).toBe('ss');
            expect(nodes[0].server).toBe('1.2.3.4');
            expect(nodes[0].port).toBe('8388');
        });
    });

    describe('混合配置解析', () => {
        it('应正确解析包含多种协议的 Surge 配置', () => {
            const config = `[Proxy]
SS-Node = ss, ss.example.com, 8388, aes-256-gcm, password123
Snell-Node = snell, snell.example.com, 443, psk=snellpass, version=5, reuse=true
Trojan-Node = trojan, trojan.example.com, 443, trojanpass`;

            const nodes = parseSurgeConfig(config);

            expect(nodes).toHaveLength(3);
            expect(nodes[0].protocol).toBe('ss');
            expect(nodes[1].protocol).toBe('snell');
            expect(nodes[2].protocol).toBe('trojan');
        });
    });
});
