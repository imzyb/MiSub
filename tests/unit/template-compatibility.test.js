import { describe, it, expect } from 'vitest';
import {
    TEMPLATE_COMPATIBILITY,
    getTemplateCompatibility,
    normalizeTemplateTarget,
    shouldApplyExternalTemplateForTarget
} from '../../functions/modules/subscription/template-compatibility.js';

describe('Template compatibility', () => {
    it('should normalize target formats', () => {
        expect(normalizeTemplateTarget('surge&ver=4')).toBe('surge');
        expect(normalizeTemplateTarget('sing-box')).toBe('singbox');
        expect(normalizeTemplateTarget('clash')).toBe('clash');
    });

    it('should expose per-client compatibility strategy', () => {
        expect(getTemplateCompatibility('clash')).toMatchObject({
            allowExternalTemplate: true,
            strategy: 'external-first'
        });
        expect(getTemplateCompatibility('surge&ver=4')).toMatchObject({
            allowExternalTemplate: true,
            strategy: 'model-driven'
        });
        expect(getTemplateCompatibility('loon')).toMatchObject({
            allowExternalTemplate: true,
            externalTemplateTypes: ['ini'],
            strategy: 'model-driven'
        });
        expect(getTemplateCompatibility('singbox')).toMatchObject({
            allowExternalTemplate: true,
            externalTemplateTypes: ['ini', 'json'],
            strategy: 'model-driven'
        });
        expect(TEMPLATE_COMPATIBILITY.quanx.description).toContain('Quantumult X');
    });

    it('should only allow external templates for compatible clients', () => {
        expect(shouldApplyExternalTemplateForTarget('clash', 'https://example.com/preset.yaml')).toBe(true);
        expect(shouldApplyExternalTemplateForTarget('surge&ver=4', 'https://example.com/preset.ini')).toBe(true);
        expect(shouldApplyExternalTemplateForTarget('loon', 'https://example.com/preset.ini')).toBe(true);
        expect(shouldApplyExternalTemplateForTarget('quanx', 'https://example.com/preset.ini')).toBe(true);
        expect(shouldApplyExternalTemplateForTarget('singbox', 'https://example.com/preset.ini')).toBe(true);
    });
});
