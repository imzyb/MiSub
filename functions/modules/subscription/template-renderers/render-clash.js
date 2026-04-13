import yaml from 'js-yaml';
import { clashFix } from '../../../utils/format-utils.js';
import { normalizeUnifiedTemplateModel } from '../template-model.js';

function mapGroupType(type) {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized === 'url-test' || normalized === 'fallback' || normalized === 'load-balance' || normalized === 'relay' || normalized === 'select') {
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
    
    // 生成 Rule Providers
    const ruleProviders = {};
    const ruleProviderMap = new Map();
    let providerCounter = 0;

    normalizedModel.rules.forEach(rule => {
        const type = String(rule.type || '').toUpperCase();
        if (type === 'RULE-SET' && rule.value && /^https?:\/\//i.test(rule.value)) {
            if (!ruleProviderMap.has(rule.value)) {
                // 生成一个可读性较好的名称，尝试从 URL 获取文件名
                let nameHint = 'rs';
                try {
                    const urlPath = new URL(rule.value).pathname;
                    const fileName = urlPath.split('/').pop()?.replace(/\.(yaml|yml|list|txt|conf)$/i, '') || '';
                    if (fileName && fileName.length > 2) {
                        nameHint = fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    }
                } catch (e) { /* ignore */ }
                
                const providerName = `${nameHint}_${providerCounter++}`;
                ruleProviderMap.set(rule.value, providerName);
                
                ruleProviders[providerName] = {
                    type: 'http',
                    behavior: 'classical',
                    url: rule.value,
                    path: `./ruleset/${providerName}.yaml`,
                    interval: 86400
                };
            }
        }
    });

    const config = {
        'mixed-port': 7890,
        'allow-lan': true,
        'mode': 'rule',
        'log-level': 'info',
        'external-controller': ':9090',
        'proxies': normalizedModel.proxies,
        'proxy-groups': normalizedModel.groups
            .filter(group => Array.isArray(group.members) && group.members.length > 0)
            .map(group => ({
                name: group.name,
                type: mapGroupType(group.type),
                proxies: filterAutoSelectMembers(group),
                filter: Array.isArray(group.filters) && group.filters.length > 0 ? group.filters.join('|') : undefined,
                ...group.options
            })),
        'rule-providers': Object.keys(ruleProviders).length > 0 ? ruleProviders : undefined,
        'rules': normalizedModel.rules.map(r => mapRule(r, ruleProviderMap)).filter(Boolean),
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
