import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.js';
import { renderClashFromIniTemplate, renderLoonFromIniTemplate, renderQuanxFromIniTemplate, renderSingboxFromIniTemplate, renderSurgeFromIniTemplate } from '../../functions/modules/subscription/template-pipeline.js';
import { getBuiltinTemplate } from '../../functions/modules/subscription/builtin-template-registry.js';

const SS2022_V2RAY_PLUGIN_NODE = 'ss://MjAyMi1ibGFrZTMtYWVzLTI1Ni1nY206TldSak1UVmxNVFZtTWpnMU5HRTVaRGsxT1dJd1pUUm1ZbVJrTnpkaU5qTT0@cf.090227.xyz:8080?plugin=v2ray-plugin%3Bmode%3Dwebsocket%3Bhost%3Dss.2227tsj.workers.dev%3Bpath%3D%2F%3Fenc%5C%3D2022-blake3-aes-256-gcm%3Bmux%3D0#2022-blake3-aes-256-gcm';

describe('Template pipeline', () => {
    it('should parse limited ini template into unified model', () => {
        const model = parseIniTemplate(`
[Proxy Group]
节点选择 = select, HK-01, JP-01, DIRECT
自动选择 = url-test, HK-01, JP-01, url=http://www.gstatic.com/generate_204, interval=300

[Rule]
DOMAIN-SUFFIX,google.com,节点选择
GEOIP,CN,DIRECT
MATCH,节点选择
        `, {
            fileName: 'Demo',
            targetFormat: 'clash'
        });

        expect(model.groups).toHaveLength(2);
        expect(model.rules).toHaveLength(3);
        expect(model.groups[0].name).toBe('节点选择');
        expect(model.rules[2].type).toBe('match');
    });

    it('should render clash yaml from limited ini template', () => {
        const rendered = renderClashFromIniTemplate(`
[Proxy Group]
节点选择 = select, HK-01, JP-01, DIRECT

[Rule]
DOMAIN-SUFFIX,google.com,节点选择
MATCH,节点选择
        `, {
            proxies: [
                { name: 'HK-01', type: 'trojan', server: '1.1.1.1', port: 443, password: 'pass' },
                { name: 'JP-01', type: 'trojan', server: '2.2.2.2', port: 443, password: 'pass' }
            ],
            managedConfigUrl: 'https://example.com/sub'
        });

        const parsed = yaml.load(rendered);
        expect(parsed['proxy-groups'][0].name).toBe('节点选择');
        expect(parsed.rules).toContain('MATCH,节点选择');
        expect(parsed.profile['subscription-url']).toBe('https://example.com/sub');
    });

    it('should exclude DIRECT from auto-select groups when rendering templates', () => {
        const rendered = renderClashFromIniTemplate(`
[Proxy Group]
节点选择 = select, 自动选择, DIRECT
自动选择 = url-test, HK-01, JP-01, DIRECT

[Rule]
MATCH,节点选择
        `, {
            proxies: [
                { name: 'HK-01', type: 'trojan', server: '1.1.1.1', port: 443, password: 'pass' },
                { name: 'JP-01', type: 'trojan', server: '2.2.2.2', port: 443, password: 'pass' }
            ]
        });

        const parsed = yaml.load(rendered);
        const autoSelectGroup = parsed['proxy-groups'].find(group => group.name === '自动选择');
        expect(autoSelectGroup.proxies).toEqual(['HK-01', 'JP-01']);
        expect(autoSelectGroup.proxies).not.toContain('DIRECT');
    });

    it('should merge duplicate proxy groups with the same name before rendering', () => {
        const rendered = renderClashFromIniTemplate(`
[Proxy Group]
节点选择 = select, HK-01
节点选择 = select, JP-01, DIRECT
自动选择 = url-test, HK-01, JP-01

[Rule]
MATCH,节点选择
        `, {
            proxies: [
                { name: 'HK-01', type: 'trojan', server: '1.1.1.1', port: 443, password: 'pass' },
                { name: 'JP-01', type: 'trojan', server: '2.2.2.2', port: 443, password: 'pass' }
            ]
        });

        const parsed = yaml.load(rendered);
        const selectGroups = parsed['proxy-groups'].filter(group => group.name === '节点选择');
        expect(selectGroups).toHaveLength(1);
        expect(selectGroups[0].proxies).toContain('HK-01');
        expect(selectGroups[0].proxies).toContain('JP-01');
        expect(selectGroups[0].proxies).toContain('DIRECT');
    });

    it('should parse builtin ACL4SSR custom template registry entry', () => {
        const builtinTemplate = getBuiltinTemplate('clash_acl4ssr_full');
        const model = parseIniTemplate(builtinTemplate.content, {
            fileName: 'ACL4SSR',
            targetFormat: 'clash'
        });

        expect(model.groups.length).toBeGreaterThan(10);
        expect(model.rules.some(rule => rule.type === 'rule-set')).toBe(true);
        expect(model.groups.some(group => group.name === '🚀 节点选择')).toBe(true);
    });

    it('should render sing-box json from ACL4SSR custom template', () => {
        const builtinTemplate = getBuiltinTemplate('clash_acl4ssr_full');
        const rendered = renderSingboxFromIniTemplate(builtinTemplate.content, {
            nodeList: [
                'trojan://password@1.2.3.4:443#HK-01',
                'vmess://eyJ2IjoiMiIsInBzIjoiSlAtMDEiLCJhZGQiOiIxLjIuMy41IiwicG9ydCI6IjQ0MyIsImlkIjoidXVpZC0xMjM0IiwiYWlkIjoiMCIsIm5ldCI6IndzIiwidHlwZSI6Im5vbmUiLCJob3N0IjoiZXhhbXBsZS5jb20iLCJwYXRoIjoiL3dzIiwidGxzIjoidGxzIn0'
            ].join('\n'),
            targetFormat: 'singbox'
        });
        const parsed = JSON.parse(rendered);

        expect(Array.isArray(parsed.outbounds)).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🚀 节点选择')).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🇭🇰 HK-01')).toBe(true);
        expect(parsed.outbounds.some(outbound => outbound.tag === '🇯🇵 JP-01' && outbound.type === 'vmess')).toBe(true);
        expect(Array.isArray(parsed.route.rule_set)).toBe(true);
        expect(parsed.route.rule_set.length).toBeGreaterThan(0);
        const aclRuleSets = parsed.route.rule_set.filter(ruleSet => String(ruleSet.url).endsWith('.list'));
        expect(aclRuleSets.length).toBeGreaterThan(0);
        expect(aclRuleSets.every(ruleSet => ruleSet.format === 'source')).toBe(true);
    });

    it('should render surge config sections from ACL4SSR custom template', () => {
        const builtinTemplate = getBuiltinTemplate('clash_acl4ssr_full');
        const rendered = renderSurgeFromIniTemplate(builtinTemplate.content, {
            nodeList: [
                'trojan://password@1.2.3.4:443#HK-01',
                'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.5:8388#JP-01'
            ].join('\n'),
            targetFormat: 'surge&ver=4'
        });

        expect(rendered).toContain('[Proxy]');
        expect(rendered).toContain('[Proxy Group]');
        expect(rendered).toContain('[Rule]');
        expect(rendered).toContain('🚀 节点选择 = select');
    });

    it('should render loon and quanx config sections from ACL4SSR custom template', () => {
        const builtinTemplate = getBuiltinTemplate('clash_acl4ssr_full');
        const nodeList = [
            'trojan://password@1.2.3.4:443#HK-01',
            'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.5:8388#JP-01',
            'vmess://eyJ2IjoiMiIsInBzIjoiVVMtMDEiLCJhZGQiOiIxLjIuMy42IiwicG9ydCI6IjQ0MyIsImlkIjoidXVpZC01Njc4IiwiYWlkIjoiMCIsIm5ldCI6IndzIiwiaG9zdCI6ImV4YW1wbGUuY29tIiwicGF0aCI6Ii93cyIsInRscyI6InRscyJ9',
            'vless://uuid-9999@1.2.3.7:443?security=reality&type=grpc&serviceName=edge&pbk=testpublickey&sid=abcd&sni=example.com#SG-01',
            'wireguard://privatekey@1.2.3.8:51820?publickey=peerpub&reserved=1,2,3&address=172.16.0.2/32#WG-01'
        ].join('\n');

        const loonRendered = renderLoonFromIniTemplate(builtinTemplate.content, { nodeList, targetFormat: 'loon' });
        const quanxRendered = renderQuanxFromIniTemplate(builtinTemplate.content, { nodeList, targetFormat: 'quanx' });
        const surgeRendered = renderSurgeFromIniTemplate(builtinTemplate.content, { nodeList, targetFormat: 'surge&ver=4' });

        expect(loonRendered).toContain('[Proxy]');
        expect(loonRendered).toContain('[Proxy Group]');
        expect(loonRendered).toContain('[Rule]');
        expect(loonRendered).toContain('SG-01 = vless');
        expect(loonRendered).toContain('grpc-service-name=edge');
        expect(loonRendered).toContain('reality=true');
        expect(loonRendered).toContain('WG-01 = wireguard');
        expect(loonRendered).toContain('RULE-SET,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list,🤖 OpenAi');
        expect(loonRendered).toContain('🚀 节点选择 = select');
        expect(quanxRendered).toContain('[server_local]');
        expect(quanxRendered).toContain('[policy]');
        expect(quanxRendered).toContain('[filter_remote]');
        expect(quanxRendered).toContain('[filter_local]');
        expect(quanxRendered).toContain('vmess=1.2.3.6:443, method=auto, password=uuid-5678, tag=🇺🇸 US-01');
        expect(quanxRendered).toContain('filter_remote, https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list, tag=🤖 OpenAi, force-policy=🤖 OpenAi, update-interval=86400, enabled=true');
        expect(quanxRendered).toContain('🚀 节点选择 = select');
        expect(surgeRendered).not.toContain('SG-01 = vless');
        expect(surgeRendered).toContain('WG-01 = wireguard');
        expect(surgeRendered).toContain('RULE-SET,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list,🤖 OpenAi');
        expect(surgeRendered).toContain('🚀 节点选择 = select');
    });

    it('should render Loon vmess and trojan proxies with compatible syntax', () => {
        const loonRendered = renderLoonFromIniTemplate(`
[Proxy]
custom_proxy_group=TestGroup` , {
            nodeList: [
                'vmess://eyJ2IjoiMiIsInBzIjoiVk1FU1MtV1MiLCJhZGQiOiJzYWFzLnNpbi5mYW4iLCJwb3J0IjoiNDQzIiwiaWQiOiIwYTRhMGJhMS1iZjAyLTQyOTgtYmYxNi0xOWExZjg2MzkzZmEiLCJhaWQiOiIwIiwic2N5IjoiYXV0byIsIm5ldCI6IndzIiwidHlwZSI6Im5vbmUiLCJob3N0Ijoia3lqcC5zdG9vLnVzLmNpIiwicGF0aCI6Ii92bWVzcy1hcmdvP2VkPTI1NjAiLCJ0bHMiOiJ0bHMiLCJzbmkiOiJreWpwLnN0b28udXMuY2kiLCJmcCI6ImZpcmVmb3gifQ==',
                'trojan://0a4a0ba1-bf02-4298-bf16-19a1f86393fa@saas.sin.fan:443?security=tls&sni=kyjp.stoo.us.ci&fp=firefox&insecure=0&allowInsecure=0&type=ws&host=kyjp.stoo.us.ci&path=%2Ftrojan-argo%3Fed%3D2560#Trojan-WS'
            ].join('\n'),
            targetFormat: 'loon'
        });

        expect(loonRendered).toContain('VMESS-WS = vmess, saas.sin.fan, 443, auto, "0a4a0ba1-bf02-4298-bf16-19a1f86393fa", 0, over-tls=true, transport=ws, path=/vmess-argo?ed=2560, host=kyjp.stoo.us.ci, sni=kyjp.stoo.us.ci');
        expect(loonRendered).toContain('Trojan-WS = trojan, saas.sin.fan, 443, 0a4a0ba1-bf02-4298-bf16-19a1f86393fa, transport=ws, path=/trojan-argo?ed=2560, host=kyjp.stoo.us.ci, sni=kyjp.stoo.us.ci');
        expect(loonRendered).not.toContain(', tls=true');
        expect(loonRendered).not.toContain('password=0a4a0ba1-bf02-4298-bf16-19a1f86393fa');
    });

    it('should render Loon vless ws with path host and over-tls syntax', () => {
        const loonRendered = renderLoonFromIniTemplate(`
[Proxy]
custom_proxy_group=TestGroup`, {
            nodeList: 'vless://0a4a0ba1-bf02-4298-bf16-19a1f86393fa@saas.sin.fan:443?encryption=none&security=tls&sni=kyjp.stoo.us.ci&fp=firefox&insecure=0&allowInsecure=0&type=ws&host=kyjp.stoo.us.ci&path=%2Fvless-argo%3Fed%3D2560#VLESS-WS',
            targetFormat: 'loon'
        });

        expect(loonRendered).toContain('VLESS-WS = vless, saas.sin.fan, 443, 0a4a0ba1-bf02-4298-bf16-19a1f86393fa, transport=ws, path=/vless-argo?ed=2560, host=kyjp.stoo.us.ci, over-tls=true, sni=kyjp.stoo.us.ci');
        expect(loonRendered).not.toContain(', tls=true');
    });

    it('should render Loon anytls syntax', () => {
        const loonRendered = renderLoonFromIniTemplate(`
[Proxy]
custom_proxy_group=TestGroup`, {
            nodeList: 'anytls://9d6c62f6-e38d-4146-ab3e-d40568555f89@156.239.232.67:443/?sni=xkhkfree.99887766.best&alpn=h2%2Ch3&allowInsecure=1#AnyTLS-HK',
            targetFormat: 'loon'
        });

        expect(loonRendered).toContain('AnyTLS-HK = anytls, 156.239.232.67, 443, 9d6c62f6-e38d-4146-ab3e-d40568555f89, sni=xkhkfree.99887766.best, alpn=h2,h3, skip-cert-verify=true');
    });

    it('should render Surge tuic syntax for sample nodes', () => {
        const surgeRendered = renderSurgeFromIniTemplate(`
[Proxy]
custom_proxy_group=TestGroup`, {
            nodeList: 'tuic://a276f4e4-08b4-4a03-bfe8-f36ef17ad133:a276f4e4-08b4-4a03-bfe8-f36ef17ad133@5.45.102.158:39689?congestion_control=bbr&udp_relay_mode=native&alpn=h3&sni=www.bing.com&allow_insecure=1&allowInsecure=1#TUIC-Surge',
            targetFormat: 'surge&ver=4'
        });

        expect(surgeRendered).toContain('TUIC-Surge = tuic, 5.45.102.158, 39689, token=a276f4e4-08b4-4a03-bfe8-f36ef17ad133:a276f4e4-08b4-4a03-bfe8-f36ef17ad133, sni=www.bing.com, congestion-control=bbr, udp-relay=true, alpn=h3, skip-cert-verify=true');
    });

    it('should skip vless nodes when rendering Surge configs', () => {
        const surgeRendered = renderSurgeFromIniTemplate(`
[Proxy]
custom_proxy_group=TestGroup`, {
            nodeList: 'vless://uuid-9999@1.2.3.7:443?security=reality&type=grpc&serviceName=edge&pbk=testpublickey&sid=abcd&sni=example.com#SG-01',
            targetFormat: 'surge&ver=4'
        });

        expect(surgeRendered).not.toContain('SG-01 = vless');
        expect(surgeRendered).not.toContain('grpc-service-name=edge');
        expect(surgeRendered).not.toContain('reality=true');
    });

    it('should render QuanX hysteria2 tuic and anytls syntax', () => {
        const quanxRendered = renderQuanxFromIniTemplate(`
[Proxy]
custom_proxy_group=TestGroup`, {
            nodeList: [
                'hysteria2://a276f4e4-08b4-4a03-bfe8-f36ef17ad133@5.45.102.158:11416?security=tls&alpn=h3&insecure=1&mport=&sni=www.bing.com#HY2-QX',
                'tuic://a276f4e4-08b4-4a03-bfe8-f36ef17ad133:a276f4e4-08b4-4a03-bfe8-f36ef17ad133@5.45.102.158:39689?congestion_control=bbr&udp_relay_mode=native&alpn=h3&sni=www.bing.com&allow_insecure=1&allowInsecure=1#TUIC-QX',
                'anytls://9d6c62f6-e38d-4146-ab3e-d40568555f89@156.239.232.67:443/?sni=xkhkfree.99887766.best&alpn=h2%2Ch3&allowInsecure=1#AnyTLS-QX'
            ].join('\n'),
            targetFormat: 'quanx'
        });

        expect(quanxRendered).toContain('hysteria2=5.45.102.158:11416, password=a276f4e4-08b4-4a03-bfe8-f36ef17ad133, sni=www.bing.com, tls-verification=false, tag=🌍 HY2-QX');
        expect(quanxRendered).toContain('tuic=5.45.102.158:39689, a276f4e4-08b4-4a03-bfe8-f36ef17ad133, a276f4e4-08b4-4a03-bfe8-f36ef17ad133, sni=www.bing.com, congestion-controller=bbr, udp-relay=native, alpn=h3, tls-verification=false, tag=🌍 TUIC-QX');
        expect(quanxRendered).toContain('anytls=156.239.232.67:443, password=9d6c62f6-e38d-4146-ab3e-d40568555f89, sni=xkhkfree.99887766.best, alpn=h2,h3, tls-verification=false, tag=🌍 AnyTLS-QX');
    });

    it('should render SS2022 v2ray-plugin websocket in non-Clash template targets', () => {
        const template = `
[Proxy]
custom_proxy_group=TestGroup`;
        const surgeRendered = renderSurgeFromIniTemplate(template, { nodeList: SS2022_V2RAY_PLUGIN_NODE, targetFormat: 'surge&ver=4' });
        const loonRendered = renderLoonFromIniTemplate(template, { nodeList: SS2022_V2RAY_PLUGIN_NODE, targetFormat: 'loon' });
        const quanxRendered = renderQuanxFromIniTemplate(template, { nodeList: SS2022_V2RAY_PLUGIN_NODE, targetFormat: 'quanx' });
        const singboxRendered = renderSingboxFromIniTemplate(template, { nodeList: SS2022_V2RAY_PLUGIN_NODE, targetFormat: 'singbox' });
        const singbox = JSON.parse(singboxRendered);
        const ssOutbound = singbox.outbounds.find(outbound => outbound.type === 'shadowsocks');

        expect(surgeRendered).toContain('encrypt-method=2022-blake3-aes-256-gcm');
        expect(surgeRendered).toContain('ws=true');
        expect(surgeRendered).toContain('ws-path=/?enc=2022-blake3-aes-256-gcm');
        expect(surgeRendered).toContain('ws-headers=Host:ss.2227tsj.workers.dev');

        expect(loonRendered).toContain('transport=ws');
        expect(loonRendered).toContain('path=/?enc=2022-blake3-aes-256-gcm');
        expect(loonRendered).toContain('host=ss.2227tsj.workers.dev');

        expect(quanxRendered).toContain('method=2022-blake3-aes-256-gcm');
        expect(quanxRendered).toContain('obfs=ws');
        expect(quanxRendered).toContain('obfs-uri=/?enc=2022-blake3-aes-256-gcm');
        expect(quanxRendered).toContain('obfs-host=ss.2227tsj.workers.dev');

        expect(ssOutbound?.method).toBe('2022-blake3-aes-256-gcm');
        expect(ssOutbound?.transport?.type).toBe('ws');
        expect(ssOutbound?.transport?.path).toBe('/?enc=2022-blake3-aes-256-gcm');
        expect(ssOutbound?.transport?.headers?.Host).toBe('ss.2227tsj.workers.dev');
        expect(ssOutbound?.tls).toBeUndefined();
    });

    it('should convert ACL4SSR list rules into clash yaml providers', () => {
        const builtinTemplate = getBuiltinTemplate('clash_acl4ssr_lite');
        const rendered = renderClashFromIniTemplate(builtinTemplate.content, {
            nodeList: [
                'trojan://password@1.2.3.4:443#HK-01',
                'trojan://password@1.2.3.5:443#JP-01',
                'trojan://password@1.2.3.6:443#US-01'
            ].join('\n'),
            targetFormat: 'clash'
        });

        const parsed = yaml.load(rendered);
        const providers = parsed['rule-providers'] || {};
        const providerUrls = Object.values(providers).map(provider => provider.url);

        expect(providerUrls.length).toBeGreaterThan(0);
        expect(providerUrls.some(url => String(url).includes('/Clash/Providers/Ruleset/YouTube.yaml'))).toBe(true);
        expect(providerUrls.some(url => String(url).includes('/Clash/Providers/ProxyGFWlist.yaml'))).toBe(true);
        expect(providerUrls.every(url => !String(url).endsWith('.list'))).toBe(true);
    });
});
