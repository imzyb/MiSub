import { describe, expect, it, vi } from 'vitest';
import { runOperatorChain } from '../../functions/utils/operator-runner.js';

describe('operator runner', () => {
    it('applies alternation regex include rules and a separate exclude rule', async () => {
        const urls = [
            'ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HK-01',
            'ss://YWVzLTEyOC1nY206cGFzcw@example.com:8389#US-01',
            'ss://YWVzLTEyOC1nY206cGFzcw@example.com:8390#JP-01',
        ];
        const result = await runOperatorChain(urls, [
            {
                type: 'filter',
                params: {
                    include: { enabled: true, rules: ['HK|US'] },
                    exclude: { enabled: true, rules: ['US'] },
                },
            },
        ]);

        expect(result).toHaveLength(1);
        expect(decodeURIComponent(result[0])).toContain('#HK-01');
    });

    it('runs script operators through the restricted DSL without dynamic code execution', async () => {
        const functionSpy = vi.spyOn(globalThis, 'Function').mockImplementation(() => {
            throw new Error('dynamic code execution disabled');
        });
        const urls = ['ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HKNode'];

        try {
            const result = await runOperatorChain(
                urls,
                [
                    {
                        type: 'script',
                        params: {
                            dsl: [
                                { action: 'rename', template: '{name} Scripted' },
                                {
                                    action: 'filter',
                                    field: 'name',
                                    op: 'contains',
                                    value: 'HKNode',
                                },
                            ],
                        },
                    },
                ],
                { target: 'clash' }
            );

            expect(result).toHaveLength(1);
            expect(decodeURIComponent(result[0])).toContain('#HKNode Scripted');
            expect(functionSpy).not.toHaveBeenCalled();
        } finally {
            functionSpy.mockRestore();
        }
    });

    it('does not execute legacy script code when dynamic code execution is disabled', async () => {
        const functionSpy = vi.spyOn(globalThis, 'Function').mockImplementation(() => {
            throw new Error('dynamic code execution disabled');
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const urls = ['ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HKNode'];

        try {
            const result = await runOperatorChain(
                urls,
                [
                    {
                        type: 'script',
                        params: {
                            code: 'return $proxies.map(p => ({ ...p, name: `${p.name} Scripted` }))',
                        },
                    },
                ],
                { target: 'clash' }
            );

            expect(result).toHaveLength(1);
            expect(decodeURIComponent(result[0])).toContain('#HKNode');
            expect(decodeURIComponent(result[0])).not.toContain('Scripted');
            expect(functionSpy).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith(
                '[Operator] Legacy script code is disabled; use params.dsl instead.'
            );
        } finally {
            functionSpy.mockRestore();
            warnSpy.mockRestore();
        }
    });

    it('passes regex capture groups to a template in the same rename operator', async () => {
        const urls = [
            `ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#${encodeURIComponent('[香港]-机场A-线路B')}`,
        ];
        const result = await runOperatorChain(urls, [
            {
                type: 'rename',
                params: {
                    regex: {
                        enabled: true,
                        rules: [
                            {
                                pattern: '\\[(.*?)\\]-(.*?)-(.*)$',
                                replacement: '',
                                flags: 'gi',
                            },
                        ],
                    },
                    template: {
                        enabled: true,
                        template: '{g1}|{g2}|{g3}',
                        indexScope: 'global',
                    },
                },
            },
        ]);

        expect(decodeURIComponent(result[0])).toContain('#香港|机场A|线路B');
    });

    it('preserves regex capture groups across sequential rename operators', async () => {
        const urls = [
            `ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#${encodeURIComponent('[香港]-机场A-线路B')}`,
        ];
        const result = await runOperatorChain(urls, [
            {
                type: 'rename',
                params: {
                    regex: {
                        enabled: true,
                        rules: [
                            {
                                pattern: '\\[(.*?)\\]-(.*?)-(.*)$',
                                replacement: '',
                                flags: 'gi',
                            },
                        ],
                    },
                },
            },
            {
                type: 'rename',
                params: {
                    template: {
                        enabled: true,
                        template: '{g1}|{g2}|{g3}',
                        indexScope: 'global',
                    },
                },
            },
        ]);

        expect(decodeURIComponent(result[0])).toContain('#香港|机场A|线路B');
    });

    it('sorts nodes by custom group metadata', async () => {
        const urls = [
            'ss://YWVzLTEyOC1nY206cGFzcw@us.example.com:8388#USNode',
            'ss://YWVzLTEyOC1nY206cGFzcw@hk.example.com:8388#HKNode',
            'ss://YWVzLTEyOC1nY206cGFzcw@jp.example.com:8388#JPNode',
        ];

        const result = await runOperatorChain(
            urls,
            [
                {
                    type: 'sort',
                    params: {
                        keys: [{ key: 'group', order: 'asc' }],
                    },
                },
            ],
            {
                nodeMetadataByUrl: new Map([
                    [urls[0], { group: 'B-US' }],
                    [urls[1], { group: 'A-HK' }],
                    [urls[2], { group: 'C-JP' }],
                ]),
            }
        );

        expect(result.map((url) => decodeURIComponent(url))).toEqual([
            expect.stringContaining('#HKNode'),
            expect.stringContaining('#USNode'),
            expect.stringContaining('#JPNode'),
        ]);
    });
});
