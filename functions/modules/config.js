/**
 * Unified config file.
 * Includes constants, KV keys, and default settings for the worker.
 */

// KV storage keys
export const KV_KEY_SUBS = 'misub_subscriptions_v1';
export const KV_KEY_PROFILES = 'misub_profiles_v1';
export const KV_KEY_GUESTBOOK = 'misub_guestbook_v1';
export const KV_KEY_SETTINGS = 'worker_settings_v1';
export const KV_KEY_VPS_NODES = 'misub_vps_nodes_v1';
export const KV_KEY_VPS_REPORTS = 'misub_vps_reports_v1';
export const KV_KEY_VPS_ALERTS = 'misub_vps_alerts_v1';

// Auth
export const COOKIE_NAME = 'auth_session';
export const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

// Default settings
export const DEFAULT_SETTINGS = {
    FileName: 'MiSub',
    mytoken: 'auto',
    profileToken: 'profiles',
    subConverter: 'url.v1.mk',
    subConfig: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/refs/heads/main/Clash/config/ACL4SSR_Online_Full.ini',
    subConverterScv: false,
    subConverterUdp: false,
    builtinLoonSkipCertVerify: false,
    enableAccessLog: false,
    NotifyThresholdDays: 3,
    NotifyThresholdPercent: 90,
    enableTrafficNode: false,
    enablePublicPage: true,
    storageType: 'kv',
    // 新增：借鉴Sub-Store和miaomiaowu的功能
    enableSubscriptionSync: true,      // 启用订阅同步
    subscriptionCacheExpireMinutes: 60, // 订阅缓存过期时间（分钟）
    enableTrafficMonitor: true,        // 启用流量监控
    enableTemplateEngine: true,        // 启用模板引擎
    enableEnhancedLogging: true,       // 启用增强日志
    ignoreFailedSubscriptions: false,  // 忽略失败的订阅（Sub-Store特性）
    maxSubscriptionConcurrency: 3,     // 最大订阅并发数
    defaultUserAgent: 'clash-meta/2.4.0', // 默认User-Agent
    defaultPrefixSettings: {
        enableManualNodes: true,
        enableSubscriptions: true,
        manualNodePrefix: '手动节点'
    },
    defaultNodeTransform: {
        enabled: false,
        rename: {
            regex: { enabled: false, rules: [] },
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
    },
    vpsMonitor: {
        enabled: true,
        requireSecret: true,
        requireSignature: false,
        signatureClockSkewMinutes: 5,
        offlineThresholdMinutes: 10,
        cpuWarnPercent: 90,
        memWarnPercent: 90,
        diskWarnPercent: 90,
        overloadConfirmCount: 2,
        alertCooldownMinutes: 15,
        networkSampleIntervalMinutes: 5,
        reportIntervalMinutes: 1,
        reportStoreIntervalMinutes: 1,
        networkTargetsLimit: 3,
        publicPageEnabled: false,
        publicPageToken: '',
        publicThemePreset: 'default',
        publicThemeTitle: 'VPS 探针公开视图',
        publicThemeSubtitle: '对外展示节点健康、资源负载与在线率。所有关键指标以清晰、可信的方式汇总呈现。',
        publicThemeLogo: '',
        publicThemeBackgroundImage: '',
        publicThemeShowStats: true,
        publicThemeShowAnomalies: true,
        publicThemeShowFeatured: true,
        publicThemeShowDetailTable: true,
        publicThemeFooterText: '由 MiSub VPS 监控引擎提供实时数据驱动',
        publicPageShowHeader: true,
        publicPageShowFooter: true,
        publicThemeSectionOrder: ['anomalies', 'nodes', 'featured', 'details'],
        publicThemeCustomCss: '',
        alertsEnabled: true,
        notifyOffline: true,
        notifyRecovery: true,
        notifyOverload: true,
        reportRetentionDays: 30,
        cooldownIgnoreRecovery: true
    }
};

// System constants
export const SYSTEM_CONSTANTS = {
    VERSION: '2.0.0-modular-v2',
    // Use v2rayN UA to fetch subscriptions reliably.
    FETCHER_USER_AGENT: 'v2rayN/7.23'
};
