import { describe, it, expect } from 'vitest';
import { TRANSFORM_ASSETS, getTransformAssetByUrl } from '../../src/constants/transform-assets.js';
import { getBuiltinTemplate } from '../../functions/modules/subscription/builtin-template-registry.js';

describe('Transform assets', () => {
    it('should provide metadata for preset configs', () => {
        expect(TRANSFORM_ASSETS.configs.length).toBeGreaterThan(0);

        for (const asset of TRANSFORM_ASSETS.configs) {
            expect(['preset', 'builtin-preset']).toContain(asset.sourceType);
            expect(Array.isArray(asset.compatibleClients)).toBe(true);
            expect(asset.compatibleClients.length).toBeGreaterThan(0);
            expect(typeof asset.strategy).toBe('string');
            expect(asset.strategy.length).toBeGreaterThan(0);
            expect(typeof asset.description).toBe('string');
            expect(asset.description.length).toBeGreaterThan(0);
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
        const builtinAssets = TRANSFORM_ASSETS.configs.filter(asset => asset.sourceType === 'builtin-preset');
        expect(builtinAssets.length).toBeGreaterThan(0);

        for (const asset of builtinAssets) {
            expect(asset.url.startsWith('builtin:')).toBe(true);
            expect(asset.strategy).toBe('model-driven');

            const templateId = asset.url.slice('builtin:'.length);
            const backendTemplate = getBuiltinTemplate(templateId);
            expect(backendTemplate, `${asset.url} should resolve to a backend builtin template`).not.toBeNull();
            expect(backendTemplate?.id).toBe(templateId);
            expect(backendTemplate?.format).toBe('ini');
        }
    });
});
