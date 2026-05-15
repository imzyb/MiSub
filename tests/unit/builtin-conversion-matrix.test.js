import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ProcessorService } from '../../functions/services/processor-service.js';
import {
    resolveBuiltinEngineFlags,
    resolveEffectiveEngine,
    resolveExternalTemplateConfigUrl,
    resolveTemplateSource
} from '../../functions/modules/subscription/main-handler.js';

const NODE_LIST = 'trojan://pass@1.1.1.1:443#HK-01';
const HIDDIFY_UA = 'HiddifyNext/4.1.1 (android) like ClashMeta v2ray sing-box';

const storageAdapter = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn()
};

describe('Builtin conversion matrix characterization', () => {
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

    it('keeps the current engine selection precedence', () => {
        expect(resolveEffectiveEngine({
            searchParams: new URLSearchParams('engine=external'),
            profileEngineMode: 'builtin',
            globalEngineMode: 'builtin'
        })).toBe('external');

        expect(resolveEffectiveEngine({
            searchParams: new URLSearchParams('builtin=external'),
            profileEngineMode: 'builtin',
            globalEngineMode: 'builtin'
        })).toBe('external');

        expect(resolveEffectiveEngine({
            searchParams: new URLSearchParams('builtin=1'),
            profileEngineMode: 'external',
            globalEngineMode: 'external'
        })).toBe('builtin');

        expect(resolveEffectiveEngine({
            searchParams: new URLSearchParams(''),
            userAgent: HIDDIFY_UA,
            profileEngineMode: '',
            globalEngineMode: 'external'
        })).toBe('builtin');

        expect(resolveEffectiveEngine({
            searchParams: new URLSearchParams('target=singbox'),
            userAgent: HIDDIFY_UA,
            profileEngineMode: '',
            globalEngineMode: 'external'
        })).toBe('external');
    });

    it('documents builtin versus remote template source handling', () => {
        const builtinSource = resolveTemplateSource('builtin:clash_acl4ssr_full');
        expect(builtinSource).toEqual({ kind: 'builtin', value: 'clash_acl4ssr_full' });
        expect(resolveExternalTemplateConfigUrl(builtinSource)).toBe('');

        const remoteSource = resolveTemplateSource('https://example.com/template.ini?token=***');
        expect(remoteSource).toEqual({ kind: 'remote', value: 'https://example.com/template.ini?token=***' });
        expect(resolveExternalTemplateConfigUrl(remoteSource)).toBe('https://example.com/template.ini?token=***');

        expect(resolveTemplateSource('')).toEqual({ kind: 'none', value: '' });
    });

    it('disables builtin engine flags while external engine mode is active', () => {
        expect(resolveBuiltinEngineFlags({ builtinSkipCertVerify: true, builtinEnableUdp: true }, true)).toEqual({
            shouldSkipCertificateVerify: false,
            shouldEnableUdp: false
        });

        expect(resolveBuiltinEngineFlags({ builtinSkipCertVerify: true, builtinEnableUdp: true }, false)).toEqual({
            shouldSkipCertificateVerify: true,
            shouldEnableUdp: true
        });
    });

    it('renders builtin ini templates through the model pipeline for supported targets', async () => {
        const cases = [
            {
                targetFormat: 'clash',
                contentType: 'application/x-yaml; charset=utf-8',
                marker: 'proxy-groups:'
            },
            {
                targetFormat: 'singbox',
                contentType: 'application/json; charset=utf-8',
                marker: '"outbounds"'
            },
            {
                targetFormat: 'surge&ver=4',
                contentType: 'text/plain; charset=utf-8',
                marker: '[Proxy Group]'
            },
            {
                targetFormat: 'loon',
                contentType: 'text/plain; charset=utf-8',
                marker: '[Proxy Group]'
            },
            {
                targetFormat: 'quanx',
                contentType: 'text/plain; charset=utf-8',
                marker: '[policy]'
            }
        ];

        for (const item of cases) {
            const result = await ProcessorService.renderOutput({
                targetFormat: item.targetFormat,
                combinedNodeList: NODE_LIST,
                subName: 'Matrix Test',
                config: { UpdateInterval: 86400 },
                builtinOptions: { ruleLevel: 'std', enableUdp: true, skipCertVerify: false },
                templateSource: { kind: 'builtin', value: 'clash_acl4ssr_lite' },
                managedConfigUrl: `https://example.com/sub?target=${encodeURIComponent(item.targetFormat)}&builtin=1`,
                storageAdapter
            });

            expect(result.contentType).toBe(item.contentType);
            expect(result.content).toContain(item.marker);
        }

        expect(fetch).not.toHaveBeenCalled();
    });

    it('keeps Hiddify-compatible Clash output on the conservative builtin path even when a template is configured', async () => {
        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'Hiddify Matrix Test',
            config: { UpdateInterval: 86400 },
            builtinOptions: {
                ruleLevel: 'std',
                userAgent: HIDDIFY_UA,
                hiddifyCompatible: true,
                searchParams: new URLSearchParams('')
            },
            templateSource: { kind: 'builtin', value: 'clash_acl4ssr_lite' },
            managedConfigUrl: '',
            storageAdapter
        });

        expect(result.contentType).toBe('application/x-yaml; charset=utf-8');
        expect(result.content).toContain('proxies:');
        expect(result.content).not.toContain('rule-providers:');
        expect(result.content).not.toContain('RULE-SET,');
        expect(result.content).toContain('MATCH,🚀 节点选择');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('falls back to base64 node output when no builtin renderer supports the requested target', async () => {
        const result = await ProcessorService.renderOutput({
            targetFormat: 'unsupported-target',
            combinedNodeList: NODE_LIST,
            subName: 'Unsupported Matrix Test',
            config: {},
            builtinOptions: {},
            templateSource: { kind: 'none', value: '' },
            managedConfigUrl: '',
            storageAdapter
        });

        expect(result.contentType).toBe('text/plain; charset=utf-8');
        expect(result.content).toBe(Buffer.from(NODE_LIST, 'utf8').toString('base64'));
    });
});
