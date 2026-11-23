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

// 国内网络直连 raw.githubusercontent.com 长期不可达。gh-proxy.org 为公开双栈
// GitHub 加速代理，对国内外均可服务：生成订阅时按请求方地理位置（Cloudflare
// request.cf.country）决定规则源下载链路——国内走加速前缀，国外保持直连。
export const GH_PROXY_BASE = 'https://gh-proxy.org/';

/**
 * Mihomo/Clash 内核 geo 数据库镜像。
 *
 * GEOIP/GEOSITE 规则与 DNS nameserver-policy 的 geosite:* 条目依赖客户端本地的
 * geoip/geosite 数据库，默认从 GitHub Releases 下载。大陆网络环境下该下载经常失败，
 * 导致 GEOIP,CN,DIRECT 静默失配、国内流量落入 MATCH 兜底（链式代理场景下全部走代理）。
 * jsDelivr 可直接服务 meta-rules-dat 仓库，与地理位置无关，无需 gh-proxy。
 * mihomo / clash premium 均认识 geox-url 字段，其它内核会忽略该未知字段。
 */
const METARULES_BASE = 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release';
export const GEOX_URLS = Object.freeze({
    geoip: `${METARULES_BASE}/geoip.dat`,
    geosite: `${METARULES_BASE}/geosite.dat`,
    mmdb: `${METARULES_BASE}/country.mmdb`,
    asn: `${METARULES_BASE}/GeoLite2-ASN.mmdb`,
});

/**
 * 解析远程规则源在客户端侧的实际下载地址。
 *
 * - raw.githubusercontent.com 在中国大陆长期无法直连，会导致客户端拉取
 *   RULE-SET 静默失败（路由规则缺失、广告拦截失效、分流错乱）。
 * - jsDelivr 已按合规要求整体封禁 ACL4SSR 仓库（对所有请求返回 403 提示文本），
 *   因此 ACL4SSR 不能再走 jsDelivr：国内请求方使用 gh-proxy.org 加速前缀，
 *   国外请求方保持 raw 直连。是否国内由请求方地理位置决定（request.cf.country）。
 * - 其它仓库（SagerNet / blackmatrix7 等）不受封禁影响，继续走 jsDelivr 镜像。
 *
 * 所有分支均保留「锁定版本」行为：若目标仓库在 PINNED_RULE_REVISIONS 中有固定
 * 修订号，则用固定修订号替换原始分支/标签，避免上游改动导致规则漂移。
 * 注意 jsDelivr 的修订分隔符必须为 @（/gh/USER/REPO@SHA/...）。
 *
 * @param {string} sourceUrl 原始规则源地址
 * @param {Object}  [options]
 * @param {boolean} [options.mirror=true] 非 ACL4SSR 仓库是否启用 jsDelivr 镜像
 * @param {boolean} [options.isChinaClient=false] 请求方是否位于中国大陆
 * @returns {string} 重写后的地址（不满足条件时原样返回）
 */
export function pinRemoteRuleUrl(sourceUrl, options = {}) {
    const { mirror = true, isChinaClient = false } = options;
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

        const pinnedTarget = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest.join('/')}`;

        if (key === 'acl4ssr/acl4ssr') {
            return isChinaClient ? `${GH_PROXY_BASE}${pinnedTarget}` : pinnedTarget;
        }

        if (mirror) {
            return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${rest.join('/')}`;
        }

        return pinnedTarget;
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
        quanx: `${ACL4SSR_BASE}/Clash/Apple.list`,
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
    // 国内域名直连（域名维度）。此前四个内置等级只有 IP 维度的 GEOIP,CN,DIRECT，
    // 在 fake-ip + respect-rules 下依赖客户端先解析出真实 IP，一旦 geo 数据库
    // 下载失败，国内流量会整体落入 MATCH 兜底（链式代理下即走代理）。
    // ACL4SSR ChinaDomain.list 为 classical 文本列表（QuanX/Surge 亦兼容）。
    CN_DOMAIN: {
        name: '国内域名直连',
        clash: `${ACL4SSR_BASE}/Clash/ChinaDomain.list`,
        provider: { behavior: 'classical', format: 'text', ext: 'list' },
        // sing-box 复用 DNS 分流已下载的 geosite-cn 规则集，避免同一文件重复下载
        tag: SINGBOX_CN_RULE_SET,
        singbox: `${SING_GEOSITE_BASE}/geosite-cn.srs`,
        surge: `${ACL4SSR_BASE}/Clash/ChinaDomain.list`,
        quanx: `${ACL4SSR_BASE}/Clash/ChinaDomain.list`,
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
        'RULE-SET,CN_DOMAIN,DIRECT',
        'DOMAIN-SUFFIX,cn,DIRECT',
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
        'RULE-SET,CN_DOMAIN,DIRECT',
        'DOMAIN-SUFFIX,cn,DIRECT',
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
        'RULE-SET,CN_DOMAIN,DIRECT',
        'DOMAIN-SUFFIX,cn,DIRECT',
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
        'RULE-SET,CN_DOMAIN,DIRECT',
        'DOMAIN-SUFFIX,cn,DIRECT',
        'GEOIP,CN,DIRECT',
        `MATCH,${DEFAULT_RELAY_GROUP}`,
    ],
};

/**
 * 翻译逻辑集
 */

// 转换单行规则到目标格式
export function translateRuleLine(line, format, options = {}) {
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
                // 复用声明的 tag（如 CN_DOMAIN → geosite-cn），让 DNS 分流与路由共享同一规则集下载
                return { type: 'rule_set', tag: source.tag || value, outbound: target };
            case 'surge':
            case 'loon':
                // 仅当源提供 Surge/Loon 兼容列表时输出；否则跳过并交给 GEOIP,CN 兜底
                // （如仅 sing-box 使用的 geosite/geoip .srs 源，直接输出会产生无效引用）
                if (!source.surge && !source.clash) return null;
                return `RULE-SET,${pinRemoteRuleUrl(source.surge || source.clash, options)},${target}`;
            case 'quanx':
                // Quantumult X 只认 filter 语法，必须使用显式的 quanx 源，
                // 禁止回退到 clash URL（YAML / 域名集合对 QuanX 是无效输入）
                if (!source.quanx) return null;
                return `filter_remote, ${pinRemoteRuleUrl(source.quanx, options)}, tag=${source.name}, force-policy=${target}, update-interval=86400`;
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
export function getBuiltinRules(level, format, options = {}) {
    const rawRules = RULE_SETS[level.toUpperCase()] || RULE_SETS.STD;
    return rawRules.map((l) => translateRuleLine(l, format, options)).filter(Boolean);
}

/**
 * 为特定的生成器提取远程源定义
 * @param {string} format
 * @param {Array} ruleLines (翻译后的规则行)
 * @param {Object} [options] 含 isChinaClient 等下载链路选项
 */
export function getRemoteProviderDefinitions(format, ruleLines, options = {}) {
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
            // 各规则集的内容形态不同（classical 文本等），
            // behavior 与格式由 REMOTE_SOURCES.provider 元数据声明，避免内核解析失败
            const provider = source.provider || {};
            providers[tag] = {
                type: 'http',
                behavior: provider.behavior || 'classical',
                url: pinRemoteRuleUrl(source.clash, options),
                path: `./ruleset/${tag}.${provider.ext || 'yaml'}`,
                interval: 86400,
                ...(provider.format ? { format: provider.format } : {}),
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
                url: pinRemoteRuleUrl(source.singbox, options),
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
