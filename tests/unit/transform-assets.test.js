import { describe, it, expect } from 'vitest';
import {
    TRANSFORM_ASSETS,
    getTransformAssetByUrl,
    getLocalizedTransformAssets,
    getLocalizedTransformAssetByUrl,
    localizeTransformAsset,
} from '../../src/constants/transform-assets.js';
import { getBuiltinTemplate } from '../../functions/modules/subscription/builtin-template-registry.js';
import { t } from '../../src/i18n/index.js';

describe('Transform assets', () => {
    it('should provide metadata for preset configs', () => {
        expect(TRANSFORM_ASSETS.configs.length).toBeGreaterThan(0);

        for (const asset of TRANSFORM_ASSETS.configs) {
            expect(['preset', 'builtin-preset']).toContain(asset.sourceType);
            expect(Array.isArray(asset.compatibleClients)).toBe(true);
            expect(asset.compatibleClients.length).toBeGreaterThan(0);
            expect(typeof asset.strategy).toBe('string');
            expect(asset.strategy.length).toBeGreaterThan(0);

            // 名称与描述存的是 i18n key，不是文案本身。
            // 这个文件是模块级常量，启动时求值一次，直接写 t() 会导致切换语言后不更新。
            expect(typeof asset.nameKey).toBe('string');
            expect(asset.nameKey.startsWith('transformAssets.')).toBe(true);
            expect(typeof asset.descriptionKey).toBe('string');
            expect(asset.descriptionKey.startsWith('transformAssets.')).toBe(true);

            // 裸文案不应该再残留在常量里
            expect(asset.name).toBeUndefined();
            expect(asset.description).toBeUndefined();
        }
    });

    it('每个名称与描述 key 在中英文下都能解析出非空文案', () => {
        for (const locale of ['zh-CN', 'en-US']) {
            for (const asset of TRANSFORM_ASSETS.configs) {
                const name = t(asset.nameKey, {}, locale);
                const description = t(asset.descriptionKey, {}, locale);

                // 缺失时 t() 会原样返回 key，据此判断有没有漏配
                expect(name, `${asset.url} 的 ${asset.nameKey} 在 ${locale} 下缺失`).not.toBe(
                    asset.nameKey
                );
                expect(
                    description,
                    `${asset.url} 的 ${asset.descriptionKey} 在 ${locale} 下缺失`
                ).not.toBe(asset.descriptionKey);
                expect(name.trim().length).toBeGreaterThan(0);
                expect(description.trim().length).toBeGreaterThan(0);
            }
        }
    });

    it('中英文的模板名称确实不同，不是把中文原样抄了一份', () => {
        const zhNames = TRANSFORM_ASSETS.configs.map((asset) => t(asset.nameKey, {}, 'zh-CN'));
        const enNames = TRANSFORM_ASSETS.configs.map((asset) => t(asset.nameKey, {}, 'en-US'));

        for (let i = 0; i < zhNames.length; i += 1) {
            expect(zhNames[i], `${TRANSFORM_ASSETS.configs[i].url} 的英文名未翻译`).not.toBe(
                enNames[i]
            );
        }
    });

    it('should find preset by url', () => {
        const asset = getTransformAssetByUrl(TRANSFORM_ASSETS.configs[0].url);
        expect(asset?.id).toBe(TRANSFORM_ASSETS.configs[0].id);
    });

    it('should include builtin lite preset', () => {
        const asset = getTransformAssetByUrl('builtin:clash_acl4ssr_lite');
        expect(asset?.sourceType).toBe('builtin-preset');
        expect(asset?.compatibleClients).toContain('surge');
    });

    it('should expose only builtin presets that exist in the backend registry', () => {
        const builtinAssets = TRANSFORM_ASSETS.configs.filter(
            (asset) => asset.sourceType === 'builtin-preset'
        );
        expect(builtinAssets.length).toBeGreaterThan(0);

        for (const asset of builtinAssets) {
            expect(asset.url.startsWith('builtin:')).toBe(true);
            expect(asset.strategy).toBe('model-driven');

            const templateId = asset.url.slice('builtin:'.length);
            const backendTemplate = getBuiltinTemplate(templateId);
            expect(
                backendTemplate,
                `${asset.url} should resolve to a backend builtin template`
            ).not.toBeNull();
            expect(backendTemplate?.id).toBe(templateId);
            expect(backendTemplate?.format).toBe('ini');
        }
    });

    it('解析后的资产带当前语言文案，且不改动原始常量', () => {
        const [localized] = getLocalizedTransformAssets(t);

        expect(localized.name.length).toBeGreaterThan(0);
        expect(localized.description.length).toBeGreaterThan(0);
        expect(localized.url).toBe(TRANSFORM_ASSETS.configs[0].url);
        expect(localized.id).toBe(TRANSFORM_ASSETS.configs[0].id);

        // 展开复制，不能污染常量
        expect(TRANSFORM_ASSETS.configs[0].name).toBeUndefined();
        expect(TRANSFORM_ASSETS.configs[0].description).toBeUndefined();
    });

    it('按 url 解析时找不到就返回 null，而不是抛错', () => {
        const found = getLocalizedTransformAssetByUrl('builtin:clash_acl4ssr_lite', t);
        expect(found?.id).toBe(1);
        expect(found?.name.length).toBeGreaterThan(0);

        expect(getLocalizedTransformAssetByUrl('https://example.com/nope.ini', t)).toBeNull();
        expect(getLocalizedTransformAssetByUrl('', t)).toBeNull();
    });

    it('localizeTransformAsset 对空值返回 null', () => {
        expect(localizeTransformAsset(null, t)).toBeNull();
        expect(localizeTransformAsset(undefined, t)).toBeNull();
    });
});
