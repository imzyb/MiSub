import { describe, expect, it, vi } from 'vitest';
import { runOperatorChain } from '../../functions/utils/operator-runner.js';
import { createRegionalProtocolRenameDsl } from '../../src/constants/safeScriptPresets.js';

describe('operator runner', () => {
  it('runs script operators through the restricted DSL without dynamic code execution', async () => {
    const functionSpy = vi.spyOn(globalThis, 'Function').mockImplementation(() => {
      throw new Error('dynamic code execution disabled');
    });
    const urls = ['ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HKNode'];

    try {
      const result = await runOperatorChain(urls, [
        {
          type: 'script',
          params: {
            dsl: [
              { action: 'rename', template: '{name} Scripted' },
              { action: 'filter', field: 'name', op: 'contains', value: 'HKNode' }
            ]
          }
        }
      ], { target: 'clash' });

      expect(result).toHaveLength(1);
      expect(decodeURIComponent(result[0])).toContain('#HKNode Scripted');
      expect(functionSpy).not.toHaveBeenCalled();
    } finally {
      functionSpy.mockRestore();
    }
  });

  it('executes legacy factory-style scripts inside the QuickJS sandbox', async () => {
    const functionSpy = vi.spyOn(globalThis, 'Function').mockImplementation(() => {
      throw new Error('host dynamic code execution disabled');
    });
    const urls = ['ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HKNode'];

    try {
      const result = await runOperatorChain(urls, [
        {
          type: 'script',
          params: {
            code: 'return ($nodes) => $nodes.map(node => ({ ...node, name: `${node.name} Scripted` }));'
          }
        }
      ], { target: 'clash' });

      expect(result).toHaveLength(1);
      expect(decodeURIComponent(result[0])).toContain('#HKNode Scripted');
      expect(functionSpy).not.toHaveBeenCalled();
    } finally {
      functionSpy.mockRestore();
    }
  });

  it('does not expose host globals to sandbox scripts', async () => {
    const urls = ['ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HKNode'];
    const result = await runOperatorChain(urls, [
      {
        type: 'script',
        params: {
          code: `
            return $proxies.map(node => ({
              ...node,
              name: [typeof fetch, typeof process, typeof require, typeof env].join(',')
            }));
          `
        }
      }
    ]);

    expect(decodeURIComponent(result[0])).toContain('#undefined,undefined,undefined,undefined');
  });

  it('interrupts runaway sandbox scripts and keeps the original nodes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const urls = ['ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HKNode'];
    try {
      const result = await runOperatorChain(urls, [
        {
          type: 'script',
          params: { code: 'while (true) {}' }
        }
      ]);

      expect(result).toEqual(urls);
      expect(errorSpy).toHaveBeenCalledWith(
        '[Operator] Sandbox script execution failed:',
        expect.any(Error)
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does not fetch remote script URLs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const urls = ['ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#HKNode'];
    try {
      const result = await runOperatorChain(urls, [
        {
          type: 'script',
          params: { url: 'https://example.com/operator.js' }
        }
      ]);

      expect(result).toEqual(urls);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        '[Operator] Remote scripts are disabled; paste the code into the sandbox editor instead.'
      );
    } finally {
      fetchSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('normalizes regional protocols and Cloudflare nodes with safe rules', async () => {
    const urls = [
      `anytls://password@hk-anytls.example.com:443#${encodeURIComponent('HK-AnyTLS')}`,
      `hysteria2://password@hk-hy2.example.com:443#${encodeURIComponent('HK-Hysteria2')}`,
      `anytls://password@sg-anytls.example.com:443#${encodeURIComponent('SG-AnyTLS')}`,
      `hysteria2://password@sg-hy2.example.com:443#${encodeURIComponent('SG-Hysteria2')}`,
      `vless://00000000-0000-0000-0000-000000000000@jp-mislabeled.example.com:443#${encodeURIComponent('JP-Hysteria2')}`,
      `vless://00000000-0000-0000-0000-000000000000@us-cf-1.example.com:443#${encodeURIComponent('US 移动优选')}`,
      `trojan://password@us-cf-2.example.com:443#${encodeURIComponent('US 联通优选')}`,
      `ss://YWVzLTEyOC1nY206cGFzcw@unknown-cf.example.com:8388#${encodeURIComponent('Cloudflare 优选')}`,
      `ss://YWVzLTEyOC1nY206cGFzcw@unknown.example.com:8388#${encodeURIComponent('Unknown Node')}`
    ];

    const result = await runOperatorChain(urls, [
      {
        type: 'script',
        params: { dsl: createRegionalProtocolRenameDsl() }
      }
    ]);
    const names = result.map(url => decodeURIComponent(url.slice(url.lastIndexOf('#') + 1)));

    expect(names).toEqual([
      '☁CF-US-1',
      '☁CF-US-2',
      '🇭🇰HK-ANYTLS-1',
      '🇭🇰HK-HY2-1',
      '🇸🇬SG-ANYTLS-1',
      '🇸🇬SG-HY2-1',
      '🇯🇵JP-HY2-1',
      'Cloudflare 优选',
      'Unknown Node'
    ]);
  });

  it('passes regex capture groups to a template in the same rename operator', async () => {
    const urls = [
      `ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#${encodeURIComponent('[香港]-机场A-线路B')}`
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
                flags: 'gi'
              }
            ]
          },
          template: {
            enabled: true,
            template: '{g1}|{g2}|{g3}',
            indexScope: 'global'
          }
        }
      }
    ]);

    expect(decodeURIComponent(result[0])).toContain('#香港|机场A|线路B');
  });

  it('preserves regex capture groups across sequential rename operators', async () => {
    const urls = [
      `ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#${encodeURIComponent('[香港]-机场A-线路B')}`
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
                flags: 'gi'
              }
            ]
          }
        }
      },
      {
        type: 'rename',
        params: {
          template: {
            enabled: true,
            template: '{g1}|{g2}|{g3}',
            indexScope: 'global'
          }
        }
      }
    ]);

    expect(decodeURIComponent(result[0])).toContain('#香港|机场A|线路B');
  });

  it('sorts nodes by custom group metadata', async () => {
    const urls = [
      'ss://YWVzLTEyOC1nY206cGFzcw@us.example.com:8388#USNode',
      'ss://YWVzLTEyOC1nY206cGFzcw@hk.example.com:8388#HKNode',
      'ss://YWVzLTEyOC1nY206cGFzcw@jp.example.com:8388#JPNode'
    ];

    const result = await runOperatorChain(urls, [
      {
        type: 'sort',
        params: {
          keys: [{ key: 'group', order: 'asc' }]
        }
      }
    ], {
      nodeMetadataByUrl: new Map([
        [urls[0], { group: 'B-US' }],
        [urls[1], { group: 'A-HK' }],
        [urls[2], { group: 'C-JP' }]
      ])
    });

    expect(result.map(url => decodeURIComponent(url))).toEqual([
      expect.stringContaining('#HKNode'),
      expect.stringContaining('#USNode'),
      expect.stringContaining('#JPNode')
    ]);
  });

});
