import { groupNodeLinesByRegion } from './region-groups.js';

/**
 * 策略组标准名称常量
 */
export const DEFAULT_SELECT_GROUP = '🚀 节点选择';
export const DEFAULT_RELAY_GROUP = '🌍 总出口';
export const AUTO_SELECT_GROUP = '♻️ 自动选择';
export const FALLBACK_GROUP = '🔯 故障转移';
export const MANUAL_SELECT_GROUP = '👋 手动切换';

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
 * 清理策略组中不存在的成员引用
 * @param {Array} proxyGroups - 策略组对象数组
 * @param {Array} proxies - 可用代理对象数组
 * @returns {Array} 清理后的策略组数组
 */
export function pruneProxyGroups(proxyGroups, proxies) {
    const validTargetNames = new Set([
        ...proxies.map(p => p.tag || p.name),
        ...proxyGroups.map(g => g.name),
        DEFAULT_SELECT_GROUP,
        DEFAULT_RELAY_GROUP,
        AUTO_SELECT_GROUP,
        FALLBACK_GROUP,
        MANUAL_SELECT_GROUP,
        ...['DIRECT', 'REJECT', 'REJECT-DROP', 'ANY'] // 各平台通用保留字
    ]);

    return proxyGroups.map(group => {
        if (!Array.isArray(group.proxies)) return group;
        
        const newProxies = group.proxies.filter(member => {
            // 核心修复 1：禁止策略组引用自身
            if (member === group.name) return false;
            
            // 核心修复 2：禁止任何非顶级组通过正则表达式包含顶级入口组名，防止回环（解决 .* 匹配问题）
            // 如果成员名是顶级组名，且当前组不是顶级组自身，且该成员是通过正则匹配推断出的（或显式声明的）
            if (member === DEFAULT_SELECT_GROUP || member === DEFAULT_RELAY_GROUP) {
                // 顶级组绝不允许作为其他非顶级组的成员，尤其是手动切换/业务分流组
                return false;
            }

            // regex 过滤器的内容不应在此时剔除
            if (typeof member === 'string' && (member.startsWith('(') || member.includes('.*') || member.includes('+') || member.includes('$'))) {
                return true;
            }
            return validTargetNames.has(member);
        });

        // 兜底逻辑
        return {
            ...group,
            proxies: newProxies.length > 0 ? newProxies : ['DIRECT']
        };
    });
}

/**
 * 内部辅助：生成地区相关的策略组定义
 */
function _generateRegionGroups(proxies) {
    const regions = groupNodeLinesByRegion(proxies);
    const regionSelectGroups = [];   // 地区选择组（顶级按钮）
    const regionSupportGroups = []; // 地区辅助组（隐藏/末尾）
    const regionNames = [];

    regions.forEach(r => {
        // 为每个地区生成一个更简洁的辅助测速组名
        const autoGroupName = `⚡️ ${r.name.replace('节点', '')} - 自动测速`;
        regionNames.push(r.name);

        // [地区选择组] 内部包含测速组和具体节点
        regionSelectGroups.push({ 
            name: r.name, 
            type: 'select', 
            proxies: [autoGroupName, ...r.tags] 
        });

        // [地区辅助测速组]
        regionSupportGroups.push({ 
            name: autoGroupName, 
            type: 'url-test', 
            proxies: r.tags,
            hidden: true,
            options: { url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 }
        });
    });

    return { regionSelectGroups, regionSupportGroups, regionNames };
}

/**
 * 策略组工厂
 */
