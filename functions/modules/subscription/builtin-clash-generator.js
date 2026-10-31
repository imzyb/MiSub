/**
 * 内置 Clash 配置生成器
 * 不依赖外部 subconverter，直接将节点 URL 转换为完整 Clash 配置
 * 支持 dialer-proxy、reality-opts 等特殊参数
 */

import { urlsToClashProxies } from '../../utils/url-to-clash.js';
import { getUniqueName } from './name-utils.js';
import { isMetaCore } from './user-agent-utils.js';
import { DNS_PROXY_GROUP, resolveSafeDnsConfig } from './safe-dns.js';
import {
    POLICY_GROUPS,
    RULE_SETS,
    getBuiltinRules,
    getRemoteProviderDefinitions,
    DEFAULT_SELECT_GROUP,
    DEFAULT_RELAY_GROUP,
    pruneProxyGroups,
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
        return obj.map((item) => deepCleanControlChars(item));
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
    proxies.forEach((proxy) => {
        proxy.name = getUniqueName(proxy.name, usedNames);
    });
}

/**
 * 移除仅供内部分组使用、不能输出到 Clash/Mihomo 配置的字段。
 * @param {Object[]} proxies
 * @returns {Object[]}
 */
function stripInternalProxyFields(proxies) {
    return proxies.map((proxy) => {
        const { metadata, ...publicProxy } = proxy;
        return publicProxy;
    });
}

/**
 * 为 Mihomo/Meta 生成链式代理节点。
 * 当前 Meta 内核不再支持 relay 策略组语义，应通过 dialer-proxy 让落地节点经由入口节点拨号。
 * @param {Object[]} proxies 原始代理对象（保留内部 metadata）
 * @param {Object[]} publicProxies 输出用代理对象（不含内部字段）
 * @param {Object[]} proxyGroups 策略组定义
 * @returns {{proxies: Object[], proxyGroups: Object[]}}
 */
