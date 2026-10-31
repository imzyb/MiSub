import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RuleSection from '../../src/components/modals/SubscriptionEditModal/RuleSection.vue';

const props = {
    editingSubscription: { exclude: '' },
    excludeRuleState: { tagClass: '', tag: '规则', errors: [], errorsText: '格式错误' },
    toggleTag: () => {},
    isSelected: () => false,
    addCustomKeyword: () => {},
    removeRule: () => {},
    switchToAdvanced: () => {},
    switchToVisual: () => {},
};

describe('RuleSection accessibility', () => {
    it('uses an accessible button to control the collapsible rule editor', () => {
        const wrapper = mount(RuleSection, { props: { ...props, isRuleExpanded: false } });
        const toggle = wrapper.find('button[aria-expanded="false"]');
        expect(toggle.exists()).toBe(true);
        expect(toggle.attributes('aria-controls')).toBe('sub-edit-rule-content');
        expect(toggle.element.tagName).toBe('BUTTON');
        expect(wrapper.find('#sub-edit-rule-content').exists()).toBe(true);
    });

    it('exposes pressed state for mode and selectable tag buttons', () => {
        const wrapper = mount(RuleSection, {
            props: {
                ...props,
                isRuleExpanded: true,
                ruleMode: 'exclude',
                presetRegions: [{ pattern: 'cn', label: '中国', icon: '🇨🇳' }],
                isSelected: (pattern) => pattern === 'cn',
            },
        });
        expect(wrapper.find('button').text()).toBeTruthy();
        expect(wrapper.findAll('button[aria-pressed="true"]')).toHaveLength(2);
        expect(wrapper.findAll('button[aria-pressed="false"]')).toHaveLength(1);
    });

    it('associates invalid textarea with its error message', () => {
        const wrapper = mount(RuleSection, {
            props: {
                ...props,
                isRuleExpanded: true,
                isAdvancedMode: true,
                excludeRuleState: {
                    tagClass: '',
                    tag: '规则',
                    errors: ['bad'],
                    errorsText: '规则无效',
                },
            },
        });
        const textarea = wrapper.find('textarea');
        expect(textarea.attributes('aria-invalid')).toBe('true');
        expect(textarea.attributes('aria-describedby')).toBe('sub-edit-exclude-error');
        expect(wrapper.find('#sub-edit-exclude-error').text()).toContain('规则无效');
    });
});
