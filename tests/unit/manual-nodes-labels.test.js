import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { MAIN_NAV_ITEMS } from '../../src/constants/navigation.js';
import NodeActions from '../../src/components/nodes/ManualNodePanel/NodeActions.vue';
import { createI18n } from '../../src/i18n/index.js';

describe('manual nodes labels', () => {
    const mountNodeActions = () =>
        mount(NodeActions, {
            props: {
                manualNodesCount: 89,
                filteredNodesCount: 89,
                searchTerm: '',
                activeGroupFilter: null,
                manualNodeGroups: [],
                viewMode: 'card',
                isSorting: false,
                isSelectionMode: false,
            },
            global: {
                plugins: [createI18n({ initialLocale: 'zh-CN' })],
                stubs: {
                    MoreActionsMenu: {
                        template: '<div><slot name="menu" :close="() => {}" /></div>',
                    },
                },
            },
        });

    it('keeps the top navigation label in sync with the panel title', () => {
        const navItem = MAIN_NAV_ITEMS.find((item) => item.path === '/dashboard/nodes');
        const wrapper = mountNodeActions();

        const panelTitle = wrapper.find('h2').text();
        expect(navItem?.name).toBe(panelTitle);
    });

    it('keeps the mobile toolbar inside the viewport instead of widening the navigation layout', () => {
        const wrapper = mountNodeActions();
        const groupScroller = wrapper.get('[data-testid="manual-node-mobile-groups"]');
        const toolbarActions = wrapper.get('[data-testid="manual-node-toolbar-actions"]');
        const search = wrapper.get('[data-testid="manual-node-search"]');

        expect(groupScroller.classes()).toEqual(
            expect.arrayContaining(['w-full', 'min-w-0', 'overflow-x-auto', 'md:hidden'])
        );
        expect(toolbarActions.classes()).toEqual(
            expect.arrayContaining(['w-full', 'min-w-0', 'flex-wrap', 'sm:flex-nowrap'])
        );
        expect(search.classes()).toEqual(
            expect.arrayContaining(['min-w-0', 'basis-full', 'sm:basis-auto'])
        );
    });
});
