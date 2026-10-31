export function createUnifiedTemplateModel(input = {}) {
    return {
        meta: {
            name: input.meta?.name || 'MiSub',
            source: input.meta?.source || 'builtin',
            target: input.meta?.target || 'clash',
            ruleLevel: input.meta?.ruleLevel || 'std',
            // 客户端内核能力标记：仅 Mihomo/Meta 支持节点级 dialer-proxy（链式代理）。
            isMeta: Boolean(input.meta?.isMeta),
        },
        proxies: Array.isArray(input.proxies) ? input.proxies : [],
        groups: Array.isArray(input.groups) ? input.groups : [],
        rules: Array.isArray(input.rules) ? input.rules : [],
        settings: {
            managedConfigUrl: input.settings?.managedConfigUrl || '',
            interval: input.settings?.interval || 86400,
            skipCertVerify: Boolean(input.settings?.skipCertVerify),
            enableUdp: Boolean(input.settings?.enableUdp),
            customDnsOverride: input.settings?.customDnsOverride || '',
            dnsMode: input.settings?.dnsMode || 'clean',
        },
        extras: typeof input.extras === 'object' && input.extras !== null ? input.extras : {},
    };
}

export function normalizeUnifiedTemplateModel(model = {}) {
    return createUnifiedTemplateModel(model);
}
