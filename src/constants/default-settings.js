/**
 * Default settings constants.
 * @author MiSub Team
 */

export const DEFAULT_SETTINGS = {
    FileName: 'MiSub',
    mytoken: 'auto',
    profileToken: 'profiles',
    subConverter: 'url.v1.mk',
    subConfig: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/refs/heads/main/Clash/config/ACL4SSR_Online_Full.ini',
    subConverterScv: false,
    subConverterUdp: false,
    builtinLoonSkipCertVerify: false,
    NotifyThresholdDays: 3,
    NotifyThresholdPercent: 90,
    enableTrafficNode: false,
    enablePublicPage: true,
    storageType: 'kv',
    autoUpdateInterval: 0, // 分钟，0表示禁用自动更新
defaultPrefixSettings: {
enableManualNodes: true,
enableSubscriptions: true,
manualNodePrefix: '\u624b\u52a8\u8282\u70b9',
prependGroupName: false
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
                { key: 'region', order: 'asc', customOrder: ['\u9999\u6e2f', '\u53f0\u6e7e', '\u65e5\u672c', '\u65b0\u52a0\u5761', '\u7f8e\u56fd', '\u97e9\u56fd', '\u82f1\u56fd', '\u5fb7\u56fd', '\u6cd5\u56fd', '\u52a0\u62ff\u5927'] },
                { key: 'protocol', order: 'asc', customOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] },
                { key: 'name', order: 'asc' }
            ]
        }
    },
    // 公告设置
    announcement: {
        enabled: false,           // 是否启用公告
        title: '',                // 公告标题
        content: '',              // 公告内容（支持富文本/Markdown）
        type: 'info',             // 类型: 'info' | 'warning' | 'success'
        dismissible: true,        // 是否可关闭
        updatedAt: null           // 更新时间
    },
    // 留言板设置
    guestbook: {
        enabled: false,
        allowAnonymous: true
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

export const DEFAULT_NODE_FORM = {
    name: '',
    url: '',
    enabled: true,
    fetchProxy: ''
};

export const DEFAULT_PROFILE_FORM = {
    name: '',
    customId: '',
    subConverter: '',
    subConfig: '',
    subscriptions: [],
    manualNodes: [],
    enabled: true,
prefixSettings: {
enableManualNodes: true,
enableSubscriptions: true,
manualNodePrefix: '\u624b\u52a8\u8282\u70b9',
prependGroupName: null
}
};