export const POLICY_GROUPS = {
    // 基础配置：精简版
    BASE: (proxies) => {
        const proxyNames = proxies.map(p => p.tag || p.name);
        return [
            { name: DEFAULT_SELECT_GROUP, type: 'select', proxies: [AUTO_SELECT_GROUP, FALLBACK_GROUP, MANUAL_SELECT_GROUP, 'DIRECT'] },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: FALLBACK_GROUP, type: 'fallback', proxies: proxyNames },
            { name: MANUAL_SELECT_GROUP, type: 'select', proxies: proxyNames }
        ];
    },
    // 标准配置：全能型
    STD: (proxies) => {
        const proxyNames = proxies.map(p => p.tag || p.name);
        const { regionSelectGroups, regionSupportGroups, regionNames } = _generateRegionGroups(proxies);
        
        return [
            { name: DEFAULT_SELECT_GROUP, type: 'select', proxies: [AUTO_SELECT_GROUP, FALLBACK_GROUP, MANUAL_SELECT_GROUP, ...regionNames, 'DIRECT'] },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: FALLBACK_GROUP, type: 'fallback', proxies: proxyNames },
            { name: MANUAL_SELECT_GROUP, type: 'select', proxies: proxyNames },
            ...regionSelectGroups,
            { name: '🤖 智能 AI', type: 'select', proxies: ['🇺🇸 美国节点', '🇸🇬 狮城节点', '🇯🇵 日本节点', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP, 'DIRECT'] },
            { name: '🎬 视频广告', type: 'select', proxies: ['REJECT', 'DIRECT', AUTO_SELECT_GROUP] },
            { name: '🎥 流媒体', type: 'select', proxies: [AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP, 'DIRECT'] },
            { name: '🍎 Apple', type: 'select', proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP] },
            { name: 'Ⓜ️ Microsoft', type: 'select', proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP] },
            ...regionSupportGroups
        ];
    },
    // 完整配置：细化分类
    FULL: (proxies) => {
        const proxyNames = proxies.map(p => p.tag || p.name);
        const { regionSelectGroups, regionSupportGroups, regionNames } = _generateRegionGroups(proxies);
        
        return [
            { name: DEFAULT_SELECT_GROUP, type: 'select', proxies: [AUTO_SELECT_GROUP, FALLBACK_GROUP, MANUAL_SELECT_GROUP, ...regionNames, 'DIRECT'] },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: FALLBACK_GROUP, type: 'fallback', proxies: proxyNames },
            { name: MANUAL_SELECT_GROUP, type: 'select', proxies: proxyNames },
            ...regionSelectGroups,
            // 核心修复：业务组直接引用具体地区组或自动选择组，不引用 DEFAULT_SELECT_GROUP 
            { name: '🤖 智能 AI', type: 'select', proxies: ['🇺🇸 美国节点', '🇸🇬 狮城节点', '🇯🇵 日本节点', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP, 'DIRECT'] },
            { name: '🎬 视频广告', type: 'select', proxies: ['REJECT', 'DIRECT', AUTO_SELECT_GROUP] },
            { name: '🎥 流媒体', type: 'select', proxies: [AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP, 'DIRECT'] },
            { name: '🍎 Apple', type: 'select', proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP] },
            { name: 'Ⓜ️ Microsoft', type: 'select', proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP] },
            { name: '📲 Telegram', type: 'select', proxies: [AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP, 'DIRECT'] },
            { name: '🎧 Spotify', type: 'select', proxies: [AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP, 'DIRECT'] },
            { name: '🎮 游戏平台', type: 'select', proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP] },
            ...regionSupportGroups
        ];
    },
    // 链式代理：中转优化
    RELAY: (proxies) => {
        const proxyNames = proxies.map(p => p.tag || p.name);
        const { regionSelectGroups, regionSupportGroups, regionNames } = _generateRegionGroups(proxies);
        
        return [
            { name: DEFAULT_RELAY_GROUP, type: 'select', proxies: ['🔗 链式代理', '🚀 常用节点', ...regionNames, 'DIRECT'] },
            { name: '🔗 链式代理', type: 'select', proxies: ['入口节点', '落地节点'] },
            { name: '入口节点', type: 'select', proxies: [AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP, 'DIRECT', ...proxyNames] },
            { name: '落地节点', type: 'select', proxies: [AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP, 'DIRECT', ...proxyNames] },
            ...regionSelectGroups,
            { name: '🚀 常用节点', type: 'select', proxies: [AUTO_SELECT_GROUP, FALLBACK_GROUP, MANUAL_SELECT_GROUP, ...regionNames, 'DIRECT'] },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: FALLBACK_GROUP, type: 'fallback', proxies: proxyNames },
            { name: MANUAL_SELECT_GROUP, type: 'select', proxies: proxyNames },
            // 核心修复：链式版的分流也禁止回引 DEFAULT_RELAY_GROUP，统一使用地区组或常用节点
            { name: '🎬 视频广告', type: 'select', proxies: ['REJECT', 'DIRECT', AUTO_SELECT_GROUP] },
            { name: '🎥 流媒体', type: 'select', proxies: ['🔗 链式代理', '🚀 常用节点', 'DIRECT', AUTO_SELECT_GROUP] },
            { name: '🤖 智能 AI', type: 'select', proxies: ['🔗 链式代理', '🇺🇸 美国节点', '🇸🇬 狮城节点', '🇯🇵 日本节点', '🚀 常用节点', 'DIRECT'] },
            { name: '🍎 Apple', type: 'select', proxies: ['🔗 链式代理', 'DIRECT', '🚀 常用节点', AUTO_SELECT_GROUP] },
            { name: 'Ⓜ️ Microsoft', type: 'select', proxies: ['🔗 链式代理', 'DIRECT', '🚀 常用节点', AUTO_SELECT_GROUP] },
            ...regionSupportGroups
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
        surge: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Microsoft.list',
        quanx: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Microsoft.list'
    },
    AI: {
        name: '智能 AI',
        clash: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Providers/Ruleset/OpenAi.yaml',
        singbox: 'https://raw.githubusercontent.com/Loyalsoldier/sing-box-rules/release/geosite-openai.json',
        surge: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list',
        quanx: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list'
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
        'RULE-SET,AI,🤖 智能 AI',
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
        'RULE-SET,AI,🤖 智能 AI',
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
        'RULE-SET,AI,🤖 智能 AI',
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
