/**
 * Protocol Converter 单元测试
 * 测试各种协议的转换功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 创建mock crypto.randomUUID (在Node环境下可能不存在)
vi.stubGlobal('crypto', {
    randomUUID: () => 'test-uuid-1234'
})

// Mock btoa/atob for Node environment
vi.stubGlobal('btoa', (str) => Buffer.from(str).toString('base64'))
vi.stubGlobal('atob', (str) => Buffer.from(str, 'base64').toString())

// 导入被测试模块
import {
    convertClashProxyToUrl,
    parseClientConfig,
    parseLoonConfig,
    parseSurgeConfig,
    parseQuantumultXConfig
} from '../../src/utils/protocolConverter.js'

describe('protocolConverter', () => {
    describe('convertClashProxyToUrl', () => {
        describe('VMess', () => {
it('应正确转换基础VMess配置', () => {
const proxy = {
name: 'Test VMess',
type: 'vmess',
server: '1.2.3.4',
port: 443,
uuid: 'uuid-1234-5678',
alterId: 0,
cipher: 'auto',
network: 'tcp'
}

const result = convertClashProxyToUrl(proxy)
expect(result).toBeTruthy()
expect(result).toMatch(/^vmess:\/\//)

// 解码验证
const base64Data = result.replace('vmess://', '')
const decoded = JSON.parse(atob(base64Data))
expect(decoded.add).toBe('1.2.3.4')
expect(decoded.port).toBe('443') // port 在 URL 编码中为字符串
expect(decoded.id).toBe('uuid-1234-5678')
})

            it('应正确处理WebSocket传输', () => {
                const proxy = {
                    name: 'VMess WS',
                    type: 'vmess',
                    server: 'example.com',
                    port: 443,
                    uuid: 'test-uuid',
                    network: 'ws',
                    tls: true,
                    'ws-opts': {
                        path: '/path',
                        headers: { Host: 'example.com' }
                    }
                }

                const result = convertClashProxyToUrl(proxy)
                expect(result).toBeTruthy()

                const base64Data = result.replace('vmess://', '')
                const decoded = JSON.parse(atob(base64Data))
                expect(decoded.net).toBe('ws')
                expect(decoded.path).toBe('/path')
                expect(decoded.host).toBe('example.com')
            })
        })

        describe('Shadowsocks', () => {
            it('应正确转换SS配置', () => {
                const proxy = {
                    name: 'Test SS',
                    type: 'ss',
                    server: '1.2.3.4',
                    port: 8388,
                    cipher: 'aes-256-gcm',
                    password: 'testpass'
                }

                const result = convertClashProxyToUrl(proxy)
                expect(result).toBeTruthy()
                expect(result).toMatch(/^ss:\/\//)
                expect(result).toContain('#Test%20SS')
            })

            it('缺少必要字段应返回null', () => {
                const proxy = {
                    name: 'Incomplete SS',
                    type: 'ss',
                    server: '1.2.3.4'
                    // 缺少 port, cipher, password
                }

                const result = convertClashProxyToUrl(proxy)
                expect(result).toBeNull()
            })
        })

        describe('Trojan', () => {
            it('应正确转换Trojan配置', () => {
                const proxy = {
                    name: 'Test Trojan',
                    type: 'trojan',
                    server: 'trojan.example.com',
                    port: 443,
                    password: 'secret'
                }

                const result = convertClashProxyToUrl(proxy)
                expect(result).toBeTruthy()
                expect(result).toMatch(/^trojan:\/\//)
                expect(result).toContain('trojan.example.com:443')
            })
        })

        describe('VLESS', () => {
            it('应正确转换VLESS配置', () => {
                const proxy = {
                    name: 'Test VLESS',
                    type: 'vless',
                    server: 'vless.example.com',
                    port: 443,
                    uuid: 'vless-uuid-1234',
                    network: 'tcp',
                    tls: true
                }

                const result = convertClashProxyToUrl(proxy)
                expect(result).toBeTruthy()
                expect(result).toMatch(/^vless:\/\//)
                expect(result).toContain('vless-uuid-1234@vless.example.com:443')
            })

it('应正确处理Reality配置', () => {
const proxy = {
name: 'VLESS Reality',
type: 'vless',
server: 'reality.example.com',
port: 443,
uuid: 'reality-uuid',
network: 'tcp',
reality: true,
'reality-opts': {
'public-key': 'test-public-key',
'short-id': 'abc123'
}
}

const result = convertClashProxyToUrl(proxy)
expect(result).toBeTruthy()
expect(result).toContain('security=reality')
expect(result).toContain('pbk=test-public-key') // 标准参数名为 pbk
expect(result).toContain('sid=abc123')
})
        })

        describe('Hysteria2', () => {
            it('应正确转换Hysteria2配置', () => {
                const proxy = {
                    name: 'Test Hy2',
                    type: 'hysteria2',
                    server: 'hy2.example.com',
                    port: 443,
                    password: 'hy2pass'
                }

                const result = convertClashProxyToUrl(proxy)
                expect(result).toBeTruthy()
                expect(result).toMatch(/^hysteria2:\/\//)
            })
        })

        describe('边界情况', () => {
            it('空输入应返回null', () => {
                expect(convertClashProxyToUrl(null)).toBeNull()
                expect(convertClashProxyToUrl(undefined)).toBeNull()
                expect(convertClashProxyToUrl({})).toBeNull()
            })

            it('不支持的类型应返回null', () => {
                const proxy = {
                    name: 'Unknown',
                    type: 'unknown-protocol',
                    server: '1.2.3.4',
                    port: 443
                }
                expect(convertClashProxyToUrl(proxy)).toBeNull()
            })
        })
    })

    describe('parseSurgeConfig', () => {
        it('应正确解析Surge SS配置', () => {
            const config = `
[Proxy]
ss=Test SS,1.2.3.4,8388,aes-256-gcm,password123
`
            const result = parseSurgeConfig(config)
            expect(result.length).toBeGreaterThan(0)
        })

        it('应正确解析 Surge WireGuard 配置', () => {
            const config = `
[Proxy]
WG-Test = wireguard, 1.2.3.4, 51820, private-key=test-private, peer-public-key=test-peer, client-id=1/2/3, self-ip=172.16.0.2/32
`
            const result = parseSurgeConfig(config)
            expect(result).toHaveLength(1)
            expect(result[0].protocol).toBe('wireguard')
            expect(result[0].url).toContain('wireguard://test-private@1.2.3.4:51820')
            expect(result[0].url).toContain('publickey=test-peer')
            expect(result[0].url).toContain('reserved=1%2C2%2C3')
        })
    })

    describe('parseLoonConfig', () => {
        it('应正确解析 Loon 常见代理配置', () => {
            const config = `
[Proxy]
Test VMess = vmess, vmess.example.com, 443, uuid-1234, tls=true, transport=ws, host=example.com, path=/ws
Test SS = Shadowsocks, 1.2.3.4, 8388, aes-128-gcm, password123
Test Trojan = trojan, trojan.example.com, 443, secret, sni=example.com, skip-cert-verify=true
Test VLESS = vless, vless.example.com, 443, uuid-vless, tls=true, transport=xhttp, host=example.org, path=/vless, mode=packet-up, reality=true, public-key=pubkey, short-id=abcd, sni=example.org, alpn=h3, fp=chrome
Test HTTP = http, http.example.com, 8080, user, pass
Test HY2 = hysteria2, hy2.example.com, 443, hy2pass, sni=hy2.example.com
Test TUIC = tuic, tuic.example.com, 443, uuid-tuic, password=pass-tuic, sni=tuic.example.com
Test WG = wireguard, wg.example.com, 51820, private-key-value, self-ip=172.16.0.2/32, public-key=peerpub, client-id=1/2/3
Test Snell = snell, snell.example.com, 8443, psk-secret
`
            const result = parseLoonConfig(config)

            expect(result).toHaveLength(9)
            expect(result[0].protocol).toBe('vmess')
            expect(result[1].protocol).toBe('ss')
            expect(result[2].protocol).toBe('trojan')
            expect(result[3].protocol).toBe('vless')
            expect(result[4].protocol).toBe('http')
            expect(result[5].protocol).toBe('hysteria2')
            expect(result[6].protocol).toBe('tuic')
            expect(result[7].protocol).toBe('wireguard')
            expect(result[8].protocol).toBe('snell')
            expect(result[2].url).toContain('allowInsecure=1')
            expect(result[3].url).toContain('security=reality')
            expect(result[3].url).toContain('xhttp-host=example.org')
            expect(result[3].url).toContain('xhttp-path=%2Fvless')
            expect(result[3].url).toContain('pbk=pubkey')
            expect(result[3].url).toContain('alpn=h3')
            expect(result[3].url).toContain('fp=chrome')
        })
    })

    describe('parseQuantumultXConfig', () => {
        it('应正确解析空配置', () => {
            const result = parseQuantumultXConfig('')
            expect(result).toEqual([])
        })

        it('应解析VMess配置并生成有效URL', () => {
            const config = `
[server_local]
vmess=Test VMess, vmess.example.com, 443, auto, uuid-1234, 0, net=ws, host=example.com, path=/ws
`
            const result = parseQuantumultXConfig(config)

            expect(result).toHaveLength(1)
            const node = result[0]
            expect(node.protocol).toBe('vmess')

            const decoded = JSON.parse(atob(node.url.replace('vmess://', '')))
            expect(decoded.add).toBe('vmess.example.com')
            expect(decoded.net).toBe('ws')
            expect(decoded.path).toBe('/ws')
            expect(decoded.host).toBe('example.com')
        })

        it('应解析带额外字段的SS和Trojan配置', () => {
            const config = `
[server_local]
shadowsocks=Test SS, 1.2.3.4, 443, aes-128-gcm, password, obfs=ws, obfs-host=example.com
trojan=Test Trojan, 1.2.3.5, 443, password, tls=true, tls-host=example.org
`
            const result = parseQuantumultXConfig(config)

            expect(result).toHaveLength(2)
            expect(result[0].protocol).toBe('ss')
            expect(result[1].protocol).toBe('trojan')
        })

        it('应解析带 ws 和 tls-host 的 VMess 配置', () => {
            const config = `
[server_local]
vmess=Test WS, vmess.example.com, 443, auto, uuid-5678, 0, net=ws, host=example.com, path=/ws, tls=true, tls-host=example.org
`
            const result = parseQuantumultXConfig(config)

            expect(result).toHaveLength(1)
            const decoded = JSON.parse(atob(result[0].url.replace('vmess://', '')))
            expect(decoded.net).toBe('ws')
            expect(decoded.host).toBe('example.org')
            expect(decoded.path).toBe('/ws')
            expect(decoded.tls).toBe('true')
        })

        it('应解析 VLESS 与 HTTPS 配置', () => {
            const config = `
[server_local]
vless=Test VLESS, vless.example.com, 443, uuid-vless, transport=ws, path=/ws, tls=true, tls-host=example.org
https=Test HTTPS, https.example.com, 443, user, pass, tls-host=secure.example.com
`
            const result = parseQuantumultXConfig(config)

            expect(result).toHaveLength(2)
            expect(result[0].protocol).toBe('vless')
            expect(result[0].url).toContain('vless://uuid-vless@vless.example.com:443')
            expect(result[1].protocol).toBe('https')
            expect(result[1].url).toContain('https://user:pass@https.example.com:443')
        })

        it('应解析 Hysteria2 与 TUIC 配置', () => {
            const config = `
[server_local]
hysteria2=Test HY2, hy2.example.com, 443, hy2pass, sni=hy2.example.com
tuic=Test TUIC, tuic.example.com, 443, uuid-tuic, pass-tuic, sni=tuic.example.com
`
            const result = parseQuantumultXConfig(config)

            expect(result).toHaveLength(2)
            expect(result[0].protocol).toBe('hysteria2')
            expect(result[0].url).toContain('hysteria2://hy2pass@hy2.example.com:443')
            expect(result[1].protocol).toBe('tuic')
            expect(result[1].url).toContain('tuic://uuid-tuic:pass-tuic@tuic.example.com:443')
        })

        it('应解析 AnyTLS 配置', () => {
            const config = `
[server_local]
anytls=Test AnyTLS, anytls.example.com, 443, password=anytls-pass, sni=example.com, alpn=h2,h3, tls-verification=false
`
            const result = parseQuantumultXConfig(config)

            expect(result).toHaveLength(1)
            expect(result[0].protocol).toBe('anytls')
            expect(result[0].url).toContain('anytls://anytls-pass@anytls.example.com:443')
            expect(result[0].url).toContain('sni=example.com')
            expect(result[0].url).toContain('allowInsecure=1')
        })
    })

    describe('parseClientConfig', () => {
        it('应自动识别 Surge / Loon / QX 配置', () => {
            const surge = parseClientConfig('[Proxy]\nss=Test SS,1.2.3.4,8388,aes-256-gcm,password123')
            const loon = parseClientConfig('[Proxy]\nTest SS = Shadowsocks, 1.2.3.4, 8388, aes-128-gcm, password123')
            const quanx = parseClientConfig('[server_local]\nshadowsocks=Test SS, 1.2.3.4, 443, aes-128-gcm, password')
            const surgeWireguard = parseClientConfig('[Proxy]\nWG-Test = wireguard, 1.2.3.4, 51820, private-key=test-private, peer-public-key=test-peer')

            expect(surge.client).toBe('surge')
            expect(loon.client).toBe('loon')
            expect(quanx.client).toBe('quantumultx')
            expect(surgeWireguard.client).toBe('surge')
            expect(surge.nodes.length).toBeGreaterThan(0)
            expect(loon.nodes.length).toBeGreaterThan(0)
            expect(quanx.nodes.length).toBeGreaterThan(0)
            expect(surgeWireguard.nodes.length).toBeGreaterThan(0)
        })

        it('应解析 Loon AnyTLS 配置', () => {
            const loon = parseClientConfig('[Proxy]\nAnyTLS-HK = anytls, 156.239.232.67, 443, password123, sni=example.com, alpn=h2,h3, skip-cert-verify=true')

            expect(loon.client).toBe('loon')
            expect(loon.nodes).toHaveLength(1)
            expect(loon.nodes[0].protocol).toBe('anytls')
            expect(loon.nodes[0].url).toContain('anytls://password123@156.239.232.67:443')
            expect(loon.nodes[0].url).toContain('sni=example.com')
            expect(loon.nodes[0].url).toContain('alpn=h2')
            expect(loon.nodes[0].url).toContain('allowInsecure=1')
        })
    })
})
