import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { MAIN_NAV_ITEMS } from '../../src/constants/navigation.js';
import NodeActions from '../../src/components/nodes/ManualNodePanel/NodeActions.vue';

describe('manual nodes labels', () => {
  it('keeps the top navigation label in sync with the panel title', () => {
    const navItem = MAIN_NAV_ITEMS.find(item => item.path === '/dashboard/nodes');

    const wrapper = mount(NodeActions, {
      props: {
        manualNodesCount: 89,
        filteredNodesCount: 89,
        searchTerm: '',
        activeGroupFilter: null,
        manualNodeGroups: [],
        viewMode: 'card',
        isSorting: false,
        isSelectionMode: false
      },
      global: {
        stubs: {
          MoreActionsMenu: { template: '<div><slot name="menu" :close="() => {}" /></div>' }
        }
      }
    });

    const panelTitle = wrapper.find('h2').text();
    expect(navItem?.name).toBe(panelTitle);
  });
});
