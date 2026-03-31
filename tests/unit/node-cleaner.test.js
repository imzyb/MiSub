import { describe, it, expect } from 'vitest';
import {
    fixNodeUrlEncoding,
    fixSSEncoding,
    buildRuleSet,
    filterNodeObjects,
    applyManualNodeName
} from '../../functions/modules/utils/node-cleaner.js';

describe('Node Cleaner Utils', () => {

    describe('fixNodeUrlEncoding', () => {
        it('should decoding double-encoded vless/trojan URLs', () => {
            // vless://uuid@host:port?security=tls&headerType=none#%25E6%25B5%258B%25E8%25AF%2595%25E8%258A%2582%25E7%2582%25B9
            // Expected: ...#测试节点
            const doubleEncoded = 'vless://uuid@host:443?security=tls#%25E6%25B5%258B%25E8%25AF%2595';
            const fixed = fixNodeUrlEncoding(doubleEncoded);
            expect(decodeURIComponent(new URL(fixed).hash.substring(1))).toBe('测试');
        });

        it('should handle special characters in hysteria2 auth', () => {
            const original = 'hysteria2://user%21%40%23:pass@host:443';
            // If encoded, ensure it stays valid. 
            // The fixer logic tries to fix common mis-encodings.
            const fixed = fixNodeUrlEncoding(original);
            expect(fixed).toContain('hysteria2://');
        });
    });

    describe('fixSSEncoding', () => {
        it('should fix URL-encoded base64 part in SS links', () => {
            // ss://BASE64%3D%3D@host:port#name
            const badSS = 'ss://dGVzdDpwYXNz%3D@1.1.1.1:8888#test';
            const fixed = fixSSEncoding(badSS);
            // dGVzdDpwYXNz%3D -> dGVzdDpwYXNz= (test:pass)
            expect(fixed).toBe('ss://dGVzdDpwYXNz=@1.1.1.1:8888#test');
        });
    });

    describe('applyManualNodeName', () => {
        it('should rename vmess with base64 json', () => {
            const config = { v: "2", ps: "old", add: "1.1.1.1", port: 443, id: "uuid", aid: 0, net: "tcp", type: "none", host: "", path: "", tls: "" };
            const vmessLink = 'vmess://' + btoa(JSON.stringify(config));
            const newName = "New Name";

            const renamed = applyManualNodeName(vmessLink, newName);
            const newConfig = JSON.parse(atob(renamed.substring(8)));
            expect(newConfig.ps).toBe(newName);
        });

        it('should rename standard links via fragment', () => {
            const link = 'trojan://pass@host:443#old';
            const renamed = applyManualNodeName(link, 'New Name');
            expect(renamed).toBe('trojan://pass@host:443#New%20Name');
        });
    });

    describe('Filtering Logic', () => {
        const nodes = [
            { protocol: 'vmess', name: 'US Node 1' },
            { protocol: 'ss', name: 'HK Node 2' },
            { protocol: 'trojan', name: 'JP Node 3' },
            { protocol: 'vless', name: 'US Premium' }
        ];

        it('should filter by protocol (include)', () => {
            const ruleText = 'proto:vmess,ss';
            const rules = buildRuleSet(ruleText);
            const result = filterNodeObjects(nodes, rules, 'include');
            expect(result).toHaveLength(2);
            expect(result.map(n => n.protocol)).toEqual(expect.arrayContaining(['vmess', 'ss']));
        });

        it('should filter by name regex (exclude)', () => {
            const ruleText = 'US'; // Regex partial match
            const rules = buildRuleSet(ruleText);
            const result = filterNodeObjects(nodes, rules, 'exclude');
            // Should exclude 'US Node 1' and 'US Premium'
            expect(result).toHaveLength(2);
            expect(result.find(n => n.name.includes('US'))).toBeUndefined();
        });

        it('should handle complex rules', () => {
            const ruleText = `
            proto:trojan
            HK
            `;
            const rules = buildRuleSet(ruleText);
            // Include trojan OR name contains HK
            const result = filterNodeObjects(nodes, rules, 'include');
            // Trojan (JP Node 3) + HK (HK Node 2)
            expect(result).toHaveLength(2);
        });
    });
});
