import yaml from 'js-yaml';

export const DNS_MODES = Object.freeze({
    CLEAN: 'clean',
    POLLUTED: 'polluted',
});

export const DNS_PROXY_GROUP = '🌐 DNS 出口';
export const SINGBOX_CN_RULE_SET = 'geosite-cn';

export const DEFAULT_DNS_POLICY = Object.freeze({
    domestic: ['223.5.5.5', '119.29.29.29'],
    foreign: ['udp://8.8.8.8:53', 'udp://1.1.1.1:53'],
    polluted: ['https://8.8.8.8/dns-query', 'https://1.1.1.1/dns-query'],
});

const SAFE_DNS_FIELDS = [
    'cache-algorithm',
    'fake-ip-range',
    'fake-ip-filter-mode',
    'fake-ip-ttl',
    'use-hosts',
    'use-system-hosts',
];

const DNS_HOST_PATTERN =
    /^(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}|(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:]+\])$/i;
const DNS_SCHEME_PATTERN = /^(?:udp|tcp|tls|https):\/\//i;

function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value))
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
}

function parseOverride(raw) {
    if (isObject(raw)) return raw;
    if (typeof raw !== 'string' || !raw.trim()) return {};

    try {
        const parsed = yaml.load(raw.trim());
        if (!isObject(parsed)) return {};
        return isObject(parsed.dns) ? parsed.dns : parsed;
    } catch {
        return {};
    }
}

function normalizeMode(value) {
    return String(value || '')
        .trim()
        .toLowerCase() === DNS_MODES.POLLUTED
        ? DNS_MODES.POLLUTED
        : DNS_MODES.CLEAN;
}

function resolverHost(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.includes('#') || raw === 'system') return raw === 'system' ? raw : '';

    const candidate = DNS_SCHEME_PATTERN.test(raw) ? raw : `udp://${raw}`;
    try {
        const parsed = new URL(candidate);
        const host = parsed.hostname.replace(/^\[|\]$/g, '');
        if (!DNS_HOST_PATTERN.test(parsed.hostname)) return '';
        if (host === 'localhost' || host === '::1' || /^127\./.test(host) || /^0\./.test(host))
            return '';
        return raw;
    } catch {
        return '';
    }
}

function resolverList(value, fallback) {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const normalized = values.map(resolverHost).filter(Boolean);
    return normalized.length > 0 ? normalized : [...fallback];
}

function plainResolver(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'system') return '';

    const candidate = DNS_SCHEME_PATTERN.test(raw) ? raw : `udp://${raw}`;
    try {
        const parsed = new URL(candidate);
        const host = parsed.hostname.replace(/^\[|\]$/g, '');
        if (!DNS_HOST_PATTERN.test(parsed.hostname)) return '';
        const formattedHost = host.includes(':') ? `[${host}]` : host;
        return `udp://${formattedHost}:53`;
    } catch {
        return '';
    }
}

function policyInput(override) {
    return isObject(override.policy) ? { ...override, ...override.policy } : override;
}

export function resolveDnsPolicy(raw, options = {}) {
    const override = parseOverride(raw);
    const input = policyInput(override);
    const mode = normalizeMode(options.mode || input.mode || input['dns-mode']);

    const foreign = resolverList(
        input.foreign ||
            input.foreignNameservers ||
            input['foreign-nameserver'] ||
            input.nameserver,
        DEFAULT_DNS_POLICY.foreign
    );
    const plainForeign =
        mode === DNS_MODES.CLEAN ? foreign.map(plainResolver).filter(Boolean) : foreign;

    return {
        mode,
        domestic: resolverList(
            input.domestic ||
                input.domesticNameservers ||
                input['domestic-nameserver'] ||
                input['default-nameserver'],
            DEFAULT_DNS_POLICY.domestic
        ),
        foreign: plainForeign.length > 0 ? plainForeign : [...DEFAULT_DNS_POLICY.foreign],
        polluted: resolverList(
            input.polluted ||
                input.pollutedNameservers ||
                input['polluted-nameserver'] ||
                input.fallback,
            DEFAULT_DNS_POLICY.polluted
        ),
    };
}

function withProxy(value, proxyGroup) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'system') return raw;
    return `${raw}#${proxyGroup}`;
}

function cloneResolverPolicy(policy) {
    return {
        mode: policy.mode,
        domestic: [...policy.domestic],
        foreign: [...policy.foreign],
        polluted: [...policy.polluted],
    };
}

