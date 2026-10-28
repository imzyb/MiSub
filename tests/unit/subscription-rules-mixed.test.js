import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { applyFilterRules } from '../../functions/services/subscription-service.js';
import RuleSection from '../../src/components/modals/SubscriptionEditModal/RuleSection.vue';
import SubscriptionEditModal from '../../src/components/modals/SubscriptionEditModal.vue';
import { createPinia, setActivePinia } from 'pinia';

describe('Mixed Subscription Filter Rules (Include + Exclude)', () => {
    const sampleNodes = [
        'ss://YWVzLTEyOC1nY206cGFzcw@1.1.1.1:8388#%E9%A6%99%E6%B8%AF%2001', // 香港 01
        'ss://YWVzLTEyOC1nY206cGFzcw@1.1.1.1:8388#%E9%A6%99%E6%B8%AF%20%E5%AE%98%E7%BD%91', // 香港 官网
        'ss://YWVzLTEyOC1nY206cGFzcw@1.1.1.1:8388#%E7%BE%8E%E5%9B%BD%2001', // 美国 01
        'trojan://pass@2.2.2.2:443#%E6%97%A5%E6%9C%AC%2001', // 日本 01
        'trojan://pass@2.2.2.2:443#%E6%97%A5%E6%9C%AC%20%E5%89%A9%E4%BD%99%E6%B5%81%E9%87%8F', // 日本 剩余流量
    ];

    describe('Backend applyFilterRules', () => {
        it('applies both include and exclude rules when separated by ---', () => {
            const sub = {
                exclude: `官网\n剩余流量\n---\nkeep:(香港|HK)\nkeep:proto:trojan`,
            };
            const filtered = applyFilterRules(sampleNodes, sub);
            // Include matches: 香港 01, 香港 官网, 日本 01, 日本 剩余流量
            // Exclude drops: 香港 官网, 日本 剩余流量
            // Remaining should be: 香港 01, 日本 01
            expect(filtered).toHaveLength(2);
            expect(filtered[0]).toContain('%E9%A6%99%E6%B8%AF%2001');
            expect(filtered[1]).toContain('%E6%97%A5%E6%9C%AC%2001');
        });

        it('applies both include and exclude rules even WITHOUT --- divider', () => {
            const sub = {
                exclude: `官网\nkeep:(香港|HK)`,
            };
            const filtered = applyFilterRules(sampleNodes, sub);
            // Include matches: 香港 01, 香港 官网
            // Exclude drops: 香港 官网
            // Remaining should be: 香港 01
            expect(filtered).toHaveLength(1);
            expect(filtered[0]).toContain('%E9%A6%99%E6%B8%AF%2001');
        });

        it('applies pure exclude rules correctly', () => {
            const sub = {
                exclude: `01`,
            };
            const filtered = applyFilterRules(sampleNodes, sub);
            // Drops 香港 01, 美国 01, 日本 01
            // Keeps 香港 官网, 日本 剩余流量
            expect(filtered).toHaveLength(2);
            expect(filtered[0]).toContain('%E5%AE%98%E7%BD%91');
            expect(filtered[1]).toContain('%E5%89%A9%E4%BD%99%E6%B5%81%E9%87%8F');
        });

        it('applies pure include rules correctly', () => {
            const sub = {
                exclude: `keep:(美国|US)`,
            };
            const filtered = applyFilterRules(sampleNodes, sub);
            expect(filtered).toHaveLength(1);
            expect(filtered[0]).toContain('%E7%BE%8E%E5%9B%BD');
        });
    });

    describe('Frontend RuleSection component UI', () => {
        it('renders both keep and exclude rule pools simultaneously', () => {
            const keepRules = [{ label: '香港', pattern: '(香港|HK)', icon: '🇭🇰', type: 'region' }];
            const excludeRules = [{ label: '官网', pattern: '官网', type: 'keyword' }];
            const wrapper = mount(RuleSection, {
                props: {
                    editingSubscription: { exclude: '官网\n---\nkeep:(香港|HK)' },
                    isRuleExpanded: true,
                    ruleMode: 'keep',
                    keepRules,
                    excludeRules,
                    selectedRules: [...keepRules, ...excludeRules],
                    presetRegions: [{ pattern: '(香港|HK)', label: '香港', icon: '🇭🇰' }],
                    presetProtocols: [{ pattern: 'proto:ss', label: 'SS' }],
                    presetKeywords: [{ pattern: '官网', label: '官网' }],
                    excludeRuleState: { tagClass: '', tag: '混合', errors: [], errorsText: '' },
                    toggleTag: vi.fn(),
                    isSelected: (p) => p === '(香港|HK)',
                    isOtherSelected: (p) => p === '官网',
                    addCustomKeyword: vi.fn(),
                    removeRule: vi.fn(),
                    removeKeepRule: vi.fn(),
                    removeExcludeRule: vi.fn(),
                    switchToAdvanced: vi.fn(),
                    switchToVisual: vi.fn(),
                },
            });

            // Check header total badge
            expect(wrapper.text()).toContain('2'); // 2 selected rules total

            // Check both keep and exclude rule groups are displayed
            expect(wrapper.text()).toContain('香港');
            expect(wrapper.text()).toContain('官网');

            // Check mode tabs display individual counts
            const buttons = wrapper.findAll('button');
            const keepBtn = buttons.find(
                (b) =>
                    b.text().includes('仅包含') ||
                    b.text().includes('保留') ||
                    b.text().toLowerCase().includes('keep')
            );
            const excludeBtn = buttons.find(
                (b) => b.text().includes('排除') || b.text().toLowerCase().includes('exclude')
            );
            expect(keepBtn).toBeDefined();
            expect(excludeBtn).toBeDefined();
        });
    });

    describe('Frontend SubscriptionEditModal integration', () => {
        beforeEach(() => {
            setActivePinia(createPinia());
        });

        it('parses mixed rules text with --- into separate keep and exclude pools', async () => {
            const editingSubscription = {
                id: 'sub-1',
                name: 'Test Airport',
                url: 'https://example.com/sub',
                exclude: `官网\n过期\n---\nkeep:(香港|HK|Hong Kong)\nkeep:proto:vless`,
            };

            const wrapper = mount(SubscriptionEditModal, {
                props: {
                    show: true,
                    isNew: false,
                    editingSubscription,
                },
                global: {
                    stubs: {
                        Modal: {
                            template: '<div><slot name="title"/><slot name="body"/></div>',
                        },
                        EditForm: true,
                        AdvancedOptions: true,
                    },
                },
            });

            const ruleSection = wrapper.findComponent(RuleSection);
            expect(ruleSection.exists()).toBe(true);

            // Verify keep rules
            expect(ruleSection.props('keepRules')).toHaveLength(2);
            expect(ruleSection.props('keepRules').map((r) => r.label)).toEqual(
                expect.arrayContaining(['香港', 'VLESS'])
            );

            // Verify exclude rules
            expect(ruleSection.props('excludeRules')).toHaveLength(2);
            expect(ruleSection.props('excludeRules').map((r) => r.label)).toEqual(
                expect.arrayContaining(['官网', '过期'])
            );

            // Verify tag state shows "mixed" (混合)
            expect(ruleSection.props('excludeRuleState').tagKey).toBe('mixed');
        });

        it('synchronizes edits across keep and exclude pools back to exclude string with ---', async () => {
            const editingSubscription = {
                id: 'sub-2',
                name: 'Test Airport 2',
                url: 'https://example.com/sub',
                exclude: '',
            };

            const wrapper = mount(SubscriptionEditModal, {
                props: {
                    show: true,
                    isNew: false,
                    editingSubscription,
                },
                global: {
                    stubs: {
                        Modal: {
                            template: '<div><slot name="title"/><slot name="body"/></div>',
                        },
                        EditForm: true,
                        AdvancedOptions: true,
                    },
                },
            });

            const ruleSection = wrapper.findComponent(RuleSection);

            // In keep mode (active by default or set to keep)
            await ruleSection.vm.$emit('update:ruleMode', 'keep');
            ruleSection.props('toggleTag')({ label: '日本', pattern: '(日本|JP|Japan)' }, 'region');

            // Switch to exclude mode
            await ruleSection.vm.$emit('update:ruleMode', 'exclude');
            ruleSection.props('toggleTag')({ label: '官网', pattern: '官网' }, 'keyword');

            // The resulting exclude text should contain both and the --- separator
            expect(editingSubscription.exclude).toContain('官网');
            expect(editingSubscription.exclude).toContain('---');
            expect(editingSubscription.exclude).toContain('keep:(日本|JP|Japan)');
        });
    });
});
