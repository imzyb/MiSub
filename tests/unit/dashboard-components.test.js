import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import StatCards from '../../src/components/features/Dashboard/StatCards.vue';
import RightPanel from '../../src/components/profiles/RightPanel.vue';

const routerLinkStub = {
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : to?.path"><slot /></a>'
};

function mountRightPanel(props) {
  return mount(RightPanel, {
    props,
    global: {
      plugins: [createPinia()],
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
});
