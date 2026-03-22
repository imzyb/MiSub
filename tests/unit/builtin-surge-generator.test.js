import { describe, it, expect } from 'vitest';
import { generateBuiltinSurgeConfig } from '../../functions/modules/subscription/builtin-surge-generator.js';

describe('Surge 内置生成器', () => {
    describe('基础功能', () => {
        it('应处理空节点列表', () => {
            const result = generateBuiltinSurgeConfig('');
            expect(result).toContain('[General]');
            expect(result).toContain('[Proxy]');
            expect(result).toContain('DIRECT = direct');
            expect(result).toContain('FINAL,DIRECT');
        });

        it('应处理仅含注释的节点列表', () => {
            const result = generateBuiltinSurgeConfig('# 这是注释\n# 另一行注释');
            expect(result).toContain('FINAL,DIRECT');
        });

        it('应生成 MANAGED-CONFIG 头', () => {
            const ss = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#TestSS';
            const result = generateBuiltinSurgeConfig(ss, {
                managedConfigUrl: 'https://example.com/sub',
                interval: 3600
            });
            expect(result).toContain('#!MANAGED-CONFIG https://example.com/sub interval=3600 strict=false');
        });

        it('应正确应用全局 skipCertVerify 设置', () => {
            const trojan = 'trojan://password123@1.2.3.4:443#TestTrojan';
            const result = generateBuiltinSurgeConfig(trojan, { skipCertVerify: true });
            expect(result).toContain('skip-cert-verify=true');
        });
    });

    describe('Shadowsocks (SS)', () => {
        it('应正确生成 SS 代理行', () => {
            const ss = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#TestSS';
            const result = generateBuiltinSurgeConfig(ss);
            expect(result).toContain('TestSS = ss');
            expect(result).toContain('1.2.3.4');
            expect(result).toContain('8388');
            expect(result).toContain('encrypt-method=');
            expect(result).toContain('password=');
        });

        it('应处理 SS UDP', () => {
            // SS URL 解析后的 Clash 对象中 udp=true
            const ss = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#TestSS';
            const result = generateBuiltinSurgeConfig(ss);
            expect(result).toContain('udp-relay=true');
        });

        it('应在启用 UDP 开关时强制开启', () => {
            const ss = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#TestSS';
            const result = generateBuiltinSurgeConfig(ss, { enableUdp: true });
            expect(result).toContain('udp-relay=true');
        });
    });

    describe('VMess', () => {
        it('应正确生成 VMess 代理行', () => {
            const vmessConfig = {
                v: "2", ps: "TestVMess", add: "1.2.3.4", port: "443",
                id: "uuid-1234", aid: "0", net: "tcp", type: "none",
                host: "", path: "", tls: ""
            };
            const vmess = `vmess://${btoa(JSON.stringify(vmessConfig))}`;
            const result = generateBuiltinSurgeConfig(vmess);
            expect(result).toContain('TestVMess = vmess');
            expect(result).toContain('username=uuid-1234');
        });

        it('应默认启用 vmess-aead', () => {
            const vmessConfig = {
                v: "2", ps: "AEADTest", add: "1.2.3.4", port: "443",
                id: "uuid-1234", aid: "0", net: "tcp", type: "none",
                host: "", path: "", tls: ""
            };
            const vmess = `vmess://${btoa(JSON.stringify(vmessConfig))}`;
            const result = generateBuiltinSurgeConfig(vmess);
            expect(result).toContain('vmess-aead=true');
        });

        it('应正确处理 VMess WebSocket', () => {
            const vmessConfig = {
                v: "2", ps: "WSTest", add: "1.2.3.4", port: "443",
                id: "uuid-1234", aid: "0", net: "ws", type: "none",
                host: "example.com", path: "/ws", tls: "tls"
            };
            const vmess = `vmess://${btoa(JSON.stringify(vmessConfig))}`;
            const result = generateBuiltinSurgeConfig(vmess);
            expect(result).toContain('ws=true');
            expect(result).toContain('ws-path=/ws');
            expect(result).toContain('ws-headers=Host:example.com');
            expect(result).toContain('tls=true');
        });
    });

    describe('Trojan', () => {
        it('应正确生成 Trojan 代理行', () => {
            const trojan = 'trojan://password123@1.2.3.4:443#TestTrojan';
            const result = generateBuiltinSurgeConfig(trojan);
            expect(result).toContain('TestTrojan = trojan');
            expect(result).toContain('1.2.3.4');
            expect(result).toContain('443');
            expect(result).toContain('password=password123');
        });

        it('应正确处理 Trojan SNI', () => {
            const trojan = 'trojan://password@1.2.3.4:443?sni=example.com#TrojanSNI';
            const result = generateBuiltinSurgeConfig(trojan);
            expect(result).toContain('sni=example.com');
        });

        it('应正确处理 Trojan WebSocket', () => {
            const trojan = 'trojan://password@1.2.3.4:443?type=ws&path=/ws&host=example.com#TrojanWS';
            const result = generateBuiltinSurgeConfig(trojan);
            expect(result).toContain('ws=true');
            expect(result).toContain('ws-path=/ws');
        });
    });

    describe('Hysteria2', () => {
        it('应正确生成 Hysteria2 代理行', () => {
            const hy2 = 'hysteria2://password@1.2.3.4:443#TestHy2';
            const result = generateBuiltinSurgeConfig(hy2);
            expect(result).toContain('TestHy2 = hysteria2');
            expect(result).toContain('password=password');
        });

        it('应正确处理 hy2:// 前缀', () => {
            const hy2 = 'hy2://password@1.2.3.4:443#TestHy2Short';
            const result = generateBuiltinSurgeConfig(hy2);
            expect(result).toContain('TestHy2Short = hysteria2');
        });
    });

    describe('TUIC', () => {
        it('应正确生成 TUIC 代理行', () => {
            const tuic = 'tuic://token123@1.2.3.4:443?alpn=h3#TestTUIC';
            const result = generateBuiltinSurgeConfig(tuic);
            expect(result).toContain('TestTUIC = tuic');
            expect(result).toContain('token=token123');
            expect(result).toContain('alpn=h3');
        });
    });

    describe('Snell', () => {
        it('应正确生成 Snell 代理行', () => {
            const result = generateBuiltinSurgeConfig('snell://password@1.2.3.4:443?version=4#TestSnell');
            expect(result).toContain('TestSnell = snell');
            expect(result).toContain('psk=password');
            expect(result).toContain('version=4');
        });

        it('应保留 Snell 的 reuse、tfo 和 obfs 参数', () => {
            const result = generateBuiltinSurgeConfig('snell://password@1.2.3.4:443?version=5&reuse=true&tfo=true&obfs=http&obfs-host=example.com#TestSnellFull');
            expect(result).toContain('TestSnellFull = snell');
            expect(result).toContain('version=5');
            expect(result).toContain('reuse=true');
            expect(result).toContain('tfo=true');
            expect(result).toContain('obfs=http');
            expect(result).toContain('obfs-host=example.com');
        });

        it('应在无效 Snell 输入时回退为空代理段', () => {
            const result = generateBuiltinSurgeConfig('snell://');
            expect(result).toContain('[Proxy]');
        });
    });

    describe('WireGuard', () => {
        it('应正确生成 WireGuard 代理行和独立 section', () => {
            const wg = 'wireguard://privatekey123@1.2.3.4:51820?publickey=pubkey456&address=10.0.0.2&reserved=83,12,235#TestWG';
            const result = generateBuiltinSurgeConfig(wg);
            expect(result).toContain('TestWG = wireguard');
            expect(result).toContain('section-name =');
            expect(result).toContain('[WireGuard');
            expect(result).toContain('private-key = privatekey123');
            expect(result).toContain('self-ip = 10.0.0.2');
            expect(result).toContain('public-key = pubkey456');
            expect(result).toContain('client-id = 83/12/235');
        });

        it('应使用默认 DNS 服务器', () => {
            const wg = 'wireguard://key@1.2.3.4:51820?publickey=pub#WGDefault';
            const result = generateBuiltinSurgeConfig(wg);
            expect(result).toContain('dns-server = 8.8.8.8, 1.1.1.1');
        });

        it('应处理自定义 DNS', () => {
            const wg = 'wireguard://key@1.2.3.4:51820?publickey=pub&dns=9.9.9.9,1.1.1.1#WGCustomDNS';
            const result = generateBuiltinSurgeConfig(wg);
            expect(result).toContain('dns-server = 9.9.9.9, 1.1.1.1');
        });
    });

    describe('VLESS（不支持）', () => {
        it('应跳过 VLESS 节点', () => {
            const vless = 'vless://uuid@1.2.3.4:443?type=tcp&security=reality#VLESSNode';
            const result = generateBuiltinSurgeConfig(vless);
            expect(result).not.toContain('VLESSNode');
            // 应生成空配置
            expect(result).toContain('FINAL,DIRECT');
        });
    });

    describe('节点名称安全化', () => {
        it('应转义节点名中的逗号', () => {
            const vmessConfig = {
                v: "2", ps: "US,CA Node", add: "1.2.3.4", port: "443",
                id: "uuid-1234", aid: "0", net: "tcp", type: "none",
                host: "", path: "", tls: ""
            };
            const vmess = `vmess://${btoa(JSON.stringify(vmessConfig))}`;
            const result = generateBuiltinSurgeConfig(vmess);
            // 逗号应被替换为空格，避免破坏 INI 解析
            expect(result).not.toContain('US,CA Node = vmess');
            expect(result).toContain('US CA Node = vmess');
        });

        it('应转义节点名中的等号', () => {
            const vmessConfig = {
                v: "2", ps: "Node=Test", add: "1.2.3.4", port: "443",
                id: "uuid-1234", aid: "0", net: "tcp", type: "none",
                host: "", path: "", tls: ""
            };
            const vmess = `vmess://${btoa(JSON.stringify(vmessConfig))}`;
            const result = generateBuiltinSurgeConfig(vmess);
            // 等号应被替换为横杠
            expect(result).toContain('Node-Test = vmess');
        });
    });

    describe('重名去重', () => {
        it('应对重名节点添加后缀', () => {
            const vmessConfig1 = {
                v: "2", ps: "Same Name", add: "1.2.3.4", port: "443",
                id: "uuid-1", aid: "0", net: "tcp", type: "none",
                host: "", path: "", tls: ""
            };
            const vmessConfig2 = {
                v: "2", ps: "Same Name", add: "5.6.7.8", port: "443",
                id: "uuid-2", aid: "0", net: "tcp", type: "none",
                host: "", path: "", tls: ""
            };
            const nodeList = [
                `vmess://${btoa(JSON.stringify(vmessConfig1))}`,
                `vmess://${btoa(JSON.stringify(vmessConfig2))}`
            ].join('\n');
            const result = generateBuiltinSurgeConfig(nodeList);
            expect(result).toContain('Same Name = vmess');
            expect(result).toContain('Same Name_1 = vmess');
        });
    });

    describe('Proxy Group', () => {
        it('应包含正确的默认代理分组', () => {
            const ss = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#TestSS';
            const result = generateBuiltinSurgeConfig(ss);
            expect(result).toContain('📶 节点选择 = select');
            expect(result).toContain('♻️ 自动选择 = url-test');
        });

        it('应按地区自动分组', () => {
            const nodeList = [
                'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#香港节点1',
                'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@5.6.7.8:8388#US Node',
                'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@9.10.11.12:8388#未知地区节点'
            ].join('\n');
            const result = generateBuiltinSurgeConfig(nodeList);
            expect(result).toContain('🇭🇰 香港节点 = url-test');
            expect(result).toContain('🇺🇸 美国节点 = url-test');
            expect(result).not.toContain('🇯🇵 日本节点 = url-test'); // 不包含未匹配的地区
            
            // 主分组应包含地区分组和所有节点
            expect(result).toContain('📶 节点选择 = select, ♻️ 自动选择, 🇭🇰 香港节点, 🇺🇸 美国节点');
        });
    });

    describe('Rule', () => {
        it('应包含高级分流规则', () => {
            const ss = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#TestSS';
            const result = generateBuiltinSurgeConfig(ss);
            expect(result).toContain('RULE-SET,https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Surge/Apple/Apple.list,DIRECT');
            expect(result).toContain('RULE-SET,https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Surge/GlobalMedia/GlobalMedia.list,📶 节点选择');
            expect(result).toContain('GEOIP,CN,DIRECT');
            expect(result).toContain('FINAL,📶 节点选择,dns-failed');
        });
    });

    describe('混合协议', () => {
        it('应正确处理多种协议的混合节点列表', () => {
            const nodeList = [
                'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#SSNode',
                'trojan://password@5.6.7.8:443#TrojanNode',
                'hysteria2://pass@9.10.11.12:443#Hy2Node'
            ].join('\n');
            const result = generateBuiltinSurgeConfig(nodeList);
            expect(result).toContain('SSNode = ss');
            expect(result).toContain('TrojanNode = trojan');
            expect(result).toContain('Hy2Node = hysteria2');
        });

        it('应在代理分组中包含所有有效节点', () => {
            const nodeList = [
                'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#SSNode',
                'trojan://password@5.6.7.8:443#TrojanNode',
                'vless://uuid@1.2.3.4:443?type=tcp#VLESSSkipped'  // 应被跳过
            ].join('\n');
            const result = generateBuiltinSurgeConfig(nodeList);
            expect(result).toContain('SSNode');
            expect(result).toContain('TrojanNode');
            expect(result).not.toContain('VLESSSkipped');
        });
    });

    describe('控制字符清理', () => {
        it('应清理节点列表中的控制字符', () => {
            const nodeWithControl = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#Test\x00SS';
            const result = generateBuiltinSurgeConfig(nodeWithControl);
            // 控制字符应被清理，节点仍能被处理
            expect(result).toContain('[Proxy]');
        });
    });
});
