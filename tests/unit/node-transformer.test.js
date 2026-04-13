import { describe, expect, it } from 'vitest';
import { applyNodeTransformPipeline } from '../../functions/utils/node-transformer.js';

describe('applyNodeTransformPipeline filters', () => {
    const nodes = [
        'vmess://eyJ2IjoiMiIsInBzIjoi8J+HuvCfh7ggVVMgTm9kZSAwMSIsImFkZCI6InVzMS5leGFtcGxlLmNvbSIsInBvcnQiOiI0NDMiLCJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsImFpZCI6MCwibmV0IjoidGNwIiwidHlwZSI6Im5vbmUiLCJob3N0IjoiIiwicGF0aCI6IiIsInRscyI6InRscyJ9',
        'trojan://password@hk1.example.com:443#%F0%9F%87%AD%F0%9F%87%B0%20HK%20Node%2001',
        'ss://YWVzLTI1Ni1nY206cGFzc0AxMjcuMC4wLjE6ODM4OA==#%E5%88%B0%E6%9C%9F%E6%8F%90%E7%A4%BA'
    ];

    it('keeps only nodes matching include rules', () => {
        const result = applyNodeTransformPipeline(nodes, {
            enabled: true,
            filter: {
                include: { enabled: true, rules: [{ pattern: 'US|HK', flags: 'i' }] },
                exclude: { enabled: false, rules: [] }
            },
            rename: { regex: { enabled: false, rules: [] }, template: { enabled: false } },
            dedup: { enabled: false, mode: 'serverPort', includeProtocol: false, prefer: { protocolOrder: [] } },
            sort: { enabled: false, keys: [] }
        });

        expect(result).toHaveLength(2);
        expect(result.some(line => line.includes('HK%20Node'))).toBe(true);
    });

    it('removes nodes matching exclude rules after include rules', () => {
        const result = applyNodeTransformPipeline(nodes, {
            enabled: true,
            filter: {
                include: { enabled: true, rules: [{ pattern: 'Node|到期', flags: 'i' }] },
                exclude: { enabled: true, rules: [{ pattern: '到期', flags: 'i' }] }
            },
            rename: { regex: { enabled: false, rules: [] }, template: { enabled: false } },
            dedup: { enabled: false, mode: 'serverPort', includeProtocol: false, prefer: { protocolOrder: [] } },
            sort: { enabled: false, keys: [] }
        });

        expect(result).toHaveLength(2);
        expect(result.some(line => line.includes('%E5%88%B0%E6%9C%9F'))).toBe(false);
    });

    it('filters by protocol and region using structured filters', () => {
        const result = applyNodeTransformPipeline(nodes, {
            enabled: true,
            filter: {
                include: { enabled: false, rules: [] },
                exclude: { enabled: false, rules: [] },
                protocols: { enabled: true, values: ['trojan', 'ss'] },
                regions: { enabled: true, values: ['香港'] }
            },
            rename: { regex: { enabled: false, rules: [] }, template: { enabled: false } },
            dedup: { enabled: false, mode: 'serverPort', includeProtocol: false, prefer: { protocolOrder: [] } },
            sort: { enabled: false, keys: [] }
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toContain('trojan://');
        expect(result[0]).toContain('HK%20Node');
    });

    it('removes useless info nodes when useless filter is enabled', () => {
        const result = applyNodeTransformPipeline([
            ...nodes,
            'trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#%E6%B5%81%E9%87%8F%E5%89%A9%E4%BD%99%20%E2%89%AB%2012GB',
            'trojan://foo@info.example.com:443#%E5%A5%97%E9%A4%90%E5%88%B0%E6%9C%9F%EF%BC%9A2026-12-31'
        ], {
            enabled: true,
            filter: {
                include: { enabled: false, rules: [] },
                exclude: { enabled: false, rules: [] },
                protocols: { enabled: false, values: [] },
                regions: { enabled: false, values: [] },
                useless: { enabled: true }
            },
            rename: { regex: { enabled: false, rules: [] }, template: { enabled: false } },
            dedup: { enabled: false, mode: 'serverPort', includeProtocol: false, prefer: { protocolOrder: [] } },
            sort: { enabled: false, keys: [] }
        });

        expect(result).toHaveLength(3);
        expect(result.some(line => line.includes('%E6%B5%81%E9%87%8F%E5%89%A9%E4%BD%99'))).toBe(false);
        expect(result.some(line => line.includes('%E5%A5%97%E9%A4%90%E5%88%B0%E6%9C%9F'))).toBe(false);
    });
});