export const DEFAULT_DNS_CONFIG = {
    enable: true,
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-filter-mode': 'blacklist',
    'fake-ip-filter': [
        'geosite:private',
        'geosite:category-ntp',
        '*.lan',
        '*.local',
        'localhost',
        '*.arpa',
    ],
    'use-hosts': true,
    'use-system-hosts': true,
    'respect-rules': true,
    'default-nameserver': [...DEFAULT_DNS_POLICY.domestic],
    nameserver: DEFAULT_DNS_POLICY.foreign.map((value) => withProxy(value, DNS_PROXY_GROUP)),
    'nameserver-policy': {
        'geosite:private': [...DEFAULT_DNS_POLICY.domestic],
        'geosite:cn': [...DEFAULT_DNS_POLICY.domestic],
        'geosite:geolocation-!cn': DEFAULT_DNS_POLICY.foreign.map((value) =>
            withProxy(value, DNS_PROXY_GROUP)
        ),
    },
    'proxy-server-nameserver': [...DEFAULT_DNS_POLICY.domestic],
    'direct-nameserver': [...DEFAULT_DNS_POLICY.domestic],
    'direct-nameserver-follow-policy': true,
    fallback: [],
    'fallback-filter': {
        geoip: true,
        'geoip-code': 'CN',
        ipcidr: ['240.0.0.0/4', '0.0.0.0/32', '127.0.0.0/8', '100.64.0.0/10'],
    },
};

export function isExplicitDnsBlock(override) {
    if (!isObject(override)) return false;
    return (
        override.enable !== undefined ||
        override['enhanced-mode'] !== undefined ||
        override['proxy-server-nameserver'] !== undefined ||
        (Array.isArray(override.nameserver) && isObject(override['nameserver-policy']))
    );
}

/**
 * 判断解析后的 DNS 配置是否引用了指定策略组。
 *
 * mihomo 用 `nameserver: <server>#<策略组>` 的形式让 DNS 经由该组拨号；mihomo 的
 * DNS dialer 只认 `Proxies()` 里的名字，认不到就把这段文字当成网卡名
 * （`dialer.WithInterface`），DNS 出口就不再是我们声明的策略组（在 Linux 上
 * 这类拨号会直接失败）。生成器因此按"是否真的引用了该组"决定保留 DNS 出口组。
 *
 * 引用判定按 `#` 之后的完整片段做精确比较：`#组名` 或 `#组名&参数` 才算引用，
 * `#组名-other` 这种前缀相似的组名不算。
 * @param {*} config - 解析后的 DNS 配置（对象/数组/字符串）
 * @param {string} groupName - 目标策略组名
 * @returns {boolean}
 */
export function dnsConfigUsesProxyGroup(config, groupName) {
    const target = String(groupName || '').trim();
    if (!target) return false;

    const matches = (value) => {
        const hashIndex = value.indexOf('#');
        if (hashIndex < 0) return false;
        const fragment = value.slice(hashIndex + 1).trim();
        return fragment === target || fragment.startsWith(`${target}&`);
    };

    const visit = (value) => {
        if (typeof value === 'string') return matches(value.trim());
        if (Array.isArray(value)) return value.some(visit);
        if (isObject(value)) return Object.values(value).some(visit);
        return false;
    };

    return visit(config);
}

