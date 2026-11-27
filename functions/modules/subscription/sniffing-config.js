/**
 * 客户端域名嗅探（sniffer）默认配置。
 *
 * 背景：Telegram、Google 系等应用常硬编码 IP 直连，连接不含域名，
 * 纯域名分流规则与 GEOIP 前的域名规则都无法命中，只能落进兜底代理。
 * 开启嗅探后从 TLS SNI / HTTP Host / QUIC 握手还原域名，此类流量即可
 * 命中域名分流规则；sing-box 对应 route 首条 { action: 'sniff' } 规则。
 *
 * 注意（mihomo issue #374）：override-destination 对个别强绑定 IP 的服务
 * 有误判风险，通过 skip-domain 排除米家局域网发现与 APNs 推送。
 */

export const DEFAULT_SNIFFER_CONFIG = Object.freeze({
    enable: true,
    // 对 redir-host 类型流量与无域名连接强制嗅探
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': true,
    sniff: {
        TLS: { ports: [443, 8443] },
        HTTP: { ports: [80, '8080-8880'], 'override-destination': true },
        QUIC: { ports: [443] },
    },
    'skip-domain': ['Mijia Cloud', '+.push.apple.com'],
});

export const SINGBOX_SNIFF_RULE = Object.freeze({ action: 'sniff' });
