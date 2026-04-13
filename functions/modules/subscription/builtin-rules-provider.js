import { groupNodeLinesByRegion } from './region-groups.js';

/**
 * 策略组标准名称常量
 */
export const DEFAULT_SELECT_GROUP = '🚀 节点选择';
export const DEFAULT_RELAY_GROUP = '🌍 总出口';
export const AUTO_SELECT_GROUP = '♻️ 自动选择';
export const FALLBACK_GROUP = '🔯 故障转移';

/**
 * 自动生成地区策略组（通用中间格式）
 * @param {Object[]} proxies 
 * @returns {Array} 地区分组数据
 */
function generateRegionData(proxies) {
    // [智能升级] 直接传递代理对象数组，region-groups 现在能识别 metadata
    return groupNodeLinesByRegion(proxies);
}

/**
 * 策略组工厂
 */
export const POLICY_GROUPS = {
    // 基础配置
    BASE: (proxies) => {
        const proxyNames = proxies.map(p => p.tag || p.name);
        return [
            { name: DEFAULT_SELECT_GROUP, type: 'select', proxies: [...proxyNames, AUTO_SELECT_GROUP, FALLBACK_GROUP, 'DIRECT'] },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: FALLBACK_GROUP, type: 'fallback', proxies: proxyNames }
        ];
    },
    // 标准配置
    STD: (proxies) => {
        const proxyNames = proxies.map(p => p.tag || p.name);
        const regions = generateRegionData(proxies);
        const regionNames = regions.map(r => r.name);
        return [
            { name: DEFAULT_SELECT_GROUP, type: 'select', proxies: [...regionNames, AUTO_SELECT_GROUP, ...proxyNames, 'DIRECT'] },
            ...regions.map(r => ({ name: r.name, type: 'url-test', proxies: r.tags })),
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: '🎬 视频广告', type: 'select', proxies: ['REJECT', 'DIRECT', DEFAULT_SELECT_GROUP] },
            { name: '🎥 流媒体', type: 'select', proxies: [DEFAULT_SELECT_GROUP, AUTO_SELECT_GROUP, 'DIRECT'] },
            { name: '🍎 Apple', type: 'select', proxies: ['DIRECT', DEFAULT_SELECT_GROUP, AUTO_SELECT_GROUP] },
            { name: 'Ⓜ️ Microsoft', type: 'select', proxies: ['DIRECT', DEFAULT_SELECT_GROUP, AUTO_SELECT_GROUP] }
        ];
    },
    // 完整配置
    FULL: (proxies) => {
        const proxyNames = proxies.map(p => p.tag || p.name);
        const regions = generateRegionData(proxies);
        const regionNames = regions.map(r => r.name);
        return [
            { name: DEFAULT_SELECT_GROUP, type: 'select', proxies: [...regionNames, AUTO_SELECT_GROUP, ...proxyNames, 'DIRECT'] },
            ...regions.map(r => ({ name: r.name, type: 'url-test', proxies: r.tags })),
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: '🎬 视频广告', type: 'select', proxies: ['REJECT', 'DIRECT', DEFAULT_SELECT_GROUP] },
            { name: '🎥 流媒体', type: 'select', proxies: [DEFAULT_SELECT_GROUP, AUTO_SELECT_GROUP, 'DIRECT'] },
            { name: '🍎 Apple', type: 'select', proxies: ['DIRECT', DEFAULT_SELECT_GROUP, AUTO_SELECT_GROUP] },
            { name: 'Ⓜ️ Microsoft', type: 'select', proxies: ['DIRECT', DEFAULT_SELECT_GROUP, AUTO_SELECT_GROUP] },
            { name: '📲 Telegram', type: 'select', proxies: [DEFAULT_SELECT_GROUP, AUTO_SELECT_GROUP, 'DIRECT'] },
            { name: '🎧 Spotify', type: 'select', proxies: [DEFAULT_SELECT_GROUP, AUTO_SELECT_GROUP, 'DIRECT'] },
            { name: '🎮 游戏平台', type: 'select', proxies: ['DIRECT', DEFAULT_SELECT_GROUP, AUTO_SELECT_GROUP] }
        ];
    },
    // 链式代理
    RELAY: (proxies) => {
        const proxyNames = proxies.map(p => p.tag || p.name);
        const regions = generateRegionData(proxies);
        const regionNames = regions.map(r => r.name);
        return [
            { name: DEFAULT_RELAY_GROUP, type: 'select', proxies: ['🔗 链式代理', '🚀 常用节点', ...regionNames, 'DIRECT'] },
            { name: '🔗 链式代理', type: 'relay', proxies: ['入口节点', '落地节点'] },
            { name: '入口节点', type: 'select', proxies: [...proxyNames, 'DIRECT'] },
            { name: '落地节点', type: 'select', proxies: [...proxyNames, 'DIRECT'] },
            ...regions.map(r => ({ name: r.name, type: 'url-test', proxies: r.tags })),
            { name: '🚀 常用节点', type: 'select', proxies: [...regionNames, AUTO_SELECT_GROUP, ...proxyNames, 'DIRECT'] },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: '🎬 视频广告', type: 'select', proxies: ['REJECT', 'DIRECT', DEFAULT_RELAY_GROUP] },
            { name: '🎥 流媒体', type: 'select', proxies: [DEFAULT_RELAY_GROUP, '🚀 常用节点', 'DIRECT'] },
            { name: '🍎 Apple', type: 'select', proxies: ['DIRECT', DEFAULT_RELAY_GROUP, '🚀 常用节点'] },
            { name: 'Ⓜ️ Microsoft', type: 'select', proxies: ['DIRECT', DEFAULT_RELAY_GROUP, '🚀 常用节点'] }
        ];
    }
};

