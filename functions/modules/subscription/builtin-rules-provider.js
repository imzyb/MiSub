import { groupNodeLinesByRegion } from './region-groups.js';
import { DNS_PROXY_GROUP, SINGBOX_CN_RULE_SET } from './safe-dns.js';

/**
 * 策略组标准名称常量
 */
export const DEFAULT_SELECT_GROUP = '🚀 节点选择';
export const DEFAULT_RELAY_GROUP = '🌍 总出口';
export const AUTO_SELECT_GROUP = '♻️ 自动选择';
export const FALLBACK_GROUP = '🔯 故障转移';
export const MANUAL_SELECT_GROUP = '👋 手动切换';

export const AI_SERVICE_RULES = Object.freeze([
    {
        id: 'openai',
        name: 'OpenAI',
        domains: [
            'openai.com',
            'chatgpt.com',
            'oaistatic.com',
            'oaiusercontent.com',
            'auth0.openai.com',
        ],
    },
    {
        id: 'claude',
        name: 'Claude',
        domains: [
            'anthropic.com',
            'claude.ai',
            'claude.com',
            'claudeusercontent.com',
            'anthropicusercontent.com',
        ],
    },
    {
        id: 'gemini',
        name: 'Gemini',
        domains: [
            'gemini.google.com',
            'aistudio.google.com',
            'generativelanguage.googleapis.com',
            'ai.google.dev',
            'makersuite.google.com',
        ],
    },
    {
        id: 'copilot',
        name: 'Copilot',
        domains: ['copilot.microsoft.com', 'githubcopilot.com', 'api.githubcopilot.com'],
    },
    { id: 'grok', name: 'Grok', domains: ['x.ai', 'grok.com', 'grok.x.com'] },
    { id: 'perplexity', name: 'Perplexity', domains: ['perplexity.ai', 'pplx.ai'] },
    { id: 'mistral', name: 'Mistral', domains: ['mistral.ai'] },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        domains: ['deepseek.com', 'chat.deepseek.com', 'api.deepseek.com'],
    },
    {
        id: 'ai-platforms',
        name: 'AI 平台',
        domains: [
            'poe.com',
            'character.ai',
            'huggingface.co',
            'replicate.com',
            'openrouter.ai',
            'groq.com',
            'cohere.com',
        ],
    },
]);

export const AI_DOMAIN_RULE_LINES = AI_SERVICE_RULES.flatMap((service) =>
    service.domains.map((domain) => `DOMAIN-SUFFIX,${domain},🤖 ${service.name}`)
);

const AI_AUTO_GROUP = '🤖 AI 自动';
const AI_FALLBACK_GROUP = '🤖 AI 故障转移';

