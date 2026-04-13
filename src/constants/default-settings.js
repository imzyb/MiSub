/**
 * Default settings constants.
 * @author MiSub Team
 */

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
                { key: 'region', order: 'asc', customOrder: ['\u9999\u6e2f', '\u53f0\u6e7e', '\u65e5\u672c', '\u65b0\u52a0\u5761', '\u7f8e\u56fd', '\u97e9\u56fd', '\u82f1\u56fd', '\u5fb7\u56fd', '\u6cd5\u56fd', '\u52a0\u62ff\u5927'] },
                { key: 'protocol', order: 'asc', customOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] },
                { key: 'name', order: 'asc' }
            ]
        }
    },
    nodeTransformPresets: [],
    // 公告设置
    announcement: {
        enabled: true,            // 是否启用公告
        title: '2.5 版本更新说明', // 公告标题
        content: '为降低 Cloudflare D1 / KV 免费额度超限的风险，本版本已进行一系列优化：<br><br>• 移除 VPS 探针功能<br>• 内置订阅转换能力，不再依赖第三方转换服务<br>• 优化数据结构与读写逻辑<br>• 降低高频请求场景下的存储与缓存压力<br><br>本次更新主要聚焦于项目的长期稳定运行与免费额度控制。', // 公告内容（支持富文本/Markdown）
        type: 'info',             // 类型: 'info' | 'warning' | 'success'
        dismissible: true,        // 是否可关闭
        updatedAt: '2026-04-13T00:00:00.000Z' // 更新时间
    },
    // 留言板设置
    guestbook: {
        enabled: false,
        allowAnonymous: true
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
    transformConfigMode: 'global',
    transformConfig: '',
    ruleLevel: '', // 为空表示跟随全局配置
    subscriptions: [],
    manualNodes: [],
    enabled: true,
prefixSettings: {
enableManualNodes: true,
enableSubscriptions: true,
manualNodePrefix: '\u624b\u52a8\u8282\u70b9',
prependGroupName: null
},
nodeTransform: null,
nodeTransformPresetId: ''
};
