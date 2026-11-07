import yaml from 'js-yaml';
import { pathToFileURL } from 'node:url';
import { PINNED_RULE_REVISIONS } from '../functions/modules/subscription/builtin-rules-provider.js';
import { DNS_PROXY_GROUP, SINGBOX_CN_RULE_SET } from '../functions/modules/subscription/safe-dns.js';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function array(value) {
    return Array.isArray(value) ? value : [];
}

function isLoopbackHost(value) {
    const host = String(value || '').trim().replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1' || host === '::' || host === '0.0.0.0' || host.startsWith('127.');
}

function assertNoLoopbackNodes(nodes, label) {
    for (const node of array(nodes)) {
        if (node?.server && isLoopbackHost(node.server)) {
            throw new Error(`${label} contains loopback proxy endpoint`);
        }
    }
}

// 国内 DNS 必须直连（不能挂策略组）。实测 sing-box 1.14.4 拒绝 detour 指向空的 direct 出站，
// 生成器因此省略 detour 字段；语义与 `detour: DIRECT` 相同，两种写法都接受。
function isDirectDetour(server) {
    return server?.detour === undefined || server.detour === 'DIRECT';
}

function assertDnsMode(values, mode, label) {
    const servers = array(values);
    assert(servers.length > 0, `${label} has no DNS servers`);
    if (mode === 'clean') {
        assert(servers.every(server => /^udp:\/\//i.test(String(server))), `${label} clean mode is not plaintext UDP`);
        assert(servers.every(server => !/^https?:\/\//i.test(String(server))), `${label} clean mode contains encrypted DNS`);
    } else {
        assert(servers.every(server => /^(?:https|tls):\/\//i.test(String(server))), `${label} polluted mode is not encrypted DNS`);
        assert(servers.every(server => String(server).endsWith(`#${DNS_PROXY_GROUP}`)), `${label} polluted DNS is not proxied`);
    }
}

export function validateClashConfig(config, mode) {
    assert(config && typeof config === 'object', 'Clash output is not an object');
    assert(config.ipv6 === false, 'Clash IPv6 is enabled');
    assert(config['allow-lan'] === false, 'Clash LAN access is enabled');
    assert(config['bind-address'] === '127.0.0.1', 'Clash bind address is not loopback-only');
    assert(config['external-controller'] === '127.0.0.1:9090', 'Clash controller is not loopback-only');

    const dns = config.dns || {};
    assert(dns['enhanced-mode'] === 'fake-ip', 'Clash fake-ip mode is missing');
    assert(dns['respect-rules'] === true, 'Clash DNS respect-rules is disabled');
    assertDnsMode(dns.nameserver, mode, 'Clash DNS');
    if (mode === 'clean') assert(array(dns.fallback).length === 0, 'Clash clean mode has fallback DNS');
    assert(array(dns['nameserver-policy']?.['geosite:cn']).length > 0, 'Clash geosite:cn DNS policy is missing');

    assertNoLoopbackNodes(config.proxies, 'Clash');
    const aiGroups = array(config['proxy-groups']).filter(group => String(group?.name || '').startsWith('🤖'));
    assert(aiGroups.length > 0, 'Clash AI groups are missing');
    assert(aiGroups.every(group => !array(group.proxies).includes('DIRECT')), 'Clash AI group allows DIRECT');
    return true;
}

export function validateSingboxConfig(config, mode) {
    assert(config && typeof config === 'object', 'sing-box output is not an object');
    const tun = array(config.inbounds).find(inbound => inbound?.type === 'tun');
    assert(tun, 'sing-box TUN inbound is missing');
    assert(tun.auto_route === true && tun.strict_route === true && tun.stack === 'mixed', 'sing-box TUN route hardening is incomplete');
    assert(array(tun.address).includes('172.19.0.1/30'), 'sing-box TUN address is unexpected');
    assert(config.route?.auto_detect_interface === true, 'sing-box auto interface detection is disabled');

    const dns = config.dns || {};
    assert(dns.strategy === 'prefer_ipv4', 'sing-box DNS strategy is not prefer_ipv4');
    assert(array(dns.rules).some(rule => array(rule.rule_set).includes(SINGBOX_CN_RULE_SET) && rule.server === 'dns-cn-1'), 'sing-box geosite-cn DNS route is missing');
    const cnRuleSet = array(config.route?.rule_set).find(ruleSet => ruleSet?.tag === SINGBOX_CN_RULE_SET);
    assert(cnRuleSet?.type === 'remote' && cnRuleSet.format === 'binary', 'sing-box geosite-cn rule-set definition is missing');
    assert(String(cnRuleSet.url || '').includes(PINNED_RULE_REVISIONS.SING_GEOSITE), 'sing-box geosite-cn rule-set is not SHA-pinned');

    const domestic = array(dns.servers).filter(server => String(server?.tag || '').startsWith('dns-cn-'));
    const foreign = array(dns.servers).filter(server => String(server?.tag || '').startsWith('dns-foreign-'));
    assert(domestic.length > 0 && domestic.every(server => server.type === 'udp' && isDirectDetour(server)), 'sing-box domestic DNS path is not direct plaintext');
    assertDnsMode(foreign.map(server => `${server.type}://${server.server}${server.detour === DNS_PROXY_GROUP ? `#${DNS_PROXY_GROUP}` : ''}`), mode, 'sing-box foreign DNS');
    assert(foreign.every(server => server.detour === DNS_PROXY_GROUP), 'sing-box foreign DNS is not proxied');

    assertNoLoopbackNodes(array(config.outbounds).filter(outbound => outbound?.server), 'sing-box');
    const aiGroups = array(config.outbounds).filter(outbound => String(outbound?.tag || '').startsWith('🤖'));
    assert(aiGroups.length > 0, 'sing-box AI groups are missing');
    assert(aiGroups.every(group => !array(group.outbounds).includes('DIRECT')), 'sing-box AI group allows DIRECT');
    return true;
}

async function fetchConfig(baseUrl, params) {
    const url = new URL(baseUrl);
    url.searchParams.delete('clash');
    url.searchParams.delete('singbox');
    url.searchParams.delete('dns-mode');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        try {
            const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
            const body = await response.text();
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return body;
        } catch (error) {
            lastError = error;
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        } finally {
            clearTimeout(timeout);
        }
    }
    throw lastError || new Error('request failed');
}

export async function runSmoke(baseUrl) {
    assert(baseUrl, 'MISUB_SMOKE_URL is not set');
    for (const mode of ['clean', 'polluted']) {
        const suffix = mode === 'clean' ? {} : { 'dns-mode': 'polluted' };
        const clash = yaml.load(await fetchConfig(baseUrl, { clash: '3', extend: '1', ...suffix }));
        validateClashConfig(clash, mode);
        console.log(`smoke: Clash ${mode} passed`);

        const singbox = JSON.parse(await fetchConfig(baseUrl, { singbox: '1', extend: '1', ...suffix }));
        validateSingboxConfig(singbox, mode);
        console.log(`smoke: sing-box ${mode} passed`);
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    runSmoke(process.env.MISUB_SMOKE_URL?.trim()).catch(error => {
        console.error(`subscription smoke failed: ${error.message}`);
        process.exitCode = 1;
    });
}
