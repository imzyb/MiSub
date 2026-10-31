import { beforeEach, describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_PROFILE_FORM } from '../../src/constants/default-settings.js';
import { validateProfile } from '../../src/utils/validation-utils.js';
import { messages } from '../../src/i18n/messages.js';
import { setLocale } from '../../src/i18n/index.js';

// 校验文案已 i18n。happy-dom 的 navigator.language 是 en-US，不钉住语言
// 会拿到英文文案（断言会以「翻译键没接上」的表象失败）。
beforeEach(() => setLocale('zh-CN'));

describe('Transform config settings', () => {
    it('defaults transformConfig to empty for built-in templates', () => {
        expect(DEFAULT_SETTINGS.transformConfigMode).toBe('builtin');
        expect(DEFAULT_SETTINGS.ruleLevel).toBe('std');
        expect('clashRuleLevel' in DEFAULT_SETTINGS).toBe(false);
        expect(DEFAULT_SETTINGS.transformConfig).toBe('');
        expect(DEFAULT_PROFILE_FORM.ruleLevel).toBe('');
        expect('clashRuleLevel' in DEFAULT_PROFILE_FORM).toBe(false);
        expect(DEFAULT_PROFILE_FORM.transformConfigMode).toBe('global');
    });

    it('allows empty transformConfig but rejects invalid external URLs', () => {
        const emptyResult = validateProfile({
            name: 'Demo',
            customId: 'demo',
            transformConfig: '',
        });
        const invalidResult = validateProfile({
            name: 'Demo',
            customId: 'demo',
            transformConfig: 'not-a-url',
        });

        expect(emptyResult.isValid).toBe(true);
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.errors.transformConfig).toContain(
            messages['zh-CN'].validation.invalidTransformUrl
        );
    });
});
