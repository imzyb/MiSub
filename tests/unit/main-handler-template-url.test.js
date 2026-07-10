import { describe, it, expect } from 'vitest';
import {
    buildExternalSubconverterUrl,
    buildManagedConfigUrl,
    extractProxySectionFromBuiltin,
    resolveExternalTemplateConfigUrl,
    resolveTemplateSource,
    resolveTemplateUrl,
    shouldRenderClashYamlProfileTemplateLocally
} from '../../functions/modules/subscription/main-handler.js';
import {
    TEMPLATE_COMPATIBILITY,
    normalizeTemplateTarget,
    shouldApplyExternalTemplateForTarget
} from '../../functions/modules/subscription/template-compatibility.js';

describe('Main handler template url', () => {
    it('should preserve subscription url while removing cache flags', () => {
        const url = buildManagedConfigUrl('https://example.com/sub?profile=demo&refresh=1&nocache=1');

        expect(url).toBe('https://example.com/sub?profile=demo');
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
        expect(resolveTemplateUrl('custom_template', 'custom:tpl-a', 'https://example.com/fallback.yaml')).toBe('custom:tpl-a');
        expect(resolveTemplateUrl('custom_template', 'https://example.com/not-local.ini', 'https://example.com/fallback.yaml')).toBe('');
        expect(resolveTemplateSource('builtin:clash_acl4ssr_full')).toEqual({ kind: 'builtin', value: 'clash_acl4ssr_full' });
        expect(resolveTemplateSource('custom:tpl-a')).toEqual({ kind: 'custom', value: 'tpl-a' });
        expect(resolveExternalTemplateConfigUrl(resolveTemplateSource('builtin:clash_acl4ssr_full'))).toBe('');
        expect(resolveExternalTemplateConfigUrl(resolveTemplateSource('custom:tpl-a'))).toBe('');
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

    it('should forward remote YAML config URLs to external subconverter backends', () => {
        const externalUrl = buildExternalSubconverterUrl({
            backend: 'https://sub.example.com/sub',
            targetFormat: 'clash',
            nodeList: 'ss://node-a#A\nss://node-b#B',
            templateSource: resolveTemplateSource('https://raw.githubusercontent.com/Luckylos/shellcrashyaml/main/subconverter-shellcrash-needs.yaml'),
            subName: 'ShellCrash'
        });

        expect(externalUrl.searchParams.get('target')).toBe('clash');
        expect(externalUrl.searchParams.get('url')).toBe('ss://node-a#A|ss://node-b#B');
        expect(externalUrl.searchParams.get('config')).toBe('https://raw.githubusercontent.com/Luckylos/shellcrashyaml/main/subconverter-shellcrash-needs.yaml');
    });

    it('should normalize GitHub blob config URLs before forwarding to external subconverter backends', () => {
        const externalUrl = buildExternalSubconverterUrl({
            backend: 'https://sub.example.com/sub',
            targetFormat: 'clash',
            nodeList: 'ss://node-a#A',
            templateSource: resolveTemplateSource('https://github.com/Luckylos/shellcrashyaml/blob/main/subconverter-shellcrash-needs.yaml'),
            subName: 'ShellCrash'
        });

        expect(externalUrl.searchParams.get('config')).toBe('https://raw.githubusercontent.com/Luckylos/shellcrashyaml/main/subconverter-shellcrash-needs.yaml');
    });

    it('should render remote Clash YAML profile templates locally in external mode', () => {
        expect(shouldRenderClashYamlProfileTemplateLocally({
            isExternalMode: true,
            targetFormat: 'clash',
            templateSource: resolveTemplateSource('https://raw.githubusercontent.com/Luckylos/shellcrashyaml/refs/heads/main/subconverter-shellcrash-needs.yaml')
        })).toBe(true);
        expect(shouldRenderClashYamlProfileTemplateLocally({
            isExternalMode: true,
            targetFormat: 'surge',
            templateSource: resolveTemplateSource('https://raw.githubusercontent.com/Luckylos/shellcrashyaml/refs/heads/main/subconverter-shellcrash-needs.yaml')
        })).toBe(false);
        expect(shouldRenderClashYamlProfileTemplateLocally({
            isExternalMode: true,
            targetFormat: 'clash',
            templateSource: resolveTemplateSource('https://example.com/subconverter.ini')
        })).toBe(false);
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
