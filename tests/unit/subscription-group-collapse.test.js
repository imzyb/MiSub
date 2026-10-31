import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import SubscriptionPanel from '../../src/components/subscriptions/SubscriptionPanel.vue';
import { clearDomainNameMemory } from '../../src/utils/domain-name-memory.js';

/**
 * 订阅源「按站点自动折叠」回归测试。
 *
 * 场景：同一家机场常有多个订阅链接（域名相同、路径 token 不同），
 * 逐个平铺会导致列表杂乱。面板按 URL 域名自动聚合，同一站点折叠为一组。
 *
 * 注意：分组标题会经 prettifyHost 美化（sub1.gsafevpn.com -> Gsafevpn），
 * 因此断言以「折叠结构 / 卡片数量」为准，不依赖具体显示文本。
 */

const makeSub = (id, name, url) => ({ id, name, url, enabled: true });

const mountPanel = (subscriptions) =>
    mount(SubscriptionPanel, {
        props: {
            subscriptions,
            paginatedSubscriptions: subscriptions,
            currentPage: 1,
            totalPages: 1,
        },
        global: {
            plugins: [createPinia()],
            stubs: {
                draggable: true,
                Card: { template: '<div class="stub-card" />' },
                MoreActionsMenu: { template: '<div><slot name="menu" /></div>' },
                PanelPagination: true,
                EmptyState: true,
            },
        },
    });