function applyMihomoRelayDialerProxy(proxies, publicProxies, proxyGroups) {
    const relayGroup = proxyGroups.find((group) => group.name === '🔗 链式代理');
    if (!relayGroup) {
        return { proxies: publicProxies, proxyGroups };
    }

    const chainProxies = publicProxies.map((proxy) => ({
        ...proxy,
        name: `🔗 链式代理 - ${proxy.name}`,
        'dialer-proxy': '入口节点',
    }));
    const chainNames = chainProxies.map((proxy) => proxy.name);

    const nextProxyGroups = proxyGroups
        .map((group) => {
            if (group.name === '🔗 链式代理') {
                return {
                    ...group,
                    // Meta/Mihomo 不再使用 relay group。保持上一版可用结构：
                    // “链式代理”直接选择带 dialer-proxy 的落地副本；同时隐藏“落地节点”分组，避免多一层选择造成误解。
                    type: 'select',
                    proxies: chainNames,
                };
            }
            if (group.name === '落地节点') {
                return null;
            }
            return group;
        })
        .filter(Boolean);

    return {
        proxies: [...publicProxies, ...chainProxies],
        proxyGroups: pruneProxyGroups(nextProxyGroups, [...proxies, ...chainProxies]),
    };
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
        ruleLevel = 'std', // [New] 支持 base, std, full
        userAgent = '',
        hiddifyCompatible = false,
    } = options;
    const enableMihomoSyntax =
        Boolean(options.isMeta) || isMetaCore(userAgent, options.searchParams);
    const isHiddifyClient = hiddifyCompatible || /hiddify/i.test(userAgent || '');
    // Stash 通过 #SUBSCRIBED <url> 注释行识别订阅地址以支持自动更新
    const isStashClient = /stash/i.test(userAgent || '');

    // 解析节点 URL 列表（先清理控制字符）。
    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = String(cleanedNodeList || '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));

    // URL 输入继续走既有转换逻辑。
    let proxies = urlsToClashProxies(nodeUrls, options);

    // 清理控制字符
    proxies = deepCleanControlChars(proxies);

    // 强制跳过证书验证
    // (已在 urlsToClashProxies 中全局处理)

    // 处理重名节点
    deduplicateNames(proxies);

    if (proxies.length === 0) {
        return '# No valid proxies found\nproxies: []\n';
    }

    // 生成 YAML
    try {
        const levelKey = (ruleLevel || 'std').toUpperCase();
        const rawRules = isHiddifyClient
            ? ['MATCH,🚀 节点选择']
            : getBuiltinRules(levelKey, 'clash');

        // 生成策略组并执行引用修剪
        const policyGroupsFactory = POLICY_GROUPS[levelKey] || POLICY_GROUPS.STD;
        let proxyGroups = policyGroupsFactory(proxies, options);
        proxyGroups = pruneProxyGroups(proxyGroups, proxies);

        // 提取远程 Provider 定义。Hiddify 4.x 的 Clash 转 sing-box 解析对 rule-providers 兼容性较差，
        // 自动识别为 Hiddify 时降级为纯 MATCH 规则，避免导入时报 unable to determine config format。
        const ruleProviders = isHiddifyClient
            ? {}
            : getRemoteProviderDefinitions('clash', rawRules);

        // 转换规则行为最终字符串
        const clashRules = rawRules
            .map((r) => {
                if (typeof r === 'string') return r;
                if (r.type === 'rule-provider') return `RULE-SET,${r.provider},${r.target}`;
                return null;
            })
            .filter(Boolean);

        let publicProxies = stripInternalProxyFields(proxies);
        if (levelKey === 'RELAY' && enableMihomoSyntax) {
            const relayConfig = applyMihomoRelayDialerProxy(proxies, publicProxies, proxyGroups);
            publicProxies = relayConfig.proxies;
            proxyGroups = relayConfig.proxyGroups;
        }

        if (options.customDnsOverride && String(options.customDnsOverride).trim()) {
            const hasDnsExit = String(options.customDnsOverride).includes(DNS_PROXY_GROUP);
            if (!hasDnsExit) {
                proxyGroups = proxyGroups.filter((g) => g.name !== DNS_PROXY_GROUP);
            }
        }

        // 基础配置：安全默认值，不再依赖 KV 覆盖才能避免 DNS 递归。
        const dnsConfig = resolveSafeDnsConfig(options.customDnsOverride || '', {
            mode: options.dnsMode,
            proxyGroup: DNS_PROXY_GROUP,
            subscriptionDnsPolicies: options.subscriptionDnsPolicies || [],
        });

        const config = {
            'mixed-port': 7890,
            'allow-lan': false,
            'bind-address': '127.0.0.1',
            ipv6: false,
            mode: 'rule',
            'log-level': 'info',
            'external-controller': '127.0.0.1:9090',

            dns: dnsConfig,

            proxies: publicProxies,
            profile: {
                'store-selected': true,
                'subscription-url': options.managedConfigUrl || '',
            },

            'proxy-groups': proxyGroups,
            ...(Object.keys(ruleProviders).length ? { 'rule-providers': ruleProviders } : {}),
            rules: clashRules,
        };

        let yamlStr = yaml.dump(config, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            quotingType: '"',
            forceQuotes: false,
        });

        // Stash 首行输出 #SUBSCRIBED <订阅 URL> 以启用订阅自动更新
        if (isStashClient && options.managedConfigUrl && String(options.managedConfigUrl).trim()) {
            yamlStr = `#SUBSCRIBED ${options.managedConfigUrl}\n${yamlStr}`;
        }

        // 最终清理，确保输出没有控制字符
        return cleanControlChars(yamlStr);
    } catch (e) {
        console.error('[BuiltinClash] Generation failed:', e);
        // Fallback: 至少返回包含节点的有效 YAML 结构，而不是传回会导致 Clash 报错的 Base64
        const fallbackProxies = Array.isArray(proxies) ? stripInternalProxyFields(proxies) : [];
        const selectGroup =
            (ruleLevel || '').toUpperCase() === 'RELAY'
                ? DEFAULT_RELAY_GROUP
                : DEFAULT_SELECT_GROUP;
        const fallbackYaml =
            `proxies:\n${fallbackProxies.map((p) => `  - ${JSON.stringify(p)}`).join('\n')}\n` +
            `proxy-groups:\n  - name: ${selectGroup}\n    type: select\n    proxies: ${JSON.stringify(fallbackProxies.map((p) => p.name))}\n` +
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
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));

    let proxies = urlsToClashProxies(nodeUrls);

    // 清理控制字符
    proxies = deepCleanControlChars(proxies);

    // 处理重名节点
    deduplicateNames(proxies);

    try {
        const publicProxies = stripInternalProxyFields(proxies);
        let yamlStr = yaml.dump(
            { proxies: publicProxies },
            {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
            }
        );

        return cleanControlChars(yamlStr);
    } catch (e) {
        const fallbackProxies = Array.isArray(proxies) ? stripInternalProxyFields(proxies) : [];
        return `proxies:\n${fallbackProxies.map((p) => `  - ${JSON.stringify(p)}`).join('\n')}\n`;
    }
}