function dnsProxyGroup(proxyNames) {
    return {
        name: DNS_PROXY_GROUP,
        type: 'url-test',
        proxies: proxyNames.length > 0 ? proxyNames : ['REJECT'],
        hidden: true,
        options: { url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
    };
}

function aiPolicyGroups(proxyNames, regionNames, { relay = false } = {}) {
    const nodeCandidates = proxyNames.length > 0 ? proxyNames : ['REJECT'];
    const candidates = [AI_AUTO_GROUP, AI_FALLBACK_GROUP, ...regionNames, MANUAL_SELECT_GROUP];
    if (relay) candidates.push('🔗 链式代理', '🚀 常用节点');

    return [
        {
            name: AI_AUTO_GROUP,
            type: 'url-test',
            proxies: nodeCandidates,
            hidden: true,
            options: { url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
        },
        {
            name: AI_FALLBACK_GROUP,
            type: 'fallback',
            proxies: nodeCandidates,
            hidden: true,
            options: { url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
        },
        { name: '🤖 智能 AI', type: 'select', proxies: candidates },
        ...AI_SERVICE_RULES.map((service) => ({
            name: `🤖 ${service.name}`,
            type: 'select',
            proxies: candidates,
        })),
    ];
}

/**
 * 自动生成地区策略组（通用中间格式）
 * @param {Object[]} proxies
 * @returns {Array} 地区分组数据
 */
function generateRegionData(proxies, options = {}) {
    // [智能升级] 直接传递代理对象数组，region-groups 现在能识别 metadata
    return groupNodeLinesByRegion(proxies, options);
}

/**
 * 清理策略组中不存在的成员引用
 * @param {Array} proxyGroups - 策略组对象数组
 * @param {Array} proxies - 可用代理对象数组
 * @returns {Array} 清理后的策略组数组
 */
export function pruneProxyGroups(proxyGroups, proxies) {
    const validTargetNames = new Set([
        ...proxies.map((p) => p.tag || p.name),
        ...proxyGroups.map((g) => g.name),
        DEFAULT_SELECT_GROUP,
        DEFAULT_RELAY_GROUP,
        AUTO_SELECT_GROUP,
        FALLBACK_GROUP,
        MANUAL_SELECT_GROUP,
        DNS_PROXY_GROUP,
        ...['DIRECT', 'REJECT', 'REJECT-DROP', 'ANY'], // 各平台通用保留字
    ]);

    return proxyGroups.map((group) => {
        if (!Array.isArray(group.proxies)) return group;

        const newProxies = group.proxies.filter((member) => {
            // 核心修复 1：禁止策略组引用自身
            if (member === group.name) return false;

            // 核心修复 2：禁止任何非顶级组通过正则表达式包含顶级入口组名，防止回环（解决 .* 匹配问题）
            // 如果成员名是顶级组名，且当前组不是顶级组自身，且该成员是通过正则匹配推断出的（或显式声明的）
            if (member === DEFAULT_SELECT_GROUP || member === DEFAULT_RELAY_GROUP) {
                // 顶级组绝不允许作为其他非顶级组的成员，尤其是手动切换/业务分流组
                return false;
            }

            // regex 过滤器的内容不应在此时剔除
            if (
                typeof member === 'string' &&
                (member.startsWith('(') ||
                    member.includes('.*') ||
                    member.includes('+') ||
                    member.includes('$'))
            ) {
                return true;
            }
            return validTargetNames.has(member);
        });

        // 兜底逻辑
        const failClosed =
            String(group.name || '').startsWith('🤖') || group.name === DNS_PROXY_GROUP;
        return {
            ...group,
            proxies: newProxies.length > 0 ? newProxies : [failClosed ? 'REJECT' : 'DIRECT'],
        };
    });
}

/**
 * 内部辅助：生成地区相关的策略组定义
 */
function _generateRegionGroups(proxies, options = {}) {
    const regions = generateRegionData(proxies, options);
    const regionSelectGroups = []; // 地区选择组（顶级按钮）
    const regionSupportGroups = []; // 地区辅助组（隐藏/末尾）
    const regionNames = [];

    regions.forEach((r) => {
        // 为每个地区生成一个更简洁的辅助测速组名
        const autoGroupName = `⚡️ ${r.name.replace('节点', '')} - 自动测速`;
        regionNames.push(r.name);

        // [地区选择组] 内部包含测速组和具体节点
        regionSelectGroups.push({
            name: r.name,
            type: 'select',
            proxies: [autoGroupName, ...r.tags],
        });

        // [地区辅助测速组]
        regionSupportGroups.push({
            name: autoGroupName,
            type: 'url-test',
            proxies: r.tags,
            hidden: true,
            options: { url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
        });
    });

    return { regionSelectGroups, regionSupportGroups, regionNames };
}

/**
 * 策略组工厂
 */
export const POLICY_GROUPS = {
    // 基础配置：精简版
    BASE: (proxies, options = {}) => {
        const proxyNames = proxies.map((p) => p.tag || p.name);
        return [
            dnsProxyGroup(proxyNames),
            {
                name: DEFAULT_SELECT_GROUP,
                type: 'select',
                proxies: [AUTO_SELECT_GROUP, FALLBACK_GROUP, MANUAL_SELECT_GROUP, 'DIRECT'],
            },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: FALLBACK_GROUP, type: 'fallback', proxies: proxyNames },
            { name: MANUAL_SELECT_GROUP, type: 'select', proxies: proxyNames },
            ...aiPolicyGroups(proxyNames, []),
        ];
    },
    // 标准配置：全能型
    STD: (proxies, options = {}) => {
        const proxyNames = proxies.map((p) => p.tag || p.name);
        const { regionSelectGroups, regionSupportGroups, regionNames } = _generateRegionGroups(
            proxies,
            options
        );

        return [
            dnsProxyGroup(proxyNames),
            {
                name: DEFAULT_SELECT_GROUP,
                type: 'select',
                proxies: [
                    AUTO_SELECT_GROUP,
                    FALLBACK_GROUP,
                    MANUAL_SELECT_GROUP,
                    ...regionNames,
                    'DIRECT',
                ],
            },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: FALLBACK_GROUP, type: 'fallback', proxies: proxyNames },
            { name: MANUAL_SELECT_GROUP, type: 'select', proxies: proxyNames },
            ...regionSelectGroups,
            ...aiPolicyGroups(proxyNames, regionNames),
            { name: '🎬 视频广告', type: 'select', proxies: ['REJECT', 'DIRECT'] },
            {
                name: '🎥 流媒体',
                type: 'select',
                proxies: [
                    '🇸🇬 狮城节点',
                    '🇭🇰 香港节点',
                    '🇹🇼 台湾节点',
                    '🇯🇵 日本节点',
                    AUTO_SELECT_GROUP,
                    MANUAL_SELECT_GROUP,
                    'DIRECT',
                ],
            },
            {
                name: '🍎 Apple',
                type: 'select',
                proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP],
            },
            {
                name: 'Ⓜ️ Microsoft',
                type: 'select',
                proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP],
            },
            {
                name: '📲 Telegram',
                type: 'select',
                proxies: [
                    AUTO_SELECT_GROUP,
                    '🇸🇬 狮城节点',
                    '🇭🇰 香港节点',
                    MANUAL_SELECT_GROUP,
                    'DIRECT',
                ],
            },
            ...regionSupportGroups,
        ];
    },
    // 完整配置：细化分类
    FULL: (proxies, options = {}) => {
        const proxyNames = proxies.map((p) => p.tag || p.name);
        const { regionSelectGroups, regionSupportGroups, regionNames } = _generateRegionGroups(
            proxies,
            options
        );

        return [
            dnsProxyGroup(proxyNames),
            {
                name: DEFAULT_SELECT_GROUP,
                type: 'select',
                proxies: [
                    AUTO_SELECT_GROUP,
                    FALLBACK_GROUP,
                    MANUAL_SELECT_GROUP,
                    ...regionNames,
                    'DIRECT',
                ],
            },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: FALLBACK_GROUP, type: 'fallback', proxies: proxyNames },
            { name: MANUAL_SELECT_GROUP, type: 'select', proxies: proxyNames },
            ...regionSelectGroups,
            // AI 服务始终使用代理候选；无可用节点时由 pruneProxyGroups 保持 REJECT。
            ...aiPolicyGroups(proxyNames, regionNames),
            { name: '🎬 视频广告', type: 'select', proxies: ['REJECT', 'DIRECT'] },
            {
                name: '🎥 流媒体',
                type: 'select',
                proxies: [
                    '🇸🇬 狮城节点',
                    '🇭🇰 香港节点',
                    '🇹🇼 台湾节点',
                    '🇯🇵 日本节点',
                    AUTO_SELECT_GROUP,
                    MANUAL_SELECT_GROUP,
                    'DIRECT',
                ],
            },
            {
                name: '🍎 Apple',
                type: 'select',
                proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP],
            },
            {
                name: 'Ⓜ️ Microsoft',
                type: 'select',
                proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP],
            },
            {
                name: '📲 Telegram',
                type: 'select',
                proxies: [
                    AUTO_SELECT_GROUP,
                    '🇸🇬 狮城节点',
                    '🇭🇰 香港节点',
                    MANUAL_SELECT_GROUP,
                    'DIRECT',
                ],
            },
            {
                name: '🎧 Spotify',
                type: 'select',
                proxies: [AUTO_SELECT_GROUP, '🇸🇬 狮城节点', MANUAL_SELECT_GROUP, 'DIRECT'],
            },
            {
                name: '🎮 游戏平台',
                type: 'select',
                proxies: ['DIRECT', AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP],
            },
            ...regionSupportGroups,
        ];
    },
    // 链式代理：中转优化
    RELAY: (proxies, options = {}) => {
        const proxyNames = proxies.map((p) => p.tag || p.name);
        const { regionSelectGroups, regionSupportGroups, regionNames } = _generateRegionGroups(
            proxies,
            options
        );

        return [
            dnsProxyGroup(proxyNames),
            {
                name: DEFAULT_RELAY_GROUP,
                type: 'select',
                proxies: [
                    '🔗 链式代理',
                    AUTO_SELECT_GROUP,
                    MANUAL_SELECT_GROUP,
                    '🚀 常用节点',
                    ...regionNames,
                    'DIRECT',
                ],
            },
            // 保持 provider 层为通用 select，不在抽象层输出 relay 语义。
            // 否则模板渲染/普通 Clash 路径可能把它转换成 Mihomo 专属 dialer-proxy，导致客户端拉取失败。
            {
                name: '🔗 链式代理',
                type: 'select',
                proxies: [
                    '入口节点',
                    AUTO_SELECT_GROUP,
                    MANUAL_SELECT_GROUP,
                    'DIRECT',
                    ...proxyNames,
                ],
            },
            {
                name: '入口节点',
                type: 'select',
                proxies: [AUTO_SELECT_GROUP, MANUAL_SELECT_GROUP, 'DIRECT', ...proxyNames],
            },
            ...regionSelectGroups,
            {
                name: '🚀 常用节点',
                type: 'select',
                proxies: [
                    AUTO_SELECT_GROUP,
                    FALLBACK_GROUP,
                    MANUAL_SELECT_GROUP,
                    ...regionNames,
                    'DIRECT',
                ],
            },
            { name: AUTO_SELECT_GROUP, type: 'url-test', proxies: proxyNames },
            { name: FALLBACK_GROUP, type: 'fallback', proxies: proxyNames },
            { name: MANUAL_SELECT_GROUP, type: 'select', proxies: proxyNames },
            // 核心修复：链式版的分流也禁止回引 DEFAULT_RELAY_GROUP，统一使用地区组或常用节点
            { name: '🎬 视频广告', type: 'select', proxies: ['REJECT', 'DIRECT'] },
            {
                name: '🎥 流媒体',
                type: 'select',
                proxies: [
                    '🇸🇬 狮城节点',
                    '🇭🇰 香港节点',
                    '🇹🇼 台湾节点',
                    '🇯🇵 日本节点',
                    AUTO_SELECT_GROUP,
                    MANUAL_SELECT_GROUP,
                    'DIRECT',
                ],
            },
            ...aiPolicyGroups(proxyNames, regionNames, { relay: true }),
            {
                name: '🍎 Apple',
                type: 'select',
                proxies: ['DIRECT', '🚀 常用节点', AUTO_SELECT_GROUP],
            },
            {
                name: 'Ⓜ️ Microsoft',
                type: 'select',
                proxies: ['DIRECT', '🚀 常用节点', AUTO_SELECT_GROUP],
            },
            ...regionSupportGroups,
        ];
    },
};

