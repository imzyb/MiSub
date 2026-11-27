import { describe, it, expect } from 'vitest';
import {
    pinRemoteRuleUrl,
    PINNED_RULE_REVISIONS,
    GH_PROXY_BASE,
} from '../../functions/modules/subscription/builtin-rules-provider.js';

/**
 * 规则源下载链路解析测试。
 *
 * 背景：raw.githubusercontent.com 在中国大陆无法直连，导致客户端拉取 RULE-SET 静默失败。
 * jsDelivr 已按合规要求整体封禁 ACL4SSR 仓库（403），因此：
 * - ACL4SSR：国内请求方走 gh-proxy.org 加速，国外请求方保持 raw 直连（均锁定修订号）
 * - 其它仓库（SagerNet/blackmatrix7 等）：继续镜像到 jsDelivr 并锁定修订号
 */
describe('pinRemoteRuleUrl - 规则源下载链路解析', () => {
    it('ACL4SSR 链接在国外请求方保持 raw 直连并锁定版本（不走已被封禁的 jsDelivr）', () => {
        const out = pinRemoteRuleUrl(
            'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Providers/BanAD.yaml'
        );
        expect(out).toBe(
            `https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/${PINNED_RULE_REVISIONS.ACL4SSR}/Clash/Providers/BanAD.yaml`
        );
        expect(out).not.toContain('jsdelivr');
    });

    it('ACL4SSR 链接在国内请求方走 gh-proxy.org 加速', () => {
        const out = pinRemoteRuleUrl(
            'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Providers/BanAD.yaml',
            { isChinaClient: true }
        );
        expect(out).toBe(
            `${GH_PROXY_BASE}https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/${PINNED_RULE_REVISIONS.ACL4SSR}/Clash/Providers/BanAD.yaml`
        );
    });

    it('将 sing-geosite / sing-geoip 链接重写为 jsDelivr', () => {
        const geosite = pinRemoteRuleUrl(
            'https://raw.githubusercontent.com/SagerNet/sing-geosite/main/geosite-netflix.srs'
        );
        expect(geosite).toBe(
            `https://cdn.jsdelivr.net/gh/SagerNet/sing-geosite@${PINNED_RULE_REVISIONS.SING_GEOSITE}/geosite-netflix.srs`
        );

        const geoip = pinRemoteRuleUrl(
            'https://raw.githubusercontent.com/SagerNet/sing-geoip/main/geoip-cn.srs'
        );
        expect(geoip).toContain('cdn.jsdelivr.net/gh/SagerNet/sing-geoip@');
        expect(geoip).toContain('/geoip-cn.srs');
    });

    it('将 blackmatrix7 链接重写为 jsDelivr 并锁定版本（@ 修订分隔符）', () => {
        const out = pinRemoteRuleUrl(
            'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Claude/Claude.list'
        );
        expect(out).toContain('cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@');
        expect(out).toContain('/rule/Clash/Claude/Claude.list');
    });

    it('mirror=false 时仅锁定版本，仍使用 raw 域名', () => {
        const out = pinRemoteRuleUrl(
            'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Claude/Claude.list',
            { mirror: false }
        );
        expect(out).toContain('raw.githubusercontent.com/blackmatrix7/ios_rule_script/');
        expect(out).toContain(PINNED_RULE_REVISIONS.BLACKMATRIX);
        expect(out).not.toContain('jsdelivr');
    });

    it('未知仓库仍会被镜像（只是不锁版本）', () => {
        const out = pinRemoteRuleUrl(
            'https://raw.githubusercontent.com/someone/somerepo/main/path/file.yaml'
        );
        expect(out).toBe('https://cdn.jsdelivr.net/gh/someone/somerepo@main/path/file.yaml');
    });

    it('非 GitHub raw 的地址原样返回', () => {
        expect(pinRemoteRuleUrl('https://example.com/rules.yaml')).toBe(
            'https://example.com/rules.yaml'
        );
        expect(pinRemoteRuleUrl('')).toBe('');
        expect(pinRemoteRuleUrl(null)).toBe(null);
        expect(pinRemoteRuleUrl('not-a-url')).toBe('not-a-url');
    });
});