export function resolveSafeDnsConfig(raw, options = {}) {
    const rawOverride = parseOverride(raw);
    if (isExplicitDnsBlock(rawOverride)) {
        return clone(rawOverride);
    }

    const policy = resolveDnsPolicy(raw, options);
    const proxyGroup = String(options.proxyGroup || DNS_PROXY_GROUP);
    const foreign = policy.mode === DNS_MODES.POLLUTED ? policy.polluted : policy.foreign;
    const dns = clone(DEFAULT_DNS_CONFIG);

    dns['default-nameserver'] = [...policy.domestic];
    dns.nameserver = foreign.map((value) => withProxy(value, proxyGroup));
    // 顺序敏感：mihomo 的 nameserver-policy 取**第一条命中**的策略。
    // `geosite:geolocation-!cn` 必须排在 `geosite:cn` 之前——geosite 里有一批海外域名
    // 被同时收进 CN 分类（例如 browserleaks.com，mihomo 自带的 GeoSite.dat 同时把它
    // 列在 CN 与 GEOLOCATION-!CN 中）。CN 放前面会让这些海外站点走国内明文 DNS，
    // 在运营商劫持明文 53 的线路上，权威侧看到的就是运营商递归 → 检测站判定 DNS 泄露。
    dns['nameserver-policy'] = {
        'geosite:private': [...policy.domestic],
        'geosite:geolocation-!cn': foreign.map((value) => withProxy(value, proxyGroup)),
        'geosite:cn': [...policy.domestic],
        ...options.subscriptionDnsPolicies?.reduce((acc, item) => {
            if (item && item.policy && isObject(item.policy)) {
                Object.assign(acc, item.policy);
            } else if (item && item.domains && item.nameservers) {
                acc[item.domains] = item.nameservers;
            }
            return acc;
        }, {}),
    };
    dns['proxy-server-nameserver'] = [...policy.domestic];
    dns['direct-nameserver'] = [...policy.domestic];
    dns.fallback =
        policy.mode === DNS_MODES.POLLUTED
            ? foreign.map((value) => withProxy(value, proxyGroup))
            : [];

    const override = policyInput(rawOverride);
    SAFE_DNS_FIELDS.forEach((key) => {
        if (override[key] === undefined) return;
        if (
            key === 'fake-ip-filter-mode' &&
            !['blacklist', 'whitelist', 'rule'].includes(String(override[key]))
        )
            return;
        if (['use-hosts', 'use-system-hosts'].includes(key)) {
            dns[key] = Boolean(override[key]);
            return;
        }
        if (key === 'fake-ip-filter') {
            if (
                Array.isArray(override[key]) &&
                override[key].every((item) => typeof item === 'string')
            ) {
                dns[key] = [...override[key]];
            }
            return;
        }
        if (typeof override[key] === 'string' || typeof override[key] === 'number')
            dns[key] = override[key];
    });

    dns.enable = true;
    dns.ipv6 = false;
    dns['enhanced-mode'] = 'fake-ip';
    dns['respect-rules'] = true;
    return dns;
}

function parseSingboxResolver(value, tag, detour) {
    const raw = String(value || '').trim();
    const candidate = DNS_SCHEME_PATTERN.test(raw) ? raw : `udp://${raw}`;
    const parsed = new URL(candidate);
    const type = parsed.protocol.slice(0, -1);
    const server = parsed.hostname.replace(/^\[|\]$/g, '');
    const serverPort = Number(parsed.port) || (type === 'https' ? 443 : type === 'tls' ? 853 : 53);
    const result = { tag, type, server, server_port: serverPort };
    // 实测 sing-box 1.14.4 拒绝 detour 指向空的 direct 出站（start dns-transport 直接 FATAL），
    // 而省略 detour 本身就等价于直连，所以国内 DNS 不写 `detour: DIRECT`。
    if (detour && detour !== 'DIRECT') result.detour = detour;
    if (type === 'https') result.path = parsed.pathname || '/dns-query';
    if (type === 'tls') result.tls = { enabled: true, server_name: server };
    return result;
}

export function buildSingboxDnsConfig(raw, options = {}) {
    const policy = resolveDnsPolicy(raw, options);
    const proxyGroup = String(options.proxyGroup || DNS_PROXY_GROUP);
    const foreign = policy.mode === DNS_MODES.POLLUTED ? policy.polluted : policy.foreign;
    const domesticServers = policy.domestic.map((value, index) =>
        parseSingboxResolver(value, `dns-cn-${index + 1}`, 'DIRECT')
    );
    const foreignServers = foreign.map((value, index) =>
        parseSingboxResolver(value, `dns-foreign-${index + 1}`, proxyGroup)
    );
    const domesticTag = domesticServers[0]?.tag || 'dns-cn-1';
    const foreignTag = foreignServers[0]?.tag || 'dns-foreign-1';

    return {
        strategy: 'prefer_ipv4',
        servers: [...domesticServers, ...foreignServers],
        rules: [
            { rule_set: [SINGBOX_CN_RULE_SET], action: 'route', server: domesticTag },
            { domain_suffix: ['.cn', '.lan', '.local'], action: 'route', server: domesticTag },
        ],
        final: foreignTag,
    };
}

export function cloneDnsPolicy(raw, options = {}) {
    return cloneResolverPolicy(resolveDnsPolicy(raw, options));
}
