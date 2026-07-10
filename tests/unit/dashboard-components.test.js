import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import StatCards from '../../src/components/features/Dashboard/StatCards.vue';
import RightPanel from '../../src/components/profiles/RightPanel.vue';
import { createI18n } from '../../src/i18n/index.js';

const routerLinkStub = {
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : to?.path"><slot /></a>'
};

function mountRightPanel(props, locale = 'zh-CN') {
  return mount(RightPanel, {
    props,
    global: {
      plugins: [createPinia(), createI18n({ initialLocale: locale })],
      stubs: {
        RouterLink: routerLinkStub
      }
    }
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
        activeProfilesCount: 0
      },
      global: {
        plugins: [createI18n({ initialLocale: 'zh-CN' })]
      }
    });

    const nodeCard = wrapper.find('[data-testid="stat-card-nodes"]');
    expect(nodeCard.text()).toContain('需要刷新节点');
    expect(nodeCard.classes().join(' ')).toContain('border-amber-200/80');

    await nodeCard.trigger('click');
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['/dashboard/subscriptions', { status: 'zero-nodes' }]);
  });

  it('shows a setup checklist in right panel when tokens or profiles are missing', () => {
    const wrapper = mountRightPanel({
      config: { mytoken: 'auto', profileToken: '' },
      profiles: []
    });

    expect(wrapper.text()).toContain('链接生成前还差几步');
    expect(wrapper.text()).toContain('固定主 Token');
    expect(wrapper.text()).toContain('创建组合订阅');
    expect(wrapper.find('input').attributes('disabled')).toBeDefined();
  });

  it('keeps generated link actions enabled when fixed token and profile exist', () => {
    const wrapper = mountRightPanel({
      config: { mytoken: 'stable-token', profileToken: 'share-token' },
      profiles: [{ id: 'p1', customId: 'daily', name: '日常使用' }]
    });

    expect(wrapper.text()).not.toContain('链接生成前还差几步');
    expect(wrapper.find('input').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('input').element.value).toContain('/stable-token');
  });

  it('does not generate copyable subscription links for invalid token characters', () => {
    const wrapper = mountRightPanel({
      config: { mytoken: ':', profileToken: 'share-token' },
      profiles: [{ id: 'p1', customId: 'daily', name: '日常使用' }]
    });

    const input = wrapper.find('input');
    expect(wrapper.text()).toContain('固定主 Token');
    expect(input.attributes('disabled')).toBeDefined();
    expect(input.element.value).toBe('请先在“设置”中配置固定的 主 Token');
    expect(input.element.value).not.toContain('https://sub.dmorz.com/:');
  });

  it('renders stat cards and generated-link panel in English without leaking i18n keys', () => {
    const statCards = mount(StatCards, {
      props: {
        formattedTotalRemainingTraffic: '155.89 TB',
        trafficStats: { used: '1 TB', total: '2 TB', percentage: 50 },
        activeSubscriptionsCount: 1,
        subscriptionsCount: 1,
        totalNodesCount: 12,
        activeProfilesCount: 1
      },
      global: {
        plugins: [createI18n({ initialLocale: 'en-US' })]
      }
    });

    expect(statCards.text()).toContain('Remaining traffic');
    expect(statCards.text()).toContain('Active sources');
    expect(statCards.text()).toContain('Total nodes');
    expect(statCards.text()).toContain('Profiles');
    expect(statCards.text()).not.toContain('dashboard.');
    expect(statCards.text()).not.toContain('DASHBOARD.');

    const rightPanel = mountRightPanel({
      config: { mytoken: 'auto', profileToken: '' },
      profiles: []
    }, 'en-US');

    expect(rightPanel.text()).toContain('Generate subscription links');
    expect(rightPanel.text()).toContain('A few steps remain before links are ready');
    expect(rightPanel.text()).toContain('Set fixed main token');
    expect(rightPanel.text()).toContain('Create a profile');
    expect(rightPanel.text()).toContain('Universal');
    expect(rightPanel.text()).not.toContain('生成订阅链接');
    expect(rightPanel.text()).not.toContain('dashboard.');
  });
});
