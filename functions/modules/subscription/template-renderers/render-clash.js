import yaml from 'js-yaml';
import { clashFix } from '../../../utils/format-utils.js';
import { normalizeUnifiedTemplateModel } from '../template-model.js';
import { DNS_PROXY_GROUP, resolveSafeDnsConfig } from '../safe-dns.js';
import { applyMihomoChainProxy } from '../mihomo-chain-proxy.js';

function mapGroupType(type) {
    const normalized = String(type || '')
        .trim()
        .toLowerCase();
    if (
        normalized === 'url-test' ||
        normalized === 'fallback' ||
        normalized === 'load-balance' ||
        normalized === 'select'
    ) {
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
    return members.filter(
        (member) =>
            !['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'].includes(String(member).toUpperCase())
    );
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
    'unban',
]);

const ACL4SSR_IPCIDR_PROVIDER_FILES = new Set([
    'amazonip',
    'chinacompanyip',
    'chinaip',
    'chinaipv6',
    'netflixip',
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
    'unban',
]);

function toClashRuleProviderUrl(sourceUrl) {
    if (!/^https?:\/\//i.test(String(sourceUrl || ''))) return sourceUrl;

    try {
        const url = new URL(sourceUrl);
        // 兼容已被 CDN 镜像重写过的地址（cdn.jsdelivr.net/gh/OWNER/REPO@REF/PATH）。
        // 若只认 raw.githubusercontent.com，镜像后的链接会跳过 .list -> .yaml 映射，
        // 导致规则源指向不存在的 provider 文件。
        const mirrorMatch =
            url.hostname === 'cdn.jsdelivr.net'
                ? url.pathname.match(/^\/gh\/([^/@]+)\/([^/@]+)@([^/]+)\/(.+)$/)
                : null;
        const pathParts = mirrorMatch
            ? [mirrorMatch[1], mirrorMatch[2], mirrorMatch[3], ...mirrorMatch[4].split('/')]
            : url.pathname.split('/').filter(Boolean);

        const isGithubRaw = /raw\.githubusercontent\.com$/i.test(url.hostname);
        if (!isGithubRaw && !mirrorMatch) return sourceUrl;

        const owner = pathParts[0] || '';
        const repo = pathParts[1] || '';
        if (owner.toLowerCase() !== 'acl4ssr' || repo.toLowerCase() !== 'acl4ssr') return sourceUrl;

        // 统一以「仓库内路径」为基准判断与改写，避免镜像前缀干扰
        const repoPath = '/' + pathParts.slice(3).join('/');
        if (!/\/Clash\/.*\.(list|txt)$/i.test(repoPath)) return sourceUrl;

        const fileName =
            repoPath
                .split('/')
                .pop()
                ?.replace(/\.(list|txt)$/i, '') || '';
        if (
            /\/Clash\/[^/]+\.(list|txt)$/i.test(repoPath) &&
            ACL4SSR_ROOT_LIST_ONLY_FILES.has(fileName.toLowerCase())
        ) {
            return sourceUrl;
        }

        let newPath;
        if (/\/Clash\/Ruleset\//i.test(repoPath)) {
            newPath = repoPath
                .replace(/\/Clash\/Ruleset\//i, '/Clash/Providers/Ruleset/')
                .replace(/\.(list|txt)$/i, '.yaml');
        } else if (ACL4SSR_ROOT_PROVIDER_FILES.has(fileName.toLowerCase())) {
            newPath = repoPath
                .replace(/\/Clash\//i, '/Clash/Providers/')
                .replace(/\.(list|txt)$/i, '.yaml');
        } else {
            newPath = repoPath
                .replace(/\/Clash\//i, '/Clash/Providers/Ruleset/')
                .replace(/\.(list|txt)$/i, '.yaml');
        }

        if (mirrorMatch) {
            return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${mirrorMatch[3]}${newPath}`;
        }
        return `https://raw.githubusercontent.com/${owner}/${repo}/${pathParts[2]}${newPath}`;
    } catch {
        return sourceUrl;
    }
}

function isMrsProviderUrl(providerUrl) {
    try {
        return /\.mrs$/i.test(new URL(providerUrl).pathname);
    } catch {
        return false;
    }
}

function getRuleProviderBehavior(providerUrl) {
    try {
        const pathname = new URL(providerUrl).pathname;
        // Mihomo 的 mrs 仅支持 domain / ipcidr，配 classical 会在运行期报
        // ErrInvalidFormat，因此按规则来源路径推断：geoip 走 ipcidr，其余走 domain。
        if (/\.mrs$/i.test(pathname)) {
            return /\/geoip\//i.test(pathname) ? 'ipcidr' : 'domain';
        }
        const fileName =
            pathname
                .split('/')
                .pop()
                ?.replace(/\.(yaml|yml|list|txt|conf)$/i, '') || '';
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

    // 所有客户端都保留链式策略组；仅 Mihomo/Meta 展开节点级 dialer-proxy。
    if (Array.isArray(normalizedModel.extras?.chainProxy)) {
        applyMihomoChainProxy(normalizedModel, {
            enableDialerProxy: Boolean(normalizedModel.meta?.isMeta),
        });
    }

    const ruleProviders = {};
    const ruleProviderMap = new Map();
    let providerCounter = 0;

    normalizedModel.rules.forEach((rule) => {
        const type = String(rule.type || '').toUpperCase();
        if (type !== 'RULE-SET' || !rule.value || !/^https?:\/\//i.test(rule.value)) return;

        const providerUrl = toClashRuleProviderUrl(rule.value);
        if (ruleProviderMap.has(providerUrl)) return;

        let nameHint = 'rs';
        try {
            const urlPath = new URL(providerUrl).pathname;
            const fileName =
                urlPath
                    .split('/')
                    .pop()
                    ?.replace(/\.(yaml|yml|list|txt|conf|mrs)$/i, '') || '';
            if (fileName) {
                nameHint = fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            }
        } catch {
            // ignore invalid provider url shapes and keep fallback name
        }

        const providerName = `${nameHint}_${providerCounter++}`;
        ruleProviderMap.set(providerUrl, providerName);
        const usesTextList = /\.(list|txt)$/i.test(providerUrl);
        const usesMrs = isMrsProviderUrl(providerUrl);
        ruleProviders[providerName] = {
            type: 'http',
            behavior: getRuleProviderBehavior(providerUrl),
            url: providerUrl,
            path: `./ruleset/${providerName}.${usesTextList ? 'list' : usesMrs ? 'mrs' : 'yaml'}`,
            interval: 86400,
            ...(usesTextList ? { format: 'text' } : {}),
            ...(usesMrs ? { format: 'mrs' } : {}),
        };
    });

    const config = {
        'mixed-port': 7890,
        'allow-lan': false,
        'bind-address': '127.0.0.1',
        ipv6: false,
        mode: 'rule',
        'log-level': 'info',
        'external-controller': '127.0.0.1:9090',
        dns: resolveSafeDnsConfig(normalizedModel.settings?.customDnsOverride, {
            mode: normalizedModel.settings?.dnsMode,
            proxyGroup: DNS_PROXY_GROUP,
        }),
        proxies: normalizedModel.proxies,
        'proxy-groups': normalizedModel.groups
            .filter(
                (group) =>
                    (Array.isArray(group.members) && group.members.length > 0) ||
                    (Array.isArray(group.filters) && group.filters.length > 0)
            )
            .map((group) => {
                return {
                    name: group.name,
                    type: mapGroupType(group.type),
                    proxies: filterAutoSelectMembers(group),
                    filter:
                        Array.isArray(group.filters) && group.filters.length > 0
                            ? group.filters.join('|')
                            : undefined,
                    ...group.options,
                };
            }),
        'rule-providers': Object.keys(ruleProviders).length > 0 ? ruleProviders : undefined,
        rules: normalizedModel.rules
            .map((rule) => {
                if (String(rule.type || '').toUpperCase() !== 'RULE-SET' || !rule.value) {
                    return mapRule(rule, ruleProviderMap);
                }
                return mapRule(
                    { ...rule, value: toClashRuleProviderUrl(rule.value) },
                    ruleProviderMap
                );
            })
            .filter(Boolean),
        profile: {
            'store-selected': true,
            'subscription-url': normalizedModel.settings.managedConfigUrl || '',
        },
    };

    let yamlStr = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
    });
    yamlStr = clashFix(yamlStr);
    return yamlStr;
}
