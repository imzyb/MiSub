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
        expect(result).toContain('[general]');
        expect(result).toContain('[dns]');
        expect(result).toContain('[server_local]');
        expect(result).toContain('[server_remote]');
        expect(result).toContain('[rewrite_remote]');
        expect(result).toContain('[rewrite_local]');
        expect(result).toContain('[mitm]');
        expect(result).toContain('server_check_url = http://www.gstatic.com/generate_204');
        expect(result).toContain('excluded_routes = 192.168.0.0/16, 172.16.0.0/12, 100.64.0.0/10, 10.0.0.0/8');
        expect(result).toContain('server = 223.5.5.5');
        expect(result).toContain('shadowsocks=1.2.3.4:443, method=aes-128-gcm');
        expect(result).toContain('password');
        expect(result).not.toContain('[General]');
        expect(result).not.toContain('dns-server =');
        expect(result).not.toContain('proxy-test-url =');
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

        expect(result).toContain('vmess=1.2.3.4:443, method=none, password=uuid-1234, obfs=wss, obfs-uri=/ws, obfs-host=example.com, tag=🌍 VmessNode');
        expect(result).not.toContain('vmess=1.2.3.4:443, method=none, password=uuid-1234, obfs=ws,');
        expect(result).not.toContain('over-tls=true, tag=🌍 VmessNode');
        expect(result).toContain('trojan=1.2.3.4:443, password=password, over-tls=true, tag=🌍 TrojanNode');
    });

    it('should emit parser-compatible shadowsocks lines', () => {
        const result = generateBuiltinQuanxConfig('ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:443#SSNode');

        expect(result).toContain('shadowsocks=1.2.3.4:443, method=aes-128-gcm, password=password, tag=🌍 SSNode');
        expect(result).toContain('password');
    });

    it('should use Quantumult X policy syntax without pseudo DIRECT node entries', () => {
        const result = generateBuiltinQuanxConfig('ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:443#SSNode');

        expect(result).not.toContain('DIRECT = direct');
        expect(result).toContain('static=');
        expect(result).toContain('url-latency-benchmark=');
        expect(result).toContain('[filter_remote]');
        expect(result).not.toContain('filter_remote, ');
        expect(result).toContain('final,');
    });

    it('should avoid pseudo DIRECT node even when node list is empty', () => {
        const result = generateBuiltinQuanxConfig('');

        expect(result).not.toContain('DIRECT = direct');
        expect(result).toContain('[server_local]');
        expect(result).toContain('[mitm]');
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
        expect(ss.name).toBe('🌍 SS Node');
    });

    it('should skip unsupported hysteria2 lines for QuanX and keep tuic anytls lines', () => {
        const generated = generateBuiltinQuanxConfig([
            'hysteria2://pass-hy2@hy2.example.com:443?sni=hy2.example.com&allowInsecure=1#HY2Node',
            'tuic://uuid-tuic:pass-tuic@tuic.example.com:443?sni=tuic.example.com&congestion_control=bbr&udp_relay_mode=native&alpn=h3&allowInsecure=1#TUICNode',
            'anytls://pass-anytls@anytls.example.com:443/?sni=anytls.example.com&alpn=h2,h3&allowInsecure=1#AnyTLSNode'
        ].join('\n'));

        expect(generated).not.toContain('hysteria2=');
        expect(generated).toContain('tuic=tuic.example.com:443, uuid-tuic, pass-tuic, sni=tuic.example.com, congestion-controller=bbr, udp-relay=native, alpn=h3, tls-verification=false, tag=🌍 TUICNode');
        expect(generated).toContain('anytls=anytls.example.com:443, password=pass-anytls, sni=anytls.example.com, alpn=h2,h3, tls-verification=false, tag=🌍 AnyTLSNode');

        const parsed = parseQuantumultXConfig(generated);
        expect(parsed.some(node => node.protocol === 'hysteria2')).toBe(false);
        expect(parsed.some(node => node.protocol === 'tuic')).toBe(true);
        expect(parsed.some(node => node.protocol === 'anytls')).toBe(true);
    });

    it('should skip hysteria2 when rendering QuanX because target rejects it', () => {
        const generated = generateBuiltinQuanxConfig('hysteria2://97fe958d-2c3e-4994-9df0-293ccdb5f39@x-mg.xueshan168.cc:20201?sni=x-mg.xueshan168.cc&allowInsecure=1#Stable%20-%20%E8%B7%9D%E7%A6%BB%E4%B8%8B%E6%AC%A1%E9%87%8D%E7%BD%AE%E5%89%A9%E4%BD%99%EF%BC%9A%2019%20%E5%A4%A9');

        expect(generated).not.toContain('hysteria2=');
        expect(generated).not.toContain('x-mg.xueshan168.cc:20201');
    });

    it('should emit Quantumult X compatible vless reality syntax', () => {
        const generated = generateBuiltinQuanxConfig([
            'vless://52e98ca8-0671-451a-940a-961b8k@34.21.195.221:65043?security=reality&sni=addons.mozilla.org&pbk=QpmZt9PSrjOltpKalxbwoCYTkOkRPwVnNInqTCRic&sid=0123456789abcdef&type=tcp#Gcp%20SG'
        ].join('\n'));

        expect(generated).toContain('vless=34.21.195.221:65043, password=52e98ca8-0671-451a-940a-961b8k, method=none, obfs=over-tls, obfs-host=addons.mozilla.org, reality-base64-pubkey=QpmZt9PSrjOltpKalxbwoCYTkOkRPwVnNInqTCRic, reality-hex-shortid=0123456789abcdef');
        expect(generated).toContain('tag=');
        expect(generated).not.toContain('reality-public-key=');
        expect(generated).not.toContain('tls-host=addons.mozilla.org');
        expect(generated).not.toContain('over-tls=true');
    });

    it('should avoid obfs-uri when xhttp is mapped to over-tls for QuanX', () => {
        const generated = generateBuiltinQuanxConfig([
            'vless://67d08f0c-d864-4c58-8491-ffa03097c60b@cf.tencentapp.cn:443?type=xhttp&path=%2Fargo&xhttp-host=uk.xxxxxxxxxxxxx.xxx.kg&host=uk.xxxxxxxxxxxxx.xxx.kg&security=tls&sni=uk.xxxxxxxxxxxxx.xxx.kg&allowInsecure=1#UK-Argo-XHTTP'
        ].join('\n'));

        expect(generated).toContain('vless=cf.tencentapp.cn:443, password=67d08f0c-d864-4c58-8491-ffa03097c60b, method=none, obfs=over-tls, obfs-host=uk.xxxxxxxxxxxxx.xxx.kg');
        expect(generated).not.toContain('obfs-uri=/argo');
    });

    it('should keep QuanX vmess ws tls tag at the end of the server line', () => {
        const vmessConfig = Buffer.from(JSON.stringify({
            v: '2',
            ps: 'VMESS 节点',
            add: 'ip.sb',
            port: '443',
            id: '6f4e029b-099f-45f6-afd2-33f0e8f86f15',
            aid: '0',
            scy: 'auto',
            net: 'ws',
            type: 'none',
            host: 'gbwarp.owg.dpdns.org',
            path: '/vmess-argo?ed=2560',
            tls: 'tls',
            sni: 'gbwarp.owg.dpdns.org'
        })).toString('base64');

        const generated = generateBuiltinQuanxConfig(`vmess://${vmessConfig}`);
        const line = generated.split('\n').find(item => item.startsWith('vmess='));

        expect(line).toBe('vmess=ip.sb:443, method=none, password=6f4e029b-099f-45f6-afd2-33f0e8f86f15, obfs=wss, obfs-uri=/vmess-argo?ed=2560, obfs-host=gbwarp.owg.dpdns.org, tag=🌍 VMESS 节点');
        expect(line).not.toContain('tag=🌍 VMESS 节点, obfs=');
        expect(line).not.toContain('over-tls=true');
        expect(line).not.toContain('tls-host=');
    });
});
