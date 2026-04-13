import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_PROFILE_FORM } from '../../src/constants/default-settings.js';
import { validateProfile } from '../../src/utils/validation-utils.js';

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
        const emptyResult = validateProfile({ name: 'Demo', customId: 'demo', transformConfig: '' });
        const invalidResult = validateProfile({ name: 'Demo', customId: 'demo', transformConfig: 'not-a-url' });

        expect(emptyResult.isValid).toBe(true);
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.errors.transformConfig).toContain('请输入有效的外部规则模板URL，或留空使用内置模板');
    });
});
