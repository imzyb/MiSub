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
export const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
export const DEFAULT_SUBCONVERTER_BACKEND = 'subapi.cmliussss.net';

// Default settings
export const DEFAULT_SETTINGS = {
    FileName: 'MiSub',
    mytoken: 'auto',
    profileToken: 'profiles',
    transformConfigMode: 'builtin',
    transformConfig: '',
    ruleLevel: 'std',
    builtinSkipCertVerify: false,
    builtinEnableUdp: true,
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
        manualNodePrefix: '手动节点',
        prependGroupName: false
    },
    defaultOperators: [], // 新版操作符链式处理 (New Unified Pipeline)
    regionOverrides: [], // 自定义节点地区覆盖规则：{ pattern, region, flags }
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
        enabled: false,
        allowAnonymous: true
    },
    // 自定义公开页设置
    customPage: {
        enabled: false,           // 是否启用自定义页面
        type: 'html',            // 页面渲染方式
        content: '',             // 页面代码内容
        css: '',                 // 自定义全局样式
        useDefaultLayout: true,  // 是否包裹在默认的基础布局中 (包含背景、容器等)
        allowExternalStylesheets: false, // 是否允许加载 HTML 源码中的外链样式表
        allowScripts: false,     // 是否允许执行 HTML 源码中的 script
        hideBranding: false,     // 是否隐藏公开页中的 MiSub 品牌标识
        hideHeader: false,       // 自定义公开页是否隐藏全局页头
        hideFooter: false        // 自定义公开页是否隐藏全局页脚
    },
    webdavBackup: {
        enabled: false,
        endpoint: '',
        username: '',
        password: '',
        remotePath: '/MiSub',
        filenameTemplate: 'misub-backup-{datetime}.json',
        backupScope: 'dataOnly',
        autoBackup: false,
        interval: 'daily',
        retentionCount: 7,
        lastCheckedAt: null,
        lastBackupAt: null,
        lastBackupStatus: null,
        lastBackupMessage: '',
        lastBackupFile: ''
    },
    externalApi: {
        enabled: false,
        tokens: [
            {
                name: 'default',
                token: ''
            }
        ]
    },
    // 订阅转换设置
    subconverter: {
        engineMode: "builtin",
        defaultBackend: DEFAULT_SUBCONVERTER_BACKEND,
        defaultOptions: {
            udp: true,
            emoji: true,
            scv: true,
            tfo: false,
            sort: false,
            list: false
        }
    }
};

// System constants
export const SYSTEM_CONSTANTS = {
    VERSION: '2.7.0',
    // Use v2rayN UA to fetch subscriptions reliably.
    FETCHER_USER_AGENT: 'v2rayN/7.23'
};
