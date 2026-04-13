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
        expect(result).toContain('[Proxy]');
        expect(result).toContain('shadowsocks=HKNode, 1.2.3.4, 443, aes-128-gcm');
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

        expect(result).toContain('vmess=VmessNode, 1.2.3.4, 443');
        expect(result).toContain('trojan=TrojanNode, 1.2.3.4, 443');
    });

    it('should emit parser-compatible shadowsocks lines', () => {
        const result = generateBuiltinQuanxConfig('ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:443#SSNode');

        expect(result).toContain('shadowsocks=SSNode, 1.2.3.4, 443, aes-128-gcm');
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
});
