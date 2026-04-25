import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessorService, isIniTemplateSource } from '../../functions/services/processor-service.js';

const NODE_LIST = 'trojan://pass@1.1.1.1:443#HK-01';

describe('ProcessorService.renderOutput', () => {
    const storageAdapter = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn()
    };

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(`
[Proxy Group]
MyGroup = select, HK-01, DIRECT

[Rule]
MATCH,MyGroup
`, { status: 200 })));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('recognizes remote ini templates with query strings', async () => {
        expect(isIniTemplateSource({ kind: 'remote', value: 'https://example.com/template.ini?token=abc' })).toBe(true);

        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'Demo',
            config: { UpdateInterval: 86400 },
            builtinOptions: { ruleLevel: 'std', enableUdp: true, skipCertVerify: false },
            templateSource: { kind: 'remote', value: 'https://example.com/template.ini?token=abc' },
            managedConfigUrl: 'https://example.com/sub',
            storageAdapter
        });

        expect(result.contentType).toBe('application/x-yaml; charset=utf-8');
        expect(result.content).toContain('name: MyGroup');
        expect(result.content).toContain('MATCH,MyGroup');
    });

    it('uses builtin rendering when templateSource is omitted', async () => {
        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'Demo',
            config: {},
            builtinOptions: { ruleLevel: 'base' },
            managedConfigUrl: 'https://example.com/sub',
            storageAdapter
        });

        expect(result.contentType).toBe('application/x-yaml; charset=utf-8');
        expect(result.content).toContain('proxies:');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('preserves managed config header for builtin quanx output', async () => {
        const result = await ProcessorService.renderOutput({
            targetFormat: 'quanx',
            combinedNodeList: NODE_LIST,
            subName: 'Demo',
            config: { UpdateInterval: 86400 },
            builtinOptions: { ruleLevel: 'std', skipCertVerify: false, enableUdp: false },
            managedConfigUrl: 'https://example.com/sub?target=quanx&builtin=1',
            storageAdapter
        });

        expect(result.content).toContain('#!MANAGED-CONFIG https://example.com/sub?target=quanx&builtin=1 interval=86400 strict=false');
        expect(result.content).toContain('[general]');
        expect(result.content).toContain('[dns]');
    });
});
