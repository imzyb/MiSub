/**
 * 订阅格式常量
 * @author MiSub Team
 */

export const SUBSCRIPTION_FORMATS = {
    BASE64: 'base64',
    CLASH: 'clash',
    SURGE: 'surge',
    LOON: 'loon',
    QUANX: 'quanx',
    SINGBOX: 'singbox'
};

export const NODE_PROTOCOLS = {
    SS: 'ss',
    SSR: 'ssr',
    VMESS: 'vmess',
    VLESS: 'vless',
    TROJAN: 'trojan',
    HYSTERIA2: 'hysteria2',
    HY2: 'hy2',
    HY: 'hy',
    TUIC: 'tuic',
    ANYTLS: 'anytls',
    SOCKS5: 'socks5'
};

export const USER_AGENT_MAPPING = [
    // Mihomo/Meta 核心的客户端 - 需要clash格式
    ['flyclash', SUBSCRIPTION_FORMATS.CLASH],
    ['mihomo', SUBSCRIPTION_FORMATS.CLASH],
    ['clash.meta', SUBSCRIPTION_FORMATS.CLASH],
    ['clash-verge', SUBSCRIPTION_FORMATS.CLASH],
    ['meta', SUBSCRIPTION_FORMATS.CLASH],

    // 其他客户端
    ['stash', SUBSCRIPTION_FORMATS.CLASH],
    ['nekoray', SUBSCRIPTION_FORMATS.CLASH],
    ['sing-box', SUBSCRIPTION_FORMATS.SINGBOX],
    ['shadowrocket', SUBSCRIPTION_FORMATS.BASE64],
    ['v2rayn', SUBSCRIPTION_FORMATS.BASE64],
    ['v2rayng', SUBSCRIPTION_FORMATS.BASE64],
    ['surge', SUBSCRIPTION_FORMATS.SURGE],
    ['loon', SUBSCRIPTION_FORMATS.LOON],
    ['quantumult%20x', SUBSCRIPTION_FORMATS.QUANX],
    ['quantumult', SUBSCRIPTION_FORMATS.QUANX],

    // 最后才匹配通用的 clash，作为向下兼容
    ['clash', SUBSCRIPTION_FORMATS.CLASH]
];