/**
 * 远程规则源配置 (对齐各平台最高性能格式)
 */
export const REMOTE_SOURCES = {
    ADS: {
        name: '广告拦截',
        clash: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Providers/Ruleset/BanAD.yaml',
        singbox: 'https://raw.githubusercontent.com/Loyalsoldier/sing-box-rules/release/geosite-category-ads-all.json',
        surge: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list',
        quanx: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list'
    },
    STREAM: {
        name: '流媒体',
        clash: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Providers/Ruleset/Netflix.yaml', // 示例，实际使用聚合源
        singbox: 'https://raw.githubusercontent.com/Loyalsoldier/sing-box-rules/release/geosite-netflix.json',
        surge: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Netflix.list'
    },
    SOCIAL: {
        name: '社交媒体',
        clash: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Providers/Ruleset/Telegram.yaml',
        singbox: 'https://raw.githubusercontent.com/Loyalsoldier/sing-box-rules/release/geosite-telegram.json',
        surge: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list'
    },
    APPLE: {
        name: '苹果服务',
        clash: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Providers/Ruleset/Apple.yaml',
        singbox: 'https://raw.githubusercontent.com/Loyalsoldier/sing-box-rules/release/geosite-apple.json',
        surge: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Apple.list'
    },
    MICROSOFT: {
        name: '微软服务',
        clash: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Providers/Ruleset/Microsoft.yaml',
        singbox: 'https://raw.githubusercontent.com/Loyalsoldier/sing-box-rules/release/geosite-microsoft.json',
        surge: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Microsoft.list'
    }
};

/**
 * 分流规则集 (通过 RULE-SET 引用远程源)
 */
export const RULE_SETS = {
    BASE: [
        `DOMAIN-SUFFIX,google.com,${DEFAULT_SELECT_GROUP}`,
        `DOMAIN-KEYWORD,google,${DEFAULT_SELECT_GROUP}`,
        `DOMAIN-SUFFIX,github.com,${DEFAULT_SELECT_GROUP}`,
        'GEOIP,CN,DIRECT',
        `MATCH,${DEFAULT_SELECT_GROUP}`
    ],
    STD: [
        'RULE-SET,ADS,🎬 视频广告',
        'RULE-SET,STREAM,🎥 流媒体',
        'RULE-SET,APPLE,🍎 Apple',
        'RULE-SET,MICROSOFT,Ⓜ️ Microsoft',
        `DOMAIN-SUFFIX,google.com,${DEFAULT_SELECT_GROUP}`,
        `DOMAIN-SUFFIX,github.com,${DEFAULT_SELECT_GROUP}`,
        'GEOIP,CN,DIRECT',
        `MATCH,${DEFAULT_SELECT_GROUP}`
    ],
    FULL: [
        'RULE-SET,ADS,🎬 视频广告',
        'RULE-SET,SOCIAL,📲 Telegram',
        'RULE-SET,STREAM,🎥 流媒体',
        'RULE-SET,APPLE,🍎 Apple',
        'RULE-SET,MICROSOFT,Ⓜ️ Microsoft',
        `DOMAIN-SUFFIX,google.com,${DEFAULT_SELECT_GROUP}`,
        `DOMAIN-SUFFIX,github.com,${DEFAULT_SELECT_GROUP}`,
        'GEOIP,CN,DIRECT',
        `MATCH,${DEFAULT_SELECT_GROUP}`
    ],
    RELAY: [
        'RULE-SET,ADS,🎬 视频广告',
        'RULE-SET,STREAM,🎥 流媒体',
        'RULE-SET,APPLE,🍎 Apple',
        'RULE-SET,MICROSOFT,Ⓜ️ Microsoft',
        `DOMAIN-SUFFIX,google.com,${DEFAULT_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,github.com,${DEFAULT_RELAY_GROUP}`,
        'GEOIP,CN,DIRECT',
        `MATCH,${DEFAULT_RELAY_GROUP}`
    ]
};

