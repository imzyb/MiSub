import { describe, it, expect } from 'vitest';
import { generateBuiltinQuanxConfig } from '../../functions/modules/subscription/builtin-quanx-generator.js';
import { parseQuantumultXConfig } from '../../src/utils/protocols/quantumultx-parser.js';

describe('Quantumult X 内置生成器', () => {
    it('should generate managed config and proxy sections', () => {
        const result = generateBuiltinQuanxConfig('ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:443#HKNode', {
            managedConfigUrl: 'https://example.com/qx',
            skipCertVerify: true
        });

        expect(result).toContain('#!MANAGED-CONFIG https://example.com/qx');
        expect(result).toContain('[General]');
        expect(result).toContain('[server_local]');
        expect(result).toContain('shadowsocks=1.2.3.4:443, method=aes-128-gcm');
        expect(result).toContain('password');
    });

    it('should emit tls-verification=false when skipCertVerify is enabled', () => {
        const result = generateBuiltinQuanxConfig('trojan://password@1.2.3.4:443#TrojanNode', {
            skipCertVerify: true
        });

        expect(result).toContain('tls-verification=false');
    });

    it('should emit parser-compatible vmess and trojan lines', () => {
        const result = generateBuiltinQuanxConfig([
            'vmess://eyJ2IjoiMiIsInBzIjoiVm1lc3NOb2RlIiwiYWRkIjoiMS4yLjMuNCIsInBvcnQiOiI0NDMiLCJpZCI6InV1aWQtMTIzNCIsImFpZCI6IjAiLCJuZXQiOiJ3cyIsInR5cGUiOiJub25lIiwiaG9zdCI6ImV4YW1wbGUuY29tIiwicGF0aCI6Ii93cyIsInRscyI6InRscyJ9',
            'trojan://password@1.2.3.4:443#TrojanNode'
        ].join('\n'));

        expect(result).toContain('vmess=1.2.3.4:443, method=auto, password=uuid-1234, tag=VmessNode');
        expect(result).toContain('trojan=1.2.3.4:443, password=password, over-tls=true, tag=TrojanNode');
    });

    it('should emit parser-compatible shadowsocks lines', () => {
        const result = generateBuiltinQuanxConfig('ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:443#SSNode');

        expect(result).toContain('shadowsocks=1.2.3.4:443, method=aes-128-gcm, password=password, udp-relay=true, tag=SSNode');
        expect(result).toContain('password');
    });

    it('should round-trip back through parser', () => {
        const generated = generateBuiltinQuanxConfig([
            'vmess://eyJ2IjoiMiIsInBzIjoiVm1lc3NOb2RlIiwiYWRkIjoiMS4yLjMuNCIsInBvcnQiOiI0NDMiLCJpZCI6InV1aWQtMTIzNCIsImFpZCI6IjAiLCJuZXQiOiJ3cyIsInR5cGUiOiJub25lIiwiaG9zdCI6ImV4YW1wbGUuY29tIiwicGF0aCI6Ii93cyIsInRscyI6InRscyJ9',
            'trojan://password@1.2.3.4:443#TrojanNode'
        ].join('\n'));

        const parsed = parseQuantumultXConfig(generated);
        expect(parsed.length).toBeGreaterThan(0);
        expect(parsed.some(node => node.protocol === 'vmess')).toBe(true);
        expect(parsed.some(node => node.protocol === 'trojan')).toBe(true);
    });

    it('should round-trip ws and tls host fields', () => {
        const generated = generateBuiltinQuanxConfig([
            'vmess://eyJ2IjoiMiIsInBzIjoiV1MgTm9kZSIsImFkZCI6InZtZXNzLmV4YW1wbGUuY29tIiwicG9ydCI6IjQ0MyIsImlkIjoidXVpZC01Njc4IiwiYWlkIjoiMCIsIm5ldCI6IndzIiwidHlwZSI6Im5vbmUiLCJob3N0IjoiZXhhbXBsZS5jb20iLCJwYXRoIjoiL3dzIiwidGxzIjoidGxzIn0=',
            'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:443#SS Node'
        ].join('\n'));

        const parsed = parseQuantumultXConfig(generated);
        expect(parsed.length).toBeGreaterThan(0);
        const vmess = parsed.find(node => node.protocol === 'vmess');
        const ss = parsed.find(node => node.protocol === 'ss');

        const vmessDecoded = JSON.parse(atob(vmess.url.replace('vmess://', '')));
        expect(vmessDecoded.net).toBe('ws');
        expect(vmessDecoded.host).toBe('example.com');
        expect(vmessDecoded.path).toBe('/ws');
        expect(vmessDecoded.tls).toBe('true');
        expect(ss.name).toBe('SS Node');
    });

    it('should emit parser-compatible hysteria2 tuic and anytls lines', () => {
        const generated = generateBuiltinQuanxConfig([
            'hysteria2://pass-hy2@hy2.example.com:443?sni=hy2.example.com&allowInsecure=1#HY2Node',
            'tuic://uuid-tuic:pass-tuic@tuic.example.com:443?sni=tuic.example.com&congestion_control=bbr&udp_relay_mode=native&alpn=h3&allowInsecure=1#TUICNode',
            'anytls://pass-anytls@anytls.example.com:443/?sni=anytls.example.com&alpn=h2,h3&allowInsecure=1#AnyTLSNode'
        ].join('\n'));

        expect(generated).toContain('hysteria2=hy2.example.com:443, password=pass-hy2, sni=hy2.example.com, tls-verification=false, tag=HY2Node');
        expect(generated).toContain('tuic=tuic.example.com:443, uuid-tuic, pass-tuic, sni=tuic.example.com, congestion-controller=bbr, udp-relay=native, alpn=h3, tls-verification=false, tag=TUICNode');
        expect(generated).toContain('anytls=anytls.example.com:443, password=pass-anytls, sni=anytls.example.com, alpn=h2,h3, tls-verification=false, tag=AnyTLSNode');

        const parsed = parseQuantumultXConfig(generated);
        expect(parsed.some(node => node.protocol === 'hysteria2')).toBe(true);
        expect(parsed.some(node => node.protocol === 'tuic')).toBe(true);
        expect(parsed.some(node => node.protocol === 'anytls')).toBe(true);
    });
});