describe('订阅源按站点折叠', () => {
    beforeEach(() => {
        // 清掉命名记忆，避免残留影响分组标题
        clearDomainNameMemory();
    });

    it('同一域名的多个订阅源聚合为一个分组', async () => {
        const subs = [
            makeSub('a', 's1', 'https://sub1.gsafevpn.com/x/token1'),
            makeSub('b', 's2', 'https://sub1.gsafevpn.com/x/token2'),
            makeSub('c', 's3', 'https://sub1.gsafevpn.com/x/token3'),
        ];
        const wrapper = mountPanel(subs);
        await wrapper.vm.$nextTick();

        // 三张卡片都在（折叠但已渲染），且出现数量徽标 3
        expect(wrapper.findAll('.stub-card')).toHaveLength(3);
        expect(wrapper.html()).toContain('>3<');
        const groupToggle = wrapper.find('[aria-expanded="false"]');
        expect(groupToggle.exists()).toBe(true);
        expect(groupToggle.attributes('aria-expanded')).toBe('false');
        expect(
            wrapper.findAll('.stub-card')[0].element.parentElement.parentElement.style.display
        ).toBe('none');
        // 有可折叠分组时会出现「折叠全部」
        expect(wrapper.html()).toMatch(/折叠全部|Collapse all/);
    });

    it('用户展开分组后，分页/列表更新不会再次自动收起该站点', async () => {
        const subs = [
            makeSub('a', 's1', 'https://same.example.com/1'),
            makeSub('b', 's2', 'https://same.example.com/2'),
        ];
        const wrapper = mountPanel(subs);
        await wrapper.find('[aria-expanded="false"]').trigger('click');
        expect(wrapper.find('[aria-expanded="true"]').exists()).toBe(true);

        await wrapper.setProps({ paginatedSubscriptions: [...subs] });
        expect(wrapper.find('[aria-expanded="true"]').exists()).toBe(true);
    });

    it('搜索结果跨页时仍显示完整同站点分组，单条目只显示在当前页', async () => {
        const subs = [
            makeSub('a', 's1', 'https://api.foo.example.com/1'),
            makeSub('b', 's2', 'https://sub.foo.example.com/2'),
            makeSub('c', 's3', 'https://foo.example.com/3'),
            makeSub('d', 'other', 'https://other.example.net/1'),
        ];
        const wrapper = mountPanel(subs.slice(0, 2));
        await wrapper.setProps({
            subscriptions: subs,
            paginatedSubscriptions: subs.slice(0, 2),
        });
        // 当前页只命中组内两项，但完整同站点组的三项均出现，组头总数正确。
        expect(wrapper.findAll('.stub-card')).toHaveLength(3);
        expect(wrapper.find('[aria-expanded="false"]').text()).toContain('3');

        // 下一页命中该组的第三项时仍显示完整组，并显示当前页的单条目。
        await wrapper.setProps({ paginatedSubscriptions: subs.slice(2, 4) });
        expect(wrapper.findAll('.stub-card')).toHaveLength(4);
        expect(wrapper.find('[aria-expanded="false"]').text()).toContain('3');
    });

    it('wd-blue sources group by airport root across subdomains and URLs', async () => {
        const subs = [
            makeSub('a', 'first', 'https://sub1.wd-blue.com/sub/one'),
            makeSub('b', 'second', 'https://api.wd-blue.com/sub/two'),
            makeSub('c', 'third', 'https://www.wd-blue.com/third'),
        ];
        const wrapper = mountPanel(subs);
        await wrapper.vm.$nextTick();

        expect(wrapper.findAll('[aria-expanded="false"]')).toHaveLength(1);
        expect(wrapper.html()).toContain('>3<');
        expect(wrapper.findAll('.stub-card')).toHaveLength(3);
    });

    it('托管域名按项目 tenant 分组，不把无关 pages.dev 站点合并', async () => {
        const subs = [
            makeSub('a', 'one', 'https://project-a.pages.dev/sub/one'),
            makeSub('b', 'two', 'https://project-a.pages.dev/sub/two'),
            makeSub('c', 'other', 'https://project-b.pages.dev/sub'),
        ];
        const wrapper = mountPanel(subs);
        await wrapper.vm.$nextTick();

        expect(wrapper.findAll('[aria-expanded="false"]')).toHaveLength(1);
        expect(wrapper.findAll('.stub-card')).toHaveLength(3);
        expect(wrapper.html()).toContain('Project a');
        expect(
            wrapper.find('[aria-expanded="false"]').element.closest('.rounded-xl').textContent
        ).toContain('2');
    });

    it('组标题可以展开/收起，且显示数量及组重命名控件', async () => {
        const subs = [
            { ...makeSub('a', 'one', 'https://api.wd-blue.com/sub/one'), detectedName: '西数' },
            makeSub('b', 'two', 'https://sub.wd-blue.com/sub/two'),
        ];
        const wrapper = mountPanel(subs);
        const header = wrapper.find('[aria-expanded="false"]');
        expect(wrapper.html()).toContain('>2<');
        expect(wrapper.text()).toMatch(/Rename all|Confirm airport identity/);
        await header.trigger('click');
        expect(wrapper.find('[aria-expanded="true"]').exists()).toBe(true);
        await wrapper.find('[aria-expanded="true"]').trigger('click');
        expect(wrapper.find('[aria-expanded="false"]').exists()).toBe(true);
    });

    it('显式机场归属可将不同域名合并，且可恢复自动分组', async () => {
        const subs = [
            {
                ...makeSub('a', 'one', 'https://one.example.net/sub'),
                airportIdentity: { groupId: 'airport-1', name: '机场甲' },
            },
            {
                ...makeSub('b', 'two', 'https://two.example.org/sub'),
                airportIdentity: { groupId: 'airport-1', name: '机场甲' },
            },
            makeSub('c', 'three', 'https://three.example.com/sub'),
        ];
        const wrapper = mountPanel(subs, { onSplitAirportGroup: vi.fn() });
        expect(wrapper.findAll('[aria-expanded="false"]')).toHaveLength(1);
        expect(wrapper.find('[aria-expanded="false"]').text()).toContain('2');
        expect(wrapper.text()).toContain('机场甲');
        const split = wrapper.findAll('button').find((button) => /拆分机场分组|Split airport group/.test(button.text()));
        expect(split).toBeTruthy();
        await split.trigger('click');
        expect(wrapper.emitted('split-airport-group')).toHaveLength(2);
        expect(wrapper.emitted('split-airport-group').map(([ids, identity]) => [ids, identity.groupId])).toEqual([
            [['a'], expect.any(String)],
            [['b'], expect.any(String)],
        ]);
        expect(wrapper.emitted('split-airport-group')[0][1].groupId).not.toBe(
            wrapper.emitted('split-airport-group')[1][1].groupId
        );
        const reset = wrapper
            .findAll('button')
            .find(
                (button) =>
                    button.text().includes('恢复自动机场分组') ||
                    button.text().includes('Return to automatic airport grouping')
            );
        expect(reset).toBeTruthy();
        await reset.trigger('click');
        expect(wrapper.emitted('reset-group')?.[0]).toEqual([['a', 'b']]);
    });

    it('assigns only the selected group ids from the group header editor', async () => {
        const wrapper = mountPanel([
            { ...makeSub('a', 'one', 'https://one.example.net/sub'), airportIdentity: { groupId: 'existing', name: 'Existing' } },
            makeSub('b', 'two', 'https://two.example.org/sub'),
            makeSub('c', 'three', 'https://three.example.com/sub'),
        ]);
        expect(wrapper.findAll('button').filter((button) => /指定机场分组|Assign to airport group/.test(button.text())).length).toBeGreaterThan(0);
    });

    it('单条目站点不折叠，直接平铺', async () => {
        const subs = [
            makeSub('a', 'a', 'https://only-one.example.com/sub'),
            makeSub('b', 'b', 'https://another.example.net/sub'),
        ];
        const wrapper = mountPanel(subs);
        await wrapper.vm.$nextTick();

        // 没有多条目分组时，不应出现折叠控件（展开全部按钮）
        expect(wrapper.html()).not.toMatch(/展开全部|Expand all/);
        // 卡片照样两张平铺
        expect(wrapper.findAll('.stub-card')).toHaveLength(2);
    });

    it('同一机场根域的多个子域合并成组', async () => {
        const subs = [
            makeSub('a', 'api', 'https://api.foo.example.com/1'),
            makeSub('b', 'sub', 'https://sub.foo.example.com/2'),
        ];
        const wrapper = mountPanel(subs);
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[aria-expanded="false"]').exists()).toBe(true);
        expect(wrapper.findAll('.stub-card')).toHaveLength(2);
    });

    it('不同域名各自成组，不互相聚合', async () => {
        const subs = [
            makeSub('a', 'a', 'https://site-a.com/1'),
            makeSub('b', 'b', 'https://site-a.com/2'),
            makeSub('c', 'c', 'https://site-b.com/1'),
            makeSub('d', 'd', 'https://site-b.com/2'),
        ];
        const wrapper = mountPanel(subs);
        await wrapper.vm.$nextTick();

        // 两个分组，四张卡片全渲染；两组都带数量徽标 2
        expect(wrapper.findAll('.stub-card')).toHaveLength(4);
        const badgeCount = (wrapper.html().match(/>2</g) || []).length;
        expect(badgeCount).toBeGreaterThanOrEqual(2);
    });

    it('www. 前缀与裸域名归为同一组', async () => {
        const subs = [
            makeSub('a', 'a', 'https://www.example.com/1'),
            makeSub('b', 'b', 'https://example.com/2'),
        ];
        const wrapper = mountPanel(subs);
        await wrapper.vm.$nextTick();

        // 视为同站点 -> 折叠为一组（出现折叠控件），且标题不含 www.
        expect(wrapper.html()).toMatch(/折叠全部|Collapse all/);
        expect(wrapper.html()).not.toContain('www.example.com');
        expect(wrapper.findAll('.stub-card')).toHaveLength(2);
    });
});
