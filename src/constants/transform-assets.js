export const TRANSFORM_ASSETS = {
    configs: [
        {
            id: 0,
            name: 'MiSub 内置 极简默认分流',
            url: 'builtin:clash_misub_minimal',
            group: 'MiSub Builtin',
            is_default: false,
            sourceType: 'builtin-preset',
            recommendedFor: ['clash', 'singbox', 'surge', 'loon', 'quanx'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta', 'singbox', 'surge', 'loon', 'quanx'],
            strategy: 'model-driven',
            description: 'MiSub 自带的更轻量极简模板，适合日常通用和小白直接使用。'
        },
        {
            id: 1,
            name: 'MiSub 内置 ACL4SSR 精简分流',
            url: 'builtin:clash_acl4ssr_lite',
            group: 'MiSub Builtin',
            is_default: true,
            sourceType: 'builtin-preset',
            recommendedFor: ['clash', 'singbox', 'surge', 'loon', 'quanx'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta', 'singbox', 'surge', 'loon', 'quanx'],
            strategy: 'model-driven',
            description: '内置精简 ACL4SSR 分流模板，适合作为更轻量的默认内置转换配置。'
        },
        {
            id: 2,
            name: 'MiSub 内置 流媒体与 AI 分流',
            url: 'builtin:clash_misub_media_ai',
            group: 'MiSub Builtin',
            is_default: false,
            sourceType: 'builtin-preset',
            recommendedFor: ['clash', 'singbox', 'surge', 'loon', 'quanx'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta', 'singbox', 'surge', 'loon', 'quanx'],
            strategy: 'model-driven',
            description: '面向流媒体和 AI 服务使用场景的内置模板，保留核心分流和地区候选链。'
        },
        {
            id: 3,
            name: 'MiSub 内置 ACL4SSR 完整分流',
            url: 'builtin:clash_acl4ssr_full',
            group: 'MiSub Builtin',
            is_default: false,
            sourceType: 'builtin-preset',
            recommendedFor: ['clash', 'singbox'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta', 'singbox'],
            strategy: 'model-driven',
            description: '内置完整 ACL4SSR 分流模板，可通过统一模板模型生成 Clash 与 Sing-Box 配置。'
        },
        {
            id: 101,
            name: 'CM_Online 默认版 识别港美地区(与Github同步)',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online.ini',
            group: 'ACL4SSR',
            is_default: true,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            description: '经典 ACL4SSR 规则，适合 Clash 系列客户端。'
        },
        {
            id: 102,
            name: 'CM_Online_MultiCountry 识别港美地区 负载均衡(与Github同步)',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            description: '适合需要多地区自动分组和负载均衡的 Clash 用户。'
        },
        {
            id: 103,
            name: 'CM_Online_MultiCountry_CF 识别港美地区、CloudFlareCDN 负载均衡 Worker节点专用(与Github同步)',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry_CF.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            description: 'Cloudflare Worker 节点场景专用的 Clash 预设。'
        },
        {
            id: 104,
            name: 'CM_Online_Full 识别多地区分组(与Github同步)',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            description: '规则更完整，分组更细，适合作为 Clash 进阶预设。'
        },
        {
            id: 105,
            name: 'CM_Online_Full_CF 识别多地区、CloudFlareCDN 分组 Worker节点专用(与Github同步)',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_CF.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            description: '面向 Worker/CDN 线路的完整 Clash 预设。'
        },
        {
            id: 106,
            name: 'CM_Online_Full_MultiMode 识别多地区 负载均衡(与Github同步)',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            description: '适合需要完整规则和多模式分组的 Clash 用户。'
        },
        {
            id: 107,
            name: 'CM_Online_Full_MultiMode_CF 识别多地区、CloudFlareCDN 负载均衡 Worker节点专用(与Github同步)',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode_CF.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            description: '完整多模式的 Worker/CDN Clash 预设。'
        }
    ]
};

export function getTransformAssetByUrl(url) {
    return TRANSFORM_ASSETS.configs.find(item => item.url === url) || null;
}

export function isBuiltinTransformAssetUrl(url) {
    return typeof url === 'string' && url.startsWith('builtin:');
}
