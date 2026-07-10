import yaml from 'js-yaml';
import { clashFix } from '../../../utils/format-utils.js';
import { normalizeUnifiedTemplateModel } from '../template-model.js';

function mapGroupType(type) {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized === 'url-test' || normalized === 'fallback' || normalized === 'load-balance' || normalized === 'select') {
        return normalized;
    }
    return 'select';
}

function filterAutoSelectMembers(group) {
    const type = mapGroupType(group.type);
    const members = Array.isArray(group.members) ? group.members.filter(Boolean) : [];
    if (!['url-test', 'fallback', 'load-balance'].includes(type)) {
        return members;
    }
    return members.filter(member => !['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'].includes(String(member).toUpperCase()));
}

const ACL4SSR_ROOT_PROVIDER_FILES = new Set([
    'apple',
    'banad',
    'baneasylist',
    'baneasylistchina',
    'baneasyprivacy',
    'banprogramad',
    'chinacompanyip',
    'chinadomain',
    'chinaip',
    'chinaipv6',
    'chinamedia',
    'download',
    'localareanetwork',
    'mjj',
    'proxylite',
    'proxygfwlist',
    'proxymedia',
    'unban'
]);

const ACL4SSR_IPCIDR_PROVIDER_FILES = new Set([
    'amazonip',
    'chinacompanyip',
    'chinaip',
    'chinaipv6',
    'netflixip'
]);

// ACL4SSR root list files that should stay as text providers because their YAML provider is missing
// or does not preserve the effective raw .list rule coverage.
const ACL4SSR_ROOT_LIST_ONLY_FILES = new Set([
    'localareanetwork',
    'banad',
    'banprogramad',
    'chinamedia',
    'proxymedia',
    'chinadomain',
    'download',
    'unban'
]);

