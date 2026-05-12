import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import SubscriptionPanel from '../../src/components/subscriptions/SubscriptionPanel.vue';

const baseProps = {
  currentPage: 1,
  totalPages: 1,
  isSorting: false
};

function mountPanel(props = {}) {
  return mount(SubscriptionPanel, {
    props: {
      ...baseProps,
      subscriptions: [],
      paginatedSubscriptions: [],
      ...props
    },
    global: {
      plugins: [createPinia()],
      stubs: {
        Card: { props: ['misub'], template: '<article class="card-stub">{{ misub.name }}</article>' },
        PanelPagination: true,
        EmptyState: { props: ['title', 'description'], template: '<div class="empty-state-stub"><h3>{{ title }}</h3><p>{{ description }}</p><slot /></div>' },
        MoreActionsMenu: { template: '<div><slot name="menu" :close="() => {}" /></div>' },
        draggable: { template: '<div><slot name="item" v-for="element in modelValue" :element="element" /></div>', props: ['modelValue'] }
      }
    }
  });
}

describe('SubscriptionPanel UX', () => {
  it('keeps the panel header focused on local actions instead of duplicating dashboard statistics', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const wrapper = mountPanel({
      subscriptions: [
        { id: 's1', name: '主力机场', url: 'https://example.com/a', enabled: true, nodeCount: 12, userInfo: { upload: 1, download: 2, total: 100, expire: nowSeconds + 3 * 24 * 60 * 60 } },
        { id: 's2', name: '备用机场', url: 'https://example.com/b', enabled: false, nodeCount: 8, lastError: 'timeout' },
        { id: 's3', name: '更新中', url: 'https://example.com/c', enabled: true, nodeCount: 0, isUpdating: true }
      ],
      paginatedSubscriptions: []
    });

    expect(wrapper.text()).toContain('机场订阅');
    expect(wrapper.text()).toContain('维护机场订阅源，添加/导入后可在卡片中查看节点、流量与到期信息。');
    expect(wrapper.text()).not.toContain('启用 2/3');
    expect(wrapper.text()).not.toContain('节点 20');
    expect(wrapper.text()).not.toContain('待处理 3');
    expect(wrapper.text()).not.toContain('状态正常');
  });

  it('offers direct add and bulk import actions in the empty state', async () => {
    const wrapper = mountPanel();

    expect(wrapper.text()).toContain('添加机场订阅');
    expect(wrapper.text()).toContain('批量导入');

    await wrapper.get('[data-testid="empty-add-subscription"]').trigger('click');
    await wrapper.get('[data-testid="empty-import-subscriptions"]').trigger('click');

    expect(wrapper.emitted('add')).toHaveLength(1);
    expect(wrapper.emitted('import')).toHaveLength(1);
  });
});
