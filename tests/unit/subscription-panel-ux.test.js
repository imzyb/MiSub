import { DOMWrapper, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import SubscriptionPanel from '../../src/components/subscriptions/SubscriptionPanel.vue';
import { createI18n } from '../../src/i18n/index.js';

const baseProps = {
    currentPage: 1,
    totalPages: 1,
    isSorting: false,
};

function mountPanel(props = {}) {
    return mount(SubscriptionPanel, {
        attachTo: document.body,
        props: {
            ...baseProps,
            subscriptions: [],
            paginatedSubscriptions: [],
            ...props,
        },
        global: {
            plugins: [createPinia(), createI18n({ initialLocale: 'zh-CN' })],
            stubs: {
                Card: {
                    props: ['misub'],
                    template: '<article class="card-stub">{{ misub.name }}</article>',
                },
                PanelPagination: true,
                EmptyState: {
                    props: ['title', 'description'],
                    template:
                        '<div class="empty-state-stub"><h3>{{ title }}</h3><p>{{ description }}</p><slot /></div>',
                },
                MoreActionsMenu: { template: '<div><slot name="menu" :close="() => {}" /></div>' },
                draggable: {
                    template:
                        '<div><slot name="item" v-for="element in modelValue" :element="element" /></div>',
                    props: ['modelValue'],
                },
            },
        },
    });
}

describe('SubscriptionPanel UX', () => {
    it('keeps the panel header focused on local actions instead of duplicating dashboard statistics', () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const wrapper = mountPanel({
            subscriptions: [
                {
                    id: 's1',
                    name: '主力机场',
                    url: 'https://example.com/a',
                    enabled: true,
                    nodeCount: 12,
                    userInfo: {
                        upload: 1,
                        download: 2,
                        total: 100,
                        expire: nowSeconds + 3 * 24 * 60 * 60,
                    },
                },
                {
                    id: 's2',
                    name: '备用机场',
                    url: 'https://example.com/b',
                    enabled: false,
                    nodeCount: 8,
                    lastError: 'timeout',
                },
                {
                    id: 's3',
                    name: '更新中',
                    url: 'https://example.com/c',
                    enabled: true,
                    nodeCount: 0,
                    isUpdating: true,
                },
            ],
            paginatedSubscriptions: [],
        });

        expect(wrapper.text()).toContain('机场订阅');
        expect(wrapper.text()).toContain(
            '维护机场订阅源，添加/导入后可在卡片中查看节点、流量与到期信息。'
        );
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

    it('distinguishes search with no matches from an actually empty list', async () => {
        const wrapper = mountPanel({
            searchable: true,
            searchQuery: 'missing',
            subscriptions: [{ id: 's1', name: '机场一', url: 'https://one.test/sub' }],
            paginatedSubscriptions: [],
            filteredCount: 0,
        });

        expect(wrapper.text()).toContain('没有找到匹配的机场订阅。');
        expect(wrapper.get('[data-testid="subscription-no-search-results"]').exists()).toBe(true);
        expect(wrapper.get('[data-testid="clear-subscription-search"]').exists()).toBe(true);
        await wrapper.get('[data-testid="clear-subscription-search"]').trigger('click');
        expect(wrapper.emitted('updateSearch')).toEqual([['']]);
    });

    it('renders paginated results inside collapsed site groups', async () => {
        const wrapper = mountPanel({
            subscriptions: [
                { id: 'a1', name: 'A1', url: 'https://sub.example.com/1' },
                { id: 'a2', name: 'A2', url: 'https://sub.example.com/2' },
                { id: 'b1', name: 'B1', url: 'https://other.test/1' },
            ],
            paginatedSubscriptions: [
                { id: 'a1', name: 'A1', url: 'https://sub.example.com/1' },
                { id: 'a2', name: 'A2', url: 'https://sub.example.com/2' },
            ],
        });

        expect(wrapper.text()).toContain('A1');
        expect(wrapper.text()).toContain('A2');
        expect(wrapper.text()).not.toContain('B1');
        expect(wrapper.findAll('.card-stub')).toHaveLength(2);
        expect(wrapper.get('button[aria-expanded="false"]').exists()).toBe(true);
        await wrapper.get('button[aria-expanded="false"]').trigger('click');
        expect(wrapper.get('button[aria-expanded="true"]').exists()).toBe(true);
    });

    it('uses a concise list search hint that fits mobile screens', () => {
        const wrapper = mountPanel({ searchable: true });
        const search = wrapper.get('[data-testid="subscription-search"]');

        expect(search.attributes('placeholder')).toBe('搜索名称、备注或链接');
        expect(search.attributes('aria-label')).toBe('搜索机场订阅名称、备注或链接...');
    });

    it('opens the assignment dialog, cancels, and submits selected group for all subscriptions', async () => {
        const subscriptions = [
            {
                id: 's1',
                name: 'Alpha',
                url: 'https://alpha.test/a',
                airportIdentity: { groupId: 'g1', name: 'Existing' },
            },
            { id: 's2', name: 'Beta', url: 'https://beta.test/b' },
        ];
        const wrapper = mountPanel({ subscriptions, paginatedSubscriptions: subscriptions });
        await wrapper.get('button[title="指定机场分组"]').trigger('click');
        expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
        const dialogButtons = () =>
            Array.from(document.body.querySelectorAll('[role="dialog"] button')).map(
                (el) => new DOMWrapper(el)
            );
        await dialogButtons().find((button) => button.text() === '取消').trigger('click');
        expect(wrapper.emitted('assign-airport-group')).toBeUndefined();

        await wrapper.get('button[title="指定机场分组"]').trigger('click');
        await new DOMWrapper(document.body.querySelector('[role="dialog"] select')).setValue('g1');
        await dialogButtons().find((button) => button.text() === '保存机场归属').trigger('click');
        expect(wrapper.emitted('assign-airport-group')).toEqual([
            [['s1', 's2'], { groupId: 'g1', name: 'Existing' }],
        ]);
    });

    it('submits a new identity using the selected group row subscription IDs', async () => {
        const subscriptions = [
            { id: 's1', name: 'A', url: 'https://same.test/a' },
            { id: 's2', name: 'B', url: 'https://same.test/b' },
            { id: 's3', name: 'C', url: 'https://other.test/c' },
        ];
        const wrapper = mountPanel({ subscriptions, paginatedSubscriptions: subscriptions });
        await wrapper.findAll('button[title="指定机场分组"]')[1].trigger('click');
        const dialogQuery = (selector) =>
            new DOMWrapper(document.body.querySelector(`[role="dialog"] ${selector}`));
        await dialogQuery('input[placeholder="新机场名称"]').setValue('New Airport');
        const saveButton = Array.from(document.body.querySelectorAll('[role="dialog"] button'))
            .map((el) => new DOMWrapper(el))
            .find((button) => button.text() === '保存机场归属');
        await saveButton.trigger('click');
        const [[ids, identity]] = wrapper.emitted('assign-airport-group');
        expect(ids).toEqual(['s1', 's2']);
        expect(identity).toMatchObject({ name: 'New Airport' });
        expect(identity.groupId).toBeTruthy();
    });
});