function toClashRuleProviderUrl(sourceUrl) {
    if (!/^https?:\/\//i.test(String(sourceUrl || ''))) return sourceUrl;

    try {
        const url = new URL(sourceUrl);
        if (!/raw\.githubusercontent\.com$/i.test(url.hostname)) return sourceUrl;
        const pathParts = url.pathname.split('/').filter(Boolean);
        const owner = pathParts[0] || '';
        const repo = pathParts[1] || '';
        if (owner.toLowerCase() !== 'acl4ssr' || repo.toLowerCase() !== 'acl4ssr') return sourceUrl;
        if (!/\/Clash\/.*\.(list|txt)$/i.test(url.pathname)) return sourceUrl;

        const fileName = url.pathname.split('/').pop()?.replace(/\.(list|txt)$/i, '') || '';
        if (/\/Clash\/[^/]+\.(list|txt)$/i.test(url.pathname) && ACL4SSR_ROOT_LIST_ONLY_FILES.has(fileName.toLowerCase())) {
            return sourceUrl;
        }

        if (/\/Clash\/Ruleset\//i.test(url.pathname)) {
            url.pathname = url.pathname
                .replace(/\/Clash\/Ruleset\//i, '/Clash/Providers/Ruleset/')
                .replace(/\.(list|txt)$/i, '.yaml');
        } else if (ACL4SSR_ROOT_PROVIDER_FILES.has(fileName.toLowerCase())) {
            url.pathname = url.pathname
                .replace(/\/Clash\//i, '/Clash/Providers/')
                .replace(/\.(list|txt)$/i, '.yaml');
        } else {
            url.pathname = url.pathname
                .replace(/\/Clash\//i, '/Clash/Providers/Ruleset/')
                .replace(/\.(list|txt)$/i, '.yaml');
        }

        return url.toString();
    } catch {
        return sourceUrl;
    }
}

function getRuleProviderBehavior(providerUrl) {
    try {
        const fileName = new URL(providerUrl).pathname.split('/').pop()?.replace(/\.(yaml|yml|list|txt|conf)$/i, '') || '';
        if (ACL4SSR_IPCIDR_PROVIDER_FILES.has(fileName.toLowerCase())) return 'ipcidr';
    } catch {
        // ignore invalid provider url shapes and keep default behavior
    }
    return 'classical';
}

function mapRule(rule, ruleProviderMap) {
    const type = String(rule.type || '').toUpperCase();
    if (!type) return null;
    if (type === 'MATCH' || type === 'FINAL') return `MATCH,${rule.policy}`;
    if (type === 'GEOIP') return `GEOIP,${rule.value || 'CN'},${rule.policy}`;
    if (type === 'RULE-SET') {
        const providerName = ruleProviderMap.get(rule.value);
        return `RULE-SET,${providerName || rule.value},${rule.policy}`;
    }
    return `${type},${rule.value},${rule.policy}`;
}

export function renderClashFromTemplateModel(model) {
    const normalizedModel = normalizeUnifiedTemplateModel(model);

    const ruleProviders = {};
    const ruleProviderMap = new Map();
    let providerCounter = 0;

    normalizedModel.rules.forEach(rule => {
        const type = String(rule.type || '').toUpperCase();
        if (type !== 'RULE-SET' || !rule.value || !/^https?:\/\//i.test(rule.value)) return;

        const providerUrl = toClashRuleProviderUrl(rule.value);
        if (ruleProviderMap.has(providerUrl)) return;

        let nameHint = 'rs';
        try {
            const urlPath = new URL(providerUrl).pathname;
            const fileName = urlPath.split('/').pop()?.replace(/\.(yaml|yml|list|txt|conf)$/i, '') || '';
            if (fileName) {
                nameHint = fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            }
        } catch {
            // ignore invalid provider url shapes and keep fallback name
        }

        const providerName = `${nameHint}_${providerCounter++}`;
        ruleProviderMap.set(providerUrl, providerName);
        const usesTextList = /\.(list|txt)$/i.test(providerUrl);
        ruleProviders[providerName] = {
            type: 'http',
            behavior: getRuleProviderBehavior(providerUrl),
            url: providerUrl,
            path: `./ruleset/${providerName}.${usesTextList ? 'list' : 'yaml'}`,
            interval: 86400,
            ...(usesTextList ? { format: 'text' } : {})
        };
    });

    const config = {
        'mixed-port': 7890,
        'allow-lan': true,
        'mode': 'rule',
        'log-level': 'info',
        'external-controller': ':9090',
        'dns': {
            'enable': true,
            'listen': '0.0.0.0:1053',
            'default-nameserver': ['223.5.5.5', '1.1.1.1'],
            'enhanced-mode': 'fake-ip',
            'fake-ip-range': '198.18.0.1/16',
            'fake-ip-filter': ['*.lan', '*.localhost'],
            'nameserver': [
                'https://dns.alidns.com/dns-query',
                'https://doh.pub/dns-query'
            ]
        },
        'proxies': normalizedModel.proxies,
        'proxy-groups': normalizedModel.groups
            .filter(group =>
                (Array.isArray(group.members) && group.members.length > 0) ||
                (Array.isArray(group.filters) && group.filters.length > 0)
            )
            .map(group => {
                return {
                    name: group.name,
                    type: mapGroupType(group.type),
                    proxies: filterAutoSelectMembers(group),
                    filter: Array.isArray(group.filters) && group.filters.length > 0 ? group.filters.join('|') : undefined,
                    ...group.options
                };
            }),
        'rule-providers': Object.keys(ruleProviders).length > 0 ? ruleProviders : undefined,
        'rules': normalizedModel.rules.map(rule => {
            if (String(rule.type || '').toUpperCase() !== 'RULE-SET' || !rule.value) {
                return mapRule(rule, ruleProviderMap);
            }
            return mapRule({ ...rule, value: toClashRuleProviderUrl(rule.value) }, ruleProviderMap);
        }).filter(Boolean),
        'profile': {
            'store-selected': true,
            'subscription-url': normalizedModel.settings.managedConfigUrl || ''
        }
    };

    let yamlStr = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false
    });
    yamlStr = clashFix(yamlStr);
    return yamlStr;
}
