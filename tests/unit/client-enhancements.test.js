import { describe, it, expect } from 'vitest';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';
import { renderClashFromTemplateModel } from '../../functions/modules/subscription/template-renderers/render-clash.js';
import { renderSingboxFromTemplateModel } from '../../functions/modules/subscription/template-renderers/render-singbox.js';
import { getBuiltinTemplate } from '../../functions/modules/subscription/builtin-template-registry.js';
import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.js';
import { applySmartModelOptimizations } from '../../functions/modules/subscription/template-processor.js';
import yaml from 'js-yaml';

const NODES = 'ss://YWVzLTEyOC1nY206cGFzcw@hk.example.com:8388#香港01';

function getOptimizedTemplateModel(templateId) {
    const template = getBuiltinTemplate(templateId);
    const model = parseIniTemplate(template.content, { proxies: [], ruleLevel: 'std' });
    return applySmartModelOptimizations(model);
}

describe('域名嗅探（sniffer）与 DoH 增强在所有渲染出口生效', () => {
    it('内置 Clash 配置包含嗅探配置与 skip-domain 防误判', () => {
        const cfg = yaml.load(
            generateBuiltinClashConfig(NODES, { ruleLevel: 'relay', isMeta: true })
        );

        expect(cfg.sniffer).toMatchObject({
            enable: true,
            'parse-pure-ip': true,
            'override-destination': true,
        });
        expect(Object.keys(cfg.sniffer.sniff)).toEqual(expect.arrayContaining(['TLS', 'HTTP', 'QUIC']));
        expect(cfg.sniffer['skip-domain']).toEqual(
            expect.arrayContaining(['Mijia Cloud', '+.push.apple.com'])
        );
    });

    it('统一模板(INI) Clash 渲染同样携带嗅探配置', () => {
        const model = getOptimizedTemplateModel('clash_misub_minimal');
        const cfg = yaml.load(renderClashFromTemplateModel(model));

        expect(cfg.sniffer?.enable).toBe(true);
        expect(cfg.sniffer?.sniff?.TLS).toBeTruthy();
    });

    it('内置 sing-box 配置首条路由规则为嗅探', () => {
        const parsed = JSON.parse(generateBuiltinSingboxConfig(NODES, { ruleLevel: 'std' }));

        expect(parsed.route.rules[0]).toEqual({ action: 'sniff' });
    });

    it('统一模板(INI) sing-box 渲染同样首条嗅探', () => {
        const model = getOptimizedTemplateModel('clash_misub_minimal');
        const parsed = JSON.parse(renderSingboxFromTemplateModel(model));

        expect(parsed.route.rules[0]).toEqual({ action: 'sniff' });
    });

    it('境外 DNS 在内置 Clash/ sing-box 输出中均为带代理出口的 DoH', () => {
        const clash = yaml.load(generateBuiltinClashConfig(NODES, { ruleLevel: 'std' }));
        expect(clash.dns.nameserver).toEqual([
            'https://8.8.8.8/dns-query#🌐 DNS 出口',
            'https://1.1.1.1/dns-query#🌐 DNS 出口',
        ]);

        const singbox = JSON.parse(generateBuiltinSingboxConfig(NODES, { ruleLevel: 'std' }));
        const foreign = singbox.dns.servers.filter((s) => s.tag.startsWith('dns-foreign'));
        expect(foreign.length).toBeGreaterThan(0);
        expect(foreign.every((s) => s.type === 'https' && s.detour === '🌐 DNS 出口')).toBe(true);
        // 国内解析保持明文 UDP 直连
        expect(singbox.dns.servers[0]).toMatchObject({ type: 'udp', server: '223.5.5.5' });
    });
});
