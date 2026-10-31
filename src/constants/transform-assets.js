/**
 * 订阅转换模板资产清单。
 *
 * ⚠️ 这里只存 i18n **key**（nameKey / descriptionKey），不存文案本身。
 *
 * 原因是这个文件是模块级常量：整个对象在应用启动时求值一次。
 * 如果直接在这里写 `t('...')`，切换语言后下拉框里的模板名称会一直停在
 * 启动时那种语言 —— 而用户根本不会重启应用。
 *
 * 想拿当前语言的文案，用下面的 localizeTransformAsset / getLocalizedTransformAssets，
 * 并且**必须在 computed 里调用**：computed 求值时会读到 locale.value，
 * 从而建立响应式依赖，切换语言即时更新。
 *
 * url / group / sourceType 等字段是逻辑标识，不参与翻译，保持原样。
 */
export const TRANSFORM_ASSETS = {
    configs: [
        {
            id: 0,
            nameKey: 'transformAssets.builtinMinimal.name',
            url: 'builtin:clash_misub_minimal',
            group: 'MiSub Builtin',
            is_default: true,
            sourceType: 'builtin-preset',
            recommendedFor: ['clash', 'singbox', 'surge', 'loon', 'quanx'],
            compatibleClients: [
                'clash',
                'mihomo',
                'clash-meta',
                'singbox',
                'surge',
                'loon',
                'quanx',
            ],
            strategy: 'model-driven',
            descriptionKey: 'transformAssets.builtinMinimal.description',
        },
        {
            id: 1,
            nameKey: 'transformAssets.acl4ssrLite.name',
            url: 'builtin:clash_acl4ssr_lite',
            group: 'MiSub Builtin',
            is_default: false,
            sourceType: 'builtin-preset',
            recommendedFor: ['clash', 'singbox', 'surge', 'loon', 'quanx'],
            compatibleClients: [
                'clash',
                'mihomo',
                'clash-meta',
                'singbox',
                'surge',
                'loon',
                'quanx',
            ],
            strategy: 'model-driven',
            descriptionKey: 'transformAssets.acl4ssrLite.description',
        },
        {
            id: 2,
            nameKey: 'transformAssets.mediaAi.name',
            url: 'builtin:clash_misub_media_ai',
            group: 'MiSub Builtin',
            is_default: false,
            sourceType: 'builtin-preset',
            recommendedFor: ['clash', 'singbox', 'surge', 'loon', 'quanx'],
            compatibleClients: [
                'clash',
                'mihomo',
                'clash-meta',
                'singbox',
                'surge',
                'loon',
                'quanx',
            ],
            strategy: 'model-driven',
            descriptionKey: 'transformAssets.mediaAi.description',
        },
        {
            id: 3,
            nameKey: 'transformAssets.acl4ssrFull.name',
            url: 'builtin:clash_acl4ssr_full',
            group: 'MiSub Builtin',
            is_default: false,
            sourceType: 'builtin-preset',
            recommendedFor: ['clash', 'singbox'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta', 'singbox'],
            strategy: 'model-driven',
            descriptionKey: 'transformAssets.acl4ssrFull.description',
        },
        {
            id: 101,
            nameKey: 'transformAssets.cmOnlineDefault.name',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online.ini',
            group: 'ACL4SSR',
            is_default: true,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            descriptionKey: 'transformAssets.cmOnlineDefault.description',
        },
        {
            id: 102,
            nameKey: 'transformAssets.cmOnlineMultiCountry.name',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            descriptionKey: 'transformAssets.cmOnlineMultiCountry.description',
        },
        {
            id: 103,
            nameKey: 'transformAssets.cmOnlineMultiCountryCf.name',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry_CF.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            descriptionKey: 'transformAssets.cmOnlineMultiCountryCf.description',
        },
        {
            id: 104,
            nameKey: 'transformAssets.cmOnlineFull.name',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            descriptionKey: 'transformAssets.cmOnlineFull.description',
        },
        {
            id: 105,
            nameKey: 'transformAssets.cmOnlineFullCf.name',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_CF.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            descriptionKey: 'transformAssets.cmOnlineFullCf.description',
        },
        {
            id: 106,
            nameKey: 'transformAssets.cmOnlineFullMultiMode.name',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            descriptionKey: 'transformAssets.cmOnlineFullMultiMode.description',
        },
        {
            id: 107,
            nameKey: 'transformAssets.cmOnlineFullMultiModeCf.name',
            url: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode_CF.ini',
            group: 'ACL4SSR',
            is_default: false,
            sourceType: 'preset',
            recommendedFor: ['clash'],
            compatibleClients: ['clash', 'mihomo', 'clash-meta'],
            strategy: 'external-first',
            descriptionKey: 'transformAssets.cmOnlineFullMultiModeCf.description',
        },
    ],
};

export function getTransformAssetByUrl(url) {
    return TRANSFORM_ASSETS.configs.find((item) => item.url === url) || null;
}

export function isBuiltinTransformAssetUrl(url) {
    return typeof url === 'string' && url.startsWith('builtin:');
}

/**
 * 把单个资产的 nameKey / descriptionKey 解析成当前语言的文案。
 *
 * @param {object|null} asset 原始资产（含 nameKey / descriptionKey）
 * @param {(key: string) => string} t i18n 翻译函数
 * @returns {object|null} 附带 name / description 的新对象，入参不会被修改
 */
export function localizeTransformAsset(asset, t) {
    if (!asset) return null;
    return {
        ...asset,
        name: asset.nameKey ? t(asset.nameKey) : '',
        description: asset.descriptionKey ? t(asset.descriptionKey) : '',
    };
}

/** 解析全部资产。请在 computed 里调用，否则切换语言不会更新。 */
export function getLocalizedTransformAssets(t) {
    return TRANSFORM_ASSETS.configs.map((asset) => localizeTransformAsset(asset, t));
}

/** 按 url 查找并解析。请在 computed 里调用。 */
export function getLocalizedTransformAssetByUrl(url, t) {
    return localizeTransformAsset(getTransformAssetByUrl(url), t);
}
