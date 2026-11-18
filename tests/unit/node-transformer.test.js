import { describe, expect, it, vi } from 'vitest';
import {
    applyNodeTransformPipeline,
    makeComparator,
} from '../../functions/utils/node-transformer.js';

describe('applyNodeTransformPipeline filters', () => {
    const nodes = [
        'vmess://eyJ2IjoiMiIsInBzIjoi8J+HuvCfh7ggVVMgTm9kZSAwMSIsImFkZCI6InVzMS5leGFtcGxlLmNvbSIsInBvcnQiOiI0NDMiLCJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsImFpZCI6MCwibmV0IjoidGNwIiwidHlwZSI6Im5vbmUiLCJob3N0IjoiIiwicGF0aCI6IiIsInRscyI6InRscyJ9',
        'trojan://password@hk1.example.com:443#%F0%9F%87%AD%F0%9F%87%B0%20HK%20Node%2001',
        'ss://YWVzLTI1Ni1nY206cGFzc0AxMjcuMC4wLjE6ODM4OA==#%E5%88%B0%E6%9C%9F%E6%8F%90%E7%A4%BA',
    ];

    it('keeps only nodes matching include rules', () => {
        const result = applyNodeTransformPipeline(nodes, {
            enabled: true,
            filter: {
                include: { enabled: true, rules: [{ pattern: 'US|HK', flags: 'i' }] },
                exclude: { enabled: false, rules: [] },
            },
            rename: { regex: { enabled: false, rules: [] }, template: { enabled: false } },
            dedup: {
                enabled: false,
                mode: 'serverPort',
                includeProtocol: false,
                prefer: { protocolOrder: [] },
            },
            sort: { enabled: false, keys: [] },
        });

        expect(result).toHaveLength(2);
        expect(result.some((line) => line.includes('HK%20Node'))).toBe(true);
    });

    it('removes nodes matching exclude rules after include rules', () => {
        const result = applyNodeTransformPipeline(nodes, {
            enabled: true,
            filter: {
                include: { enabled: true, rules: [{ pattern: 'Node|到期', flags: 'i' }] },
                exclude: { enabled: true, rules: [{ pattern: '到期', flags: 'i' }] },
            },
            rename: { regex: { enabled: false, rules: [] }, template: { enabled: false } },
            dedup: {
                enabled: false,
                mode: 'serverPort',
                includeProtocol: false,
                prefer: { protocolOrder: [] },
            },
            sort: { enabled: false, keys: [] },
        });

        expect(result).toHaveLength(2);
        expect(result.some((line) => line.includes('%E5%88%B0%E6%9C%9F'))).toBe(false);
    });

    it('filters by protocol and region using structured filters', () => {
        const result = applyNodeTransformPipeline(nodes, {
            enabled: true,
            filter: {
                include: { enabled: false, rules: [] },
                exclude: { enabled: false, rules: [] },
                protocols: { enabled: true, values: ['trojan', 'ss'] },
                regions: { enabled: true, values: ['香港'] },
            },
            rename: { regex: { enabled: false, rules: [] }, template: { enabled: false } },
            dedup: {
                enabled: false,
                mode: 'serverPort',
                includeProtocol: false,
                prefer: { protocolOrder: [] },
            },
            sort: { enabled: false, keys: [] },
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toContain('trojan://');
        expect(result[0]).toContain('HK%20Node');
    });

    it('removes useless info nodes when useless filter is enabled', () => {
        const result = applyNodeTransformPipeline(
            [
                ...nodes,
                'trojan://bar@info2.example.com:443#%E6%B5%81%E9%87%8F%E5%89%A9%E4%BD%99%20%E2%89%AB%2012GB',
                'trojan://foo@info.example.com:443#%E5%A5%97%E9%A4%90%E5%88%B0%E6%9C%9F%EF%BC%9A2026-12-31',
            ],
            {
                enabled: true,
                filter: {
                    include: { enabled: false, rules: [] },
                    exclude: { enabled: false, rules: [] },
                    protocols: { enabled: false, values: [] },
                    regions: { enabled: false, values: [] },
                    useless: { enabled: true },
                },
                rename: { regex: { enabled: false, rules: [] }, template: { enabled: false } },
                dedup: {
                    enabled: false,
                    mode: 'serverPort',
                    includeProtocol: false,
                    prefer: { protocolOrder: [] },
                },
                sort: { enabled: false, keys: [] },
            }
        );

        expect(result).toHaveLength(3);
        expect(result.some((line) => line.includes('%E6%B5%81%E9%87%8F%E5%89%A9%E4%BD%99'))).toBe(
            false
        );
        expect(result.some((line) => line.includes('%E5%A5%97%E9%A4%90%E5%88%B0%E6%9C%9F'))).toBe(
            false
        );
    });

    it('keeps system virtual info nodes when useless filter is enabled', () => {
        const result = applyNodeTransformPipeline(
            [
                ...nodes,
                'trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#%E6%B5%81%E9%87%8F%E5%89%A9%E4%BD%99%20%E2%89%AB%2012GB',
            ],
            {
                enabled: true,
                filter: {
                    include: { enabled: false, rules: [] },
                    exclude: { enabled: false, rules: [] },
                    protocols: { enabled: false, values: [] },
                    regions: { enabled: false, values: [] },
                    useless: { enabled: true },
                },
                rename: { regex: { enabled: false, rules: [] }, template: { enabled: false } },
                dedup: {
                    enabled: false,
                    mode: 'serverPort',
                    includeProtocol: false,
                    prefer: { protocolOrder: [] },
                },
                sort: { enabled: false, keys: [] },
            }
        );

        // 系统虚拟信息节点（UUID 全 0 + 127.0.0.1:443）应被放行
        expect(result).toHaveLength(nodes.length + 1);
        expect(result.some((line) => line.includes('%E6%B5%81%E9%87%8F%E5%89%A9%E4%BD%99'))).toBe(
            true
        );
    });

    it('sorts nodes by regex priority rules first and falls back to subsequent sort keys', () => {
        const records = [
            { name: 'HK 阿里云 01', protocol: 'trojan' },
            { name: 'US DMIT Pro 02', protocol: 'vmess' },
            { name: 'JP 亚马逊 AWS 02', protocol: 'trojan' },
            { name: 'SG 普通节点 01', protocol: 'vless' },
            { name: 'US dmit Lite 01', protocol: 'vless' },
            { name: 'HK 亚马逊 AWS 01', protocol: 'vless' },
        ];

        const comparator = makeComparator({
            keys: [
                { key: 'regex', order: 'asc', customOrder: ['亚马逊', 'dmit'] },
                { key: 'protocol', order: 'asc', customOrder: ['vless', 'trojan', 'vmess'] },
            ],
        });

        const sortedNames = [...records].sort(comparator).map((r) => r.name);
        expect(sortedNames).toEqual([
            'HK 亚马逊 AWS 01',
            'JP 亚马逊 AWS 02',
            'US dmit Lite 01',
            'US DMIT Pro 02',
            'SG 普通节点 01',
            'HK 阿里云 01',
        ]);
    });

    it('keeps regex matching stateless even when object rules specify g or y flags', () => {
        const records = [
            { name: 'Node C' },
            { name: 'AWS Node 1' },
            { name: 'AWS Node 2' },
            { name: 'Node D' },
            { name: 'AWS Node 3' },
            { name: 'AWS Node 4' },
        ];

        const comparator = makeComparator({
            keys: [
                {
                    key: 'regex',
                    order: 'asc',
                    customOrder: [{ pattern: 'aws', flags: 'gi' }],
                },
                { key: 'name', order: 'asc' },
            ],
        });

        const sortedNames = [...records].sort(comparator).map((r) => r.name);
        expect(sortedNames).toEqual([
            'AWS Node 1',
            'AWS Node 2',
            'AWS Node 3',
            'AWS Node 4',
            'Node C',
            'Node D',
        ]);
    });

    it('keeps matched nodes pinned at top even if regex condition specifies desc order', () => {
        const records = [
            { name: 'SG Normal 01' },
            { name: 'US DMIT 01' },
            { name: 'HK AWS 01' },
            { name: 'JP Normal 02' },
        ];

        const comparator = makeComparator({
            keys: [
                { key: 'regex', order: 'desc', customOrder: ['aws', 'dmit'] },
                { key: 'name', order: 'asc' },
            ],
        });

        const sortedNames = [...records].sort(comparator).map((r) => r.name);
        expect(sortedNames).toEqual(['HK AWS 01', 'US DMIT 01', 'JP Normal 02', 'SG Normal 01']);
    });

    it('caches regex match index per node name across comparator calls', () => {
        const records = [
            { name: 'Normal 1' },
            { name: 'DMIT 1' },
            { name: 'AWS 1' },
            { name: 'Normal 2' },
            { name: 'AWS 2' },
            { name: 'Normal 3' },
            { name: 'DMIT 2' },
            { name: 'Normal 4' },
        ];

        const comparator = makeComparator({
            keys: [{ key: 'regex', order: 'asc', customOrder: ['aws', 'dmit'] }],
        });

        let regexTestCalls = 0;
        const origTest = RegExp.prototype.test;
        const testSpy = vi.spyOn(RegExp.prototype, 'test').mockImplementation(function (str) {
            if (this.source === 'aws' || this.source === 'dmit') {
                regexTestCalls++;
            }
            return origTest.call(this, str);
        });

        try {
            const sortedNames = [...records].sort(comparator).map((r) => r.name);
            expect(sortedNames.slice(0, 4)).toEqual(['AWS 1', 'AWS 2', 'DMIT 1', 'DMIT 2']);
            // 2 个 AWS (1次) + 2 个 DMIT (2次) + 4 个未匹配 (2次) = 14 次
            expect(regexTestCalls).toBe(14);
        } finally {
            testSpy.mockRestore();
        }
    });
});
