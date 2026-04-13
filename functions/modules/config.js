/**
 * Unified config file.
 * Includes constants, KV keys, and default settings for the worker.
 */

// KV storage keys
export const KV_KEY_SUBS = 'misub_subscriptions_v1';
export const KV_KEY_PROFILES = 'misub_profiles_v1';
export const KV_KEY_GUESTBOOK = 'misub_guestbook_v1';
export const KV_KEY_SETTINGS = 'worker_settings_v1';

// Auth
export const COOKIE_NAME = 'auth_session';
export const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

// Default settings
export const DEFAULT_SETTINGS = {
    FileName: 'MiSub',
    mytoken: 'auto',
    profileToken: 'profiles',
    transformConfigMode: 'builtin',
    transformConfig: '',
    ruleLevel: 'std',
    builtinSkipCertVerify: false,
    builtinEnableUdp: false,
    builtinLoonSkipCertVerify: false,
    enableAccessLog: false,
    accessLogPersistenceMode: 'light',
    NotifyThresholdDays: 3,
    NotifyThresholdPercent: 90,
    enableTrafficNode: false,
    enableFlagEmoji: true,
    enablePublicPage: true,
    storageType: 'kv',
    // 新增：借鉴Sub-Store和miaomiaowu的功能
    enableSubscriptionSync: true,      // 启用订阅同步
    subscriptionCacheExpireMinutes: 60, // 订阅缓存过期时间（分钟）
    enableTrafficMonitor: true,        // 启用流量监控
    enableTemplateEngine: true,        // 启用模板引擎
    enableEnhancedLogging: true,       // 启用增强日志
    maxSubscriptionConcurrency: 3,     // 最大订阅并发数
    defaultUserAgent: 'clash-meta/2.5.0', // 默认User-Agent
    defaultPrefixSettings: {
        enableManualNodes: true,
        enableSubscriptions: true,
        manualNodePrefix: '手动节点'
    },
    defaultOperators: [], // 新版操作符链式处理 (New Unified Pipeline)
    // @deprecated 使用 defaultOperators 代替
    defaultNodeTransform: {
        enabled: false,
        filter: {
            include: { enabled: false, rules: [] },
            exclude: { enabled: false, rules: [] },
            protocols: { enabled: false, values: [] },
            regions: { enabled: false, values: [] },
            script: { enabled: false, expression: '' },
            useless: { enabled: false }
        },
        rename: {
            regex: { enabled: false, rules: [] },
            script: { enabled: false, expression: '' },
            template: {
                enabled: false,
                template: '{emoji}{region}-{protocol}-{index}',
                indexStart: 1,
                indexPad: 2,
                indexScope: 'regionProtocol',
                regionAlias: {},
                protocolAlias: { hysteria2: 'hy2' }
            }
        },
        dedup: {
            enabled: false,
            mode: 'serverPort',
            includeProtocol: false,
            prefer: { protocolOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] }
        },
        sort: {
            enabled: false,
            nameIgnoreEmoji: true,
            keys: [
                { key: 'region', order: 'asc', customOrder: ['香港', '台湾', '日本', '新加坡', '美国', '韩国', '英国', '德国', '法国', '加拿大'] },
                { key: 'protocol', order: 'asc', customOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] },
                { key: 'name', order: 'asc' }
            ]
        }
    },
    nodeTransformPresets: [],
    // 公告设置
    announcement: {
        enabled: false,
        title: '',
        content: '',
        type: 'info',
        dismissible: true,
        updatedAt: null
    },
    // 留言板设置
    guestbook: {
        enabled: false,           // 总开关
        allowAnonymous: true      // 是否允许匿名
    }
};

// System constants
export const SYSTEM_CONSTANTS = {
    VERSION: '2.5.0',
    // Use v2rayN UA to fetch subscriptions reliably.
    FETCHER_USER_AGENT: 'v2rayN/7.23'
};
