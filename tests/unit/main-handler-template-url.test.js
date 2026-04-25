import { describe, it, expect } from 'vitest';
import { buildManagedConfigUrl, extractProxySectionFromBuiltin, resolveExternalTemplateConfigUrl, resolveTemplateSource, resolveTemplateUrl } from '../../functions/modules/subscription/main-handler.js';
import {
    TEMPLATE_COMPATIBILITY,
    normalizeTemplateTarget,
    shouldApplyExternalTemplateForTarget
} from '../../functions/modules/subscription/template-compatibility.js';

describe('Main handler template url', () => {
    it('should preserve subscription url while removing cache flags', () => {
        const url = buildManagedConfigUrl('https://example.com/sub?token=abc&refresh=1&nocache=1');

        expect(url).toBe('https://example.com/sub?token=abc');
    });

    it('should extract QuanX nodes from server_local section for list mode', () => {
        const content = [
            '[General]',
            'skip-proxy = localhost',
            '',
            '[server_local]',
            'DIRECT = direct',
            'shadowsocks=1.2.3.4:443, method=aes-128-gcm, password=test, tag=HK-01',
            '',
            '[policy]',
            'Proxy = select, HK-01, DIRECT'
        ].join('\n');

        expect(extractProxySectionFromBuiltin(content, 'quanx')).toBe('shadowsocks=1.2.3.4:443, method=aes-128-gcm, password=test, tag=HK-01');
    });

    it('should resolve template sources by mode', () => {
        expect(resolveTemplateUrl('builtin', 'https://example.com/a.yaml', 'https://example.com/fallback.yaml')).toBe('');
        expect(resolveTemplateUrl('global', '', 'https://example.com/fallback.yaml')).toBe('https://example.com/fallback.yaml');
        expect(resolveTemplateUrl('preset', 'https://example.com/preset.yaml', 'https://example.com/fallback.yaml')).toBe('https://example.com/preset.yaml');
        expect(resolveTemplateUrl('custom', 'https://example.com/custom.yaml', 'https://example.com/fallback.yaml')).toBe('https://example.com/custom.yaml');
        expect(resolveTemplateSource('builtin:clash_acl4ssr_full')).toEqual({ kind: 'builtin', value: 'clash_acl4ssr_full' });
        expect(resolveExternalTemplateConfigUrl(resolveTemplateSource('builtin:clash_acl4ssr_full'))).toBe('');
        expect(resolveExternalTemplateConfigUrl(resolveTemplateSource('https://example.com/preset.yaml'))).toBe('https://example.com/preset.yaml');
    });

    it('should apply external templates only to compatible targets', () => {
        expect(shouldApplyExternalTemplateForTarget('clash', 'https://example.com/preset.ini')).toBe(true);
        expect(shouldApplyExternalTemplateForTarget('surge&ver=4', 'https://example.com/preset.ini')).toBe(true);
        expect(shouldApplyExternalTemplateForTarget('loon', 'https://example.com/preset.ini')).toBe(true);
        expect(shouldApplyExternalTemplateForTarget('quanx', 'https://example.com/preset.ini')).toBe(true);
        expect(shouldApplyExternalTemplateForTarget('singbox', 'https://example.com/preset.ini')).toBe(true);
        expect(shouldApplyExternalTemplateForTarget('clash', 'https://example.com/preset.yaml')).toBe(false);
    });

    it('should normalize template targets and expose compatibility table', () => {
        expect(normalizeTemplateTarget('surge&ver=4')).toBe('surge');
        expect(normalizeTemplateTarget('sing-box')).toBe('singbox');
        expect(TEMPLATE_COMPATIBILITY.clash.allowExternalTemplate).toBe(true);
        expect(TEMPLATE_COMPATIBILITY.surge.allowExternalTemplate).toBe(true);
        expect(TEMPLATE_COMPATIBILITY.loon.allowExternalTemplate).toBe(true);
        expect(TEMPLATE_COMPATIBILITY.quanx.allowExternalTemplate).toBe(true);
        expect(TEMPLATE_COMPATIBILITY.singbox.allowExternalTemplate).toBe(true);
    });
});