/**
 * 翻译逻辑集
 */

// 转换单行规则到目标格式
export function translateRuleLine(line, format) {
    const parts = line.split(',');
    const type = parts[0];
    const value = parts[1];
    const target = parts[2];
    const extra = parts[3];

    if (type === 'RULE-SET') {
        const source = REMOTE_SOURCES[value];
        if (!source) return null;

        switch (format) {
            case 'clash':
                // 返回中间对象，由生成器处理 rule-providers
                return { type: 'rule-provider', provider: value, target };
            case 'singbox':
            case 'sing-box':
                // 返回中间对象，由生成器处理 rule_sets
                return { type: 'rule_set', tag: value, outbound: target };
            case 'surge':
            case 'loon':
                return `RULE-SET,${source.surge || source.clash},${target}`;
            case 'quanx':
                return `filter_remote, ${source.quanx || source.clash}, tag=${source.name}, force-policy=${target}, update-interval=86400`;
            default:
                return null;
        }
    }

    switch (format) {
        case 'singbox':
        case 'sing-box':
            if (type === 'DOMAIN-SUFFIX') return { domain_suffix: [value], outbound: target };
            if (type === 'DOMAIN-KEYWORD') return { domain_keyword: [value], outbound: target };
            if (type === 'DOMAIN') return { domain: [value], outbound: target };
            if (type === 'IP-CIDR') return { ip_cidr: [value], outbound: target };
            if (type === 'GEOIP') return { geoip: [value.toLowerCase()], outbound: target };
            return null;

        case 'surge':
        case 'loon':
            return line;

        case 'quanx':
            let qxType = type;
            if (type === 'DOMAIN-SUFFIX') qxType = 'HOST-SUFFIX';
            if (type === 'DOMAIN-KEYWORD') qxType = 'HOST-KEYWORD';
            if (type === 'DOMAIN') qxType = 'HOST';
            if (type === 'MATCH') return `FINAL, ${value}`;
            return `${qxType}, ${value}, ${target}${extra ? ', ' + extra : ''}`;

        default:
            return line;
    }
}

// 获取全量分流规则文本/对象
export function getBuiltinRules(level, format) {
    const rawRules = RULE_SETS[level.toUpperCase()] || RULE_SETS.STD;
    return rawRules.map(l => translateRuleLine(l, format)).filter(Boolean);
}

/**
 * 为特定的生成器提取远程源定义
 * @param {string} format 
 * @param {Array} ruleLines (翻译后的规则行)
 */
export function getRemoteProviderDefinitions(format, ruleLines) {
    const providers = {};
    const usedTags = new Set();

    ruleLines.forEach(line => {
        if (format === 'clash' && line.type === 'rule-provider') {
            usedTags.add(line.provider);
        } else if ((format === 'singbox' || format === 'sing-box') && line.type === 'rule_set') {
            usedTags.add(line.tag);
        }
    });

    usedTags.forEach(tag => {
        const source = REMOTE_SOURCES[tag];
        if (!source) return;

        if (format === 'clash') {
            providers[tag] = {
                type: 'http',
                behavior: 'classical',
                url: source.clash,
                path: `./ruleset/${tag}.yaml`,
                interval: 86400
            };
        } else if (format === 'singbox' || format === 'sing-box') {
            providers[tag] = {
                tag: tag,
                type: 'remote',
                format: 'source',
                url: source.singbox,
                download_detour: 'DIRECT'
            };
        }
    });

    return providers;
}
