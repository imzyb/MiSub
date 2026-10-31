import { describe, it, expect } from 'vitest';
import { generateBuiltinLoonConfig } from '../../functions/modules/subscription/builtin-loon-generator.js';

describe('Loon 内置生成器', () => {
    it('应处理 realityOpts 参数', () => {
        const vless =
            'vless://uuid@1.2.3.4:443?type=tcp&security=reality&pbk=pubkey123&sid=shortid#RealityNode';
        const result = generateBuiltinLoonConfig(vless);
        expect(result).toContain('RealityNode = vless');
        expect(result).toContain('reality=true');
        expect(result).toContain('public-key=pubkey123');
        expect(result).toContain('short-id=shortid');
    });

    it('应保留 VLESS flow 参数且不默认跳过证书验证', () => {
        const vless =
            'vless://uuid@1.2.3.4:443?type=tcp&security=reality&flow=xtls-rprx-vision&pbk=pubkey123&sid=shortid#RealityFlow';
        const result = generateBuiltinLoonConfig(vless);
        expect(result).toContain('flow=xtls-rprx-vision');
        expect(result).not.toContain('skip-cert-verify=true');
    });

    it('应对重名节点添加 _1 后缀', () => {
        const nodeList = [
            'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#SameName',
            'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@5.6.7.8:8388#SameName',
        ].join('\n');
        const result = generateBuiltinLoonConfig(nodeList);
        expect(result).toContain('SameName = Shadowsocks');
        expect(result).toContain('SameName_1 = Shadowsocks');
    });

    it('应输出 AnyTLS 节点并保留 sni/alpn/skip-cert-verify', () => {
        const anytls =
            'anytls://pass123@1.2.3.4:443?sni=cdn.example.com&alpn=h2%2Chttp%2F1.1&allowInsecure=1#AnyTLSNode';
        const result = generateBuiltinLoonConfig(anytls);
        expect(result).toContain('AnyTLSNode = anytls, 1.2.3.4, 443, pass123');
        expect(result).toContain('sni=cdn.example.com');
        expect(result).toContain('alpn=h2');
        expect(result).toContain('skip-cert-verify=true');
    });
});
