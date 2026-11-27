import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import StatCards from '../../src/components/features/Dashboard/StatCards.vue';
import RightPanel from '../../src/components/profiles/RightPanel.vue';
import { createI18n } from '../../src/i18n/index.js';

const routerLinkStub = {
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : to?.path"><slot /></a>',
};

function mountRightPanel(props, locale = 'zh-CN') {
    return mount(RightPanel, {
        props,
        global: {
            plugins: [createPinia(), createI18n({ initialLocale: locale })],
            stubs: {
                RouterLink: routerLinkStub,
            },
        },
    });
}

describe('dashboard UI components', () => {
    it('emits navigation intent from clickable stat cards and marks zero-node state as warning', async () => {
        const wrapper = mount(StatCards, {
            props: {
                formattedTotalRemainingTraffic: '0 B',
                trafficStats: { used: '0 B', total: '0 B', percentage: 0 },
                activeSubscriptionsCount: 0,
                subscriptionsCount: 2,
                totalNodesCount: 0,
                activeProfilesCount: 0,
            },
            global: {
                plugins: [createI18n({ initialLocale: 'zh-CN' })],
            },
        });

        const nodeCard = wrapper.find('[data-testid="stat-card-nodes"]');
        expect(nodeCard.text()).toContain('需要刷新节点');
        expect(nodeCard.classes().join(' ')).toContain('border-amber-200/80');

        await nodeCard.trigger('click');
        expect(wrapper.emitted('navigate')?.[0]).toEqual([
            '/dashboard/subscriptions',
            { status: 'zero-nodes' },
        ]);
    });

    it('shows a setup checklist in right panel when tokens or profiles are missing', () => {
        const wrapper = mountRightPanel({
            config: { mytoken: 'auto', profileToken: '' },
            profiles: [],
        });

        expect(wrapper.text()).toContain('生成链接还需几步');
        expect(wrapper.text()).toContain('固定主 Token');
        expect(wrapper.text()).toContain('创建组合订阅');
        // token 不可用时不再渲染只读 input（单行输入会把长文案截断），改为可换行的提示块
        expect(wrapper.find('input').exists()).toBe(false);
        expect(wrapper.text()).toContain('请先在“设置”中配置固定的 主 Token');
    });

    it('keeps generated link actions enabled when fixed token and profile exist', () => {
        const wrapper = mountRightPanel({
            config: { mytoken: 'stable-token', profileToken: 'share-token' },
            profiles: [{ id: 'p1', customId: 'daily', name: '日常使用' }],
        });

        expect(wrapper.text()).not.toContain('生成链接还需几步');
        expect(wrapper.find('input').attributes('disabled')).toBeUndefined();
        expect(wrapper.find('input').element.value).toContain('/stable-token');
    });

    it('generates a native sing-box link instead of a base64 link', async () => {
        const wrapper = mountRightPanel({
            config: { mytoken: 'stable-token', profileToken: 'share-token' },
            profiles: [{ id: 'p1', customId: 'daily', name: '日常使用' }],
        });

        const singBoxButton = wrapper
            .findAll('button')
            .find((button) => button.text() === 'Sing-Box');
        expect(singBoxButton).toBeTruthy();
        await singBoxButton.trigger('click');

        expect(wrapper.find('input').element.value).toBe(
            `${window.location.origin}/stable-token?singbox`
        );
        expect(wrapper.find('input').element.value).not.toContain('?base64');
    });

    it('does not generate copyable subscription links for invalid token characters', () => {
        const wrapper = mountRightPanel({
            config: { mytoken: ':', profileToken: 'share-token' },
            profiles: [{ id: 'p1', customId: 'daily', name: '日常使用' }],
        });

        expect(wrapper.text()).toContain('固定主 Token');
        // 无效 token 下不渲染可复制的链接输入框，提示文案以完整可换行的方式展示
        expect(wrapper.find('input').exists()).toBe(false);
        expect(wrapper.text()).toContain('请先在“设置”中配置固定的 主 Token');
        expect(wrapper.text()).not.toContain('https://sub.dmorz.com/:');
    });

    it('renders stat cards and generated-link panel in English without leaking i18n keys', () => {
        const statCards = mount(StatCards, {
            props: {
                formattedTotalRemainingTraffic: '155.89 TB',
                trafficStats: { used: '1 TB', total: '2 TB', percentage: 50 },
                activeSubscriptionsCount: 1,
                subscriptionsCount: 1,
                totalNodesCount: 12,
                activeProfilesCount: 1,
            },
            global: {
                plugins: [createI18n({ initialLocale: 'en-US' })],
            },
        });

        expect(statCards.text()).toContain('Remaining traffic');
        expect(statCards.text()).toContain('Active sources');
        expect(statCards.text()).toContain('Total nodes');
        expect(statCards.text()).toContain('Profiles');
        expect(statCards.text()).not.toContain('dashboard.');
        expect(statCards.text()).not.toContain('DASHBOARD.');

        const rightPanel = mountRightPanel(
            {
                config: { mytoken: 'auto', profileToken: '' },
                profiles: [],
            },
            'en-US'
        );

        expect(rightPanel.text()).toContain('Generate subscription links');
        expect(rightPanel.text()).toContain('A few steps remain before links are ready');
        expect(rightPanel.text()).toContain('Set fixed main token');
        expect(rightPanel.text()).toContain('Create a profile');
        expect(rightPanel.text()).toContain('Universal');
        expect(rightPanel.text()).not.toContain('生成订阅链接');
        expect(rightPanel.text()).not.toContain('dashboard.');
    });
});