/**
 * 远程规则源配置 (对齐各平台最高性能格式)
 */
export const PINNED_RULE_REVISIONS = Object.freeze({
    ACL4SSR: '433381ebc4b1de59350fa8bed2a04a888228f801',
    SING_GEOSITE: '0adeef8a3b9201292f6786ef4de81bcc02e971eb',
    SING_GEOIP: 'b9c5e675b4d5359d4b47f4434fa7ae77e9991306',
    BLACKMATRIX: '538b8a79532c44dfbcb8e694d2f43e753c60b157',
});

const ACL4SSR_BASE = `https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/${PINNED_RULE_REVISIONS.ACL4SSR}`;
const SING_GEOSITE_BASE = `https://raw.githubusercontent.com/SagerNet/sing-geosite/${PINNED_RULE_REVISIONS.SING_GEOSITE}`;
const SING_GEOIP_BASE = `https://raw.githubusercontent.com/SagerNet/sing-geoip/${PINNED_RULE_REVISIONS.SING_GEOIP}`;

/**
 * 将 raw.githubusercontent.com 链接重写为 jsDelivr CDN 镜像。
 *
 * 背景：raw.githubusercontent.com 在中国大陆长期无法直连，导致 Clash/mihomo
 * 客户端拉取 RULE-SET 时静默失败（路由规则缺失、广告拦截失效、分流错乱），
 * 而大部分用户并不会注意到是规则源下载失败。jsDelivr 的 gh 通道在国内可直连，
 * 且与 GitHub 内容保持同步（存在少量缓存延迟，对规则集无影响）。
 *
 * 重写形式：
 *   https://raw.githubusercontent.com/OWNER/REPO/REF/PATH
 *   -> https://cdn.jsdelivr.net/gh/OWNER/REPO@REF/PATH
 *
 * 同时保留原有的「锁定版本」行为：若目标仓库在 PINNED_RULE_REVISIONS 中有固定
 * 修订号，则用固定修订号替换原始分支/标签，避免上游改动导致规则漂移。
 *
 * @param {string} sourceUrl 原始规则源地址
 * @param {Object}  [options]
 * @param {boolean} [options.mirror=true] 是否启用 CDN 镜像重写
 * @returns {string} 重写后的地址（不满足条件时原样返回）
 */
