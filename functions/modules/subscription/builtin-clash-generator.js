/**
 * 内置 Clash 配置生成器
 * 不依赖外部 subconverter，直接将节点 URL 转换为完整 Clash 配置
 * 支持 dialer-proxy、reality-opts 等特殊参数
 */

import { urlsToClashProxies } from '../../utils/url-to-clash.js';
import { getUniqueName } from './name-utils.js';
import { clashFix } from '../../utils/format-utils.js';
import { 
    POLICY_GROUPS, 
    RULE_SETS, 
    getBuiltinRules, 
    getRemoteProviderDefinitions, 
    DEFAULT_SELECT_GROUP, 
    DEFAULT_RELAY_GROUP, 
    pruneProxyGroups 
} from './builtin-rules-provider.js';
import yaml from 'js-yaml';

/**
 * 清理字符串中的控制字符（保留换行和制表符）
 * @param {string} str - 输入字符串
 * @returns {string} 清理后的字符串
 */
function cleanControlChars(str) {
    if (typeof str !== 'string') return str;
    // 移除控制字符，但保留换行(\n)、回车(\r)、制表符(\t)
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * 递归清理对象中所有字符串的控制字符
 * @param {any} obj - 输入对象
 * @returns {any} 清理后的对象
 */
function deepCleanControlChars(obj) {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
        return cleanControlChars(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepCleanControlChars(item));
    }

    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            cleaned[cleanControlChars(key)] = deepCleanControlChars(value);
        }
        return cleaned;
    }

    return obj;
}

/**
 * 处理重名节点，确保每个节点名称唯一
 * @param {Object[]} proxies - 代理对象数组
 */
function deduplicateNames(proxies) {
    const usedNames = new Map();
    proxies.forEach(proxy => {
        proxy.name = getUniqueName(proxy.name, usedNames);
    });
}

/**
 * 生成内置 Clash 配置
 * @param {string} nodeList - 节点列表（换行分隔的 URL）
 * @param {Object} options - 配置选项
 * @returns {string} Clash YAML 配置
 */
export function generateBuiltinClashConfig(nodeList, options = {}) {
    const {
        fileName = 'MiSub',
        enableUdp = true,
        enableTfo = false,
        skipCertVerify = false,
        ruleLevel = 'std' // [New] 支持 base, std, full
    } = options;

    // 解析节点 URL 列表（先清理控制字符）
    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = cleanedNodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    // 转换为 Clash 代理对象
    let proxies = urlsToClashProxies(nodeUrls, options);

    // 清理控制字符
    proxies = deepCleanControlChars(proxies);

    // 应用 UDP 开关：强制设置所有节点的 UDP 参数
    if (enableUdp) {
        proxies.forEach(proxy => {
            proxy.udp = true;
        });
    }

    // 强制跳过证书验证
    if (skipCertVerify) {
        proxies.forEach(proxy => {
            proxy['skip-cert-verify'] = true;
        });
    }

    // 处理重名节点
    deduplicateNames(proxies);

    if (proxies.length === 0) {
        return '# No valid proxies found\nproxies: []\n';
    }

    // 生成 YAML
    try {
        const levelKey = (ruleLevel || 'std').toUpperCase();
        const rawRules = getBuiltinRules(levelKey, 'clash');

        // 生成策略组并执行引用修剪
        const policyGroupsFactory = POLICY_GROUPS[levelKey] || POLICY_GROUPS.STD;
        let proxyGroups = policyGroupsFactory(proxies);
        proxyGroups = pruneProxyGroups(proxyGroups, proxies);
        
        // 提取远程 Provider 定义
        const ruleProviders = getRemoteProviderDefinitions('clash', rawRules);
        
        // 转换规则行为最终字符串
        const clashRules = rawRules.map(r => {
            if (typeof r === 'string') return r;
            if (r.type === 'rule-provider') return `RULE-SET,${r.provider},${r.target}`;
            return null;
        }).filter(Boolean);

        // 基础配置
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

            'proxies': proxies,
            'profile': {
                'store-selected': true,
                'subscription-url': options.managedConfigUrl || ''
            },

            'proxy-groups': proxyGroups,
            'rule-providers': ruleProviders,
            'rules': clashRules
        };

        let yamlStr = yaml.dump(config, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            quotingType: '"',
            forceQuotes: false
        });

        // 应用 WireGuard 修复
        yamlStr = clashFix(yamlStr);

        // 最终清理，确保输出没有控制字符
        return cleanControlChars(yamlStr);
    } catch (e) {
        console.error('[BuiltinClash] Generation failed:', e);
        // Fallback: 至少返回包含节点的有效 YAML 结构，而不是传回会导致 Clash 报错的 Base64
        const fallbackProxies = Array.isArray(proxies) ? proxies : [];
        const selectGroup = (ruleLevel || '').toUpperCase() === 'RELAY' ? DEFAULT_RELAY_GROUP : DEFAULT_SELECT_GROUP;
        const fallbackYaml = `proxies:\n${fallbackProxies.map(p => `  - ${JSON.stringify(p)}`).join('\n')}\n` +
                             `proxy-groups:\n  - name: ${selectGroup}\n    type: select\n    proxies: ${JSON.stringify(fallbackProxies.map(p => p.name))}\n` +
                             `rules:\n  - MATCH,${selectGroup}\n`;
        return fallbackYaml;
    }
}

/**
 * 仅生成代理列表（不包含完整配置）
 * @param {string} nodeList - 节点列表
 * @returns {string} 仅包含 proxies 部分的 YAML
 */
export function generateProxiesOnly(nodeList) {
    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = cleanedNodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    let proxies = urlsToClashProxies(nodeUrls);

    // 清理控制字符
    proxies = deepCleanControlChars(proxies);

    // 处理重名节点
    deduplicateNames(proxies);

    try {
        let yamlStr = yaml.dump({ proxies }, {
            indent: 2,
            lineWidth: -1,
            noRefs: true
        });

        // 应用 WireGuard 修复
        yamlStr = clashFix(yamlStr);

        return cleanControlChars(yamlStr);
    } catch (e) {
        return `proxies:\n${proxies.map(p => `  - ${JSON.stringify(p)}`).join('\n')}\n`;
    }
}