export function pinRemoteRuleUrl(sourceUrl, options = {}) {
    const { mirror = true } = options;
    const raw = String(sourceUrl || '').trim();
    if (!/^https?:\/\//i.test(raw)) return sourceUrl;

    try {
        const url = new URL(raw);
        if (!/raw\.githubusercontent\.com$/i.test(url.hostname)) return raw;
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length < 4) return raw;
        const key = `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
        const revisions = {
            'acl4ssr/acl4ssr': PINNED_RULE_REVISIONS.ACL4SSR,
            'sagernet/sing-geosite': PINNED_RULE_REVISIONS.SING_GEOSITE,
            'sagernet/sing-geoip': PINNED_RULE_REVISIONS.SING_GEOIP,
            'blackmatrix7/ios_rule_script': PINNED_RULE_REVISIONS.BLACKMATRIX,
        };
        const revision = revisions[key];
        if (revision) {
            parts[2] = revision;
        }

        const [owner, repo, ref, ...rest] = parts;
        if (!owner || !repo || !ref || rest.length === 0) return raw;

        if (mirror) {
            return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${rest.join('/')}`;
        }

        return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest.join('/')}`;
    } catch {
        return raw;
    }
}

export const REMOTE_SOURCES = {
    ADS: {
        name: '广告拦截',
        clash: `${ACL4SSR_BASE}/Clash/Providers/BanAD.yaml`,
        singbox: `${SING_GEOSITE_BASE}/geosite-category-ads-all.srs`,
        surge: `${ACL4SSR_BASE}/Clash/BanAD.list`,
        quanx: `${ACL4SSR_BASE}/Clash/BanAD.list`,
    },
    STREAM: {
        name: '流媒体',
        clash: `${ACL4SSR_BASE}/Clash/Providers/Ruleset/Netflix.yaml`,
        singbox: `${SING_GEOSITE_BASE}/geosite-netflix.srs`,
        surge: `${ACL4SSR_BASE}/Clash/Netflix.list`,
    },
    SOCIAL: {
        name: '社交媒体',
        clash: `${ACL4SSR_BASE}/Clash/Providers/Ruleset/Telegram.yaml`,
        singbox: `${SING_GEOSITE_BASE}/geosite-telegram.srs`,
        surge: `${ACL4SSR_BASE}/Clash/Telegram.list`,
    },
    APPLE: {
        name: '苹果服务',
        clash: `${ACL4SSR_BASE}/Clash/Providers/Ruleset/Apple.yaml`,
        singbox: `${SING_GEOSITE_BASE}/geosite-apple.srs`,
        surge: `${ACL4SSR_BASE}/Clash/Apple.list`,
    },
    MICROSOFT: {
        name: '微软服务',
        clash: `${ACL4SSR_BASE}/Clash/Providers/Ruleset/Microsoft.yaml`,
        singbox: `${SING_GEOSITE_BASE}/geosite-microsoft.srs`,
        surge: `${ACL4SSR_BASE}/Clash/Microsoft.list`,
        quanx: `${ACL4SSR_BASE}/Clash/Microsoft.list`,
    },
    AI: {
        name: '智能 AI',
        clash: `${ACL4SSR_BASE}/Clash/Providers/Ruleset/OpenAi.yaml`,
        singbox: `${SING_GEOSITE_BASE}/geosite-openai.srs`,
        surge: `${ACL4SSR_BASE}/Clash/Ruleset/OpenAi.list`,
        quanx: `${ACL4SSR_BASE}/Clash/Ruleset/OpenAi.list`,
    },
    'geoip-cn': {
        name: 'China IP (GeoIP)',
        singbox: `${SING_GEOIP_BASE}/geoip-cn.srs`,
    },
    [SINGBOX_CN_RULE_SET]: {
        name: 'China Domains (GeoSite)',
        singbox: `${SING_GEOSITE_BASE}/geosite-cn.srs`,
    },
};

/**
 * 分流规则集 (通过 RULE-SET 引用远程源)
 */
export const RULE_SETS = {
    BASE: [
        ...AI_DOMAIN_RULE_LINES,
        'RULE-SET,AI,🤖 智能 AI',
        `DOMAIN-SUFFIX,google.com,${DEFAULT_SELECT_GROUP}`,
        `DOMAIN-KEYWORD,google,${DEFAULT_SELECT_GROUP}`,
        `DOMAIN-SUFFIX,github.com,${DEFAULT_SELECT_GROUP}`,
        'GEOIP,CN,DIRECT',
        `MATCH,${DEFAULT_SELECT_GROUP}`,
    ],
    STD: [
        'RULE-SET,ADS,🎬 视频广告',
        ...AI_DOMAIN_RULE_LINES,
        'RULE-SET,AI,🤖 智能 AI',
        'RULE-SET,STREAM,🎥 流媒体',
        'RULE-SET,APPLE,🍎 Apple',
        'RULE-SET,MICROSOFT,Ⓜ️ Microsoft',
        `DOMAIN-SUFFIX,google.com,${DEFAULT_SELECT_GROUP}`,
        `DOMAIN-SUFFIX,github.com,${DEFAULT_SELECT_GROUP}`,
        'GEOIP,CN,DIRECT',
        `MATCH,${DEFAULT_SELECT_GROUP}`,
    ],
    FULL: [
        'RULE-SET,ADS,🎬 视频广告',
        'RULE-SET,SOCIAL,📲 Telegram',
        ...AI_DOMAIN_RULE_LINES,
        'RULE-SET,AI,🤖 智能 AI',
        'RULE-SET,STREAM,🎥 流媒体',
        'RULE-SET,APPLE,🍎 Apple',
        'RULE-SET,MICROSOFT,Ⓜ️ Microsoft',
        `DOMAIN-SUFFIX,google.com,${DEFAULT_SELECT_GROUP}`,
        `DOMAIN-SUFFIX,github.com,${DEFAULT_SELECT_GROUP}`,
        'GEOIP,CN,DIRECT',
        `MATCH,${DEFAULT_SELECT_GROUP}`,
    ],
    RELAY: [
        'RULE-SET,ADS,🎬 视频广告',
        ...AI_DOMAIN_RULE_LINES,
        'RULE-SET,AI,🤖 智能 AI',
        'RULE-SET,STREAM,🎥 流媒体',
        'RULE-SET,APPLE,🍎 Apple',
        'RULE-SET,MICROSOFT,Ⓜ️ Microsoft',
        `DOMAIN-SUFFIX,google.com,${DEFAULT_RELAY_GROUP}`,
        `DOMAIN-SUFFIX,github.com,${DEFAULT_RELAY_GROUP}`,
        'GEOIP,CN,DIRECT',
        `MATCH,${DEFAULT_RELAY_GROUP}`,
    ],
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
            if (type === 'GEOIP')
                return { type: 'rule_set', tag: `geoip-${value.toLowerCase()}`, outbound: target };
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
    return rawRules.map((l) => translateRuleLine(l, format)).filter(Boolean);
}

/**
 * 为特定的生成器提取远程源定义
 * @param {string} format
 * @param {Array} ruleLines (翻译后的规则行)
 */
export function getRemoteProviderDefinitions(format, ruleLines) {
    const providers = {};
    const usedTags = new Set();

    ruleLines.forEach((line) => {
        if (format === 'clash' && line.type === 'rule-provider') {
            usedTags.add(line.provider);
        } else if ((format === 'singbox' || format === 'sing-box') && line.type === 'rule_set') {
            usedTags.add(line.tag);
        }
    });

    usedTags.forEach((tag) => {
        const source = REMOTE_SOURCES[tag];
        if (!source) return;

        if (format === 'clash') {
            providers[tag] = {
                type: 'http',
                behavior: 'classical',
                url: pinRemoteRuleUrl(source.clash),
                path: `./ruleset/${tag}.yaml`,
                interval: 86400,
            };
        } else if (format === 'singbox' || format === 'sing-box') {
            providers[tag] = {
                tag: tag,
                type: 'remote',
                format: String(source.singbox || '')
                    .toLowerCase()
                    .endsWith('.srs')
                    ? 'binary'
                    : 'source',
                url: pinRemoteRuleUrl(source.singbox),
                update_interval: '24h',
                download_detour: DNS_PROXY_GROUP,
            };
        }
    });

    return providers;
}

export function getSingboxDnsRuleSet() {
    return getRemoteProviderDefinitions('singbox', [
        { type: 'rule_set', tag: SINGBOX_CN_RULE_SET },
    ])[SINGBOX_CN_RULE_SET];
}
