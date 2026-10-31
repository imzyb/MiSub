import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computed } from 'vue';

const pushMock = vi.fn();

const subscriptionsRef = { value: [] };
const manualNodesRef = { value: [] };

// 忽略列表现在随设置同步到服务端（useDataStore.saveSettings → POST /api/settings），
// 所以要把 http 层挡掉，才能断言「确实发出了同步请求」以及「同步失败时的表现」。
const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('../../src/lib/http.js', () => ({
    api: {
        get: vi.fn(),
        post: postMock,
        put: vi.fn(),
        delete: vi.fn(),
    },
    APIError: class APIError extends Error {},
}));

vi.mock('vue-router', async () => {
    const actual = await vi.importActual('vue-router');
    return {
        ...actual,
        useRouter: () => ({ push: pushMock }),
    };
});

vi.mock('../../src/composables/useSubscriptions.js', () => ({
    useSubscriptions: () => ({
        totalRemainingTraffic: computed(() => 0),
        enabledSubscriptionsCount: computed(
            () => subscriptionsRef.value.filter((sub) => sub.enabled).length
        ),
        subscriptions: subscriptionsRef,
        addSubscriptionsFromBulk: vi.fn(),
    }),
}));

vi.mock('../../src/composables/useManualNodes.js', () => ({
    useManualNodes: () => ({
        manualNodes: manualNodesRef,
        addNodesFromBulk: vi.fn(),
    }),
}));
import DashboardView from '../../src/views/DashboardView.vue';
import { createI18n } from '../../src/i18n/index.js';
import { messages } from '../../src/i18n/messages.js';
import { useDataStore } from '../../src/stores/useDataStore.js';
import { useSettingsStore } from '../../src/stores/settings.js';
import { useToastStore } from '../../src/stores/toast.js';

function mountDashboard(locale = 'zh-CN') {
    return mount(DashboardView, {
        global: {
            // Reuse the Pinia activated in beforeEach: mounting with a fresh
            // instance would hide the fixtures seeded into the active store.
            plugins: [pinia, createI18n({ initialLocale: locale })],
            stubs: {
                SkeletonLoader: true,
                StatCards: true,
                RightPanel: true,
                BulkImportModal: true,
                ProfileModal: true,
                QRCodeModal: true,
                RouterLink: { template: '<a><slot /></a>' },
            },
        },
    });
}

const buildSub = (over = {}) => ({
    id: 'sub',
    enabled: true,
    nodeCount: 3,
    ...over,
});

// 忽略列表走「轻量偏好」保存：服务端据此跳过清节点缓存与 TG 通知。
const PREFERENCES_SAVE_OPTIONS = { headers: { 'X-MiSub-Save-Scope': 'preferences' } };

// One Pinia for the whole file, re-created per test and shared with `mount` so
// the component sees exactly the state each test seeds.
let pinia;

describe('DashboardView 待处理事项', () => {
    beforeEach(() => {
        pushMock.mockClear();
        subscriptionsRef.value = [];
        pinia = createPinia();
        setActivePinia(pinia);
        // 忽略列表已改为存在设置里，不再需要清 localStorage；
        // 但一次性迁移会读旧键，所以要把它清干净，避免用例互相污染。
        localStorage.clear();
        postMock.mockReset();
        postMock.mockResolvedValue({ success: true });
        const dataStore = useDataStore();
        dataStore.profiles = [{ id: 'profile-1', name: '日常', enabled: true, customId: 'daily' }];
        useSettingsStore().setConfig({ mytoken: 'stable-token', profileToken: 'share-token' });
    });

    // Regression: the view read `item.action` while the helper emitted
    // `secondaryAction`, so "打开日志" was a dead button.
    it('opens the log modal from the failed-subscription secondary action', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        const logButton = wrapper.findAll('button').find((button) => button.text() === '打开日志');

        expect(logButton).toBeTruthy();
        // Before the fix the button was inert: the helper emitted `secondaryAction`
        // while the view dispatched on `item.action`, so this call did nothing.
        await logButton.trigger('click');

        const { nextTick } = await import('vue');
        await nextTick();

        expect(wrapper.vm.showLogModal).toBe(true);
        // A secondary action must never navigate.
        expect(pushMock).not.toHaveBeenCalled();
    });

    // Regression: exceeding four items silently hid the remainder.
    it('collapses beyond four items but exposes the hidden count and an expand toggle', async () => {
        const expired = Math.floor(Date.now() / 1000) - 60;
        subscriptionsRef.value = [
            // Three expired subscriptions collapse into ONE `expired-subscriptions`
            // item, so distinct categories (not subscriptions) drive the count.
            buildSub({
                id: 'e1',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({
                id: 'e2',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({
                id: 'e3',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({ id: 'low', userInfo: { total: 100, upload: 95, download: 0 } }),
            buildSub({ id: 'failed', lastError: 'boom' }),
            // Disabled alongside enabled -> the `disabled-subscriptions` category.
            buildSub({ id: 'off', enabled: false }),
        ];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard();
        const expandButton = () =>
            wrapper.findAll('button').find((b) => /展开其余|收起/.test(b.text()));

        // auto-token + subscription-errors + expired + low-traffic + disabled.
        expect(wrapper.vm.dashboardHealthItems.map((item) => item.id)).toEqual([
            'auto-token',
            'subscription-errors',
            'expired-subscriptions',
            'low-traffic',
            'disabled-subscriptions',
        ]);
        expect(expandButton()).toBeTruthy();
        // The toggle reports how many are hidden, not the total.
        expect(expandButton().text()).toContain('展开其余 1 项');

        // Only four items are rendered up front.
        expect(wrapper.vm.visibleHealthItems.length).toBe(4);
        expect(wrapper.vm.hiddenHealthItemsCount).toBe(1);

        await expandButton().trigger('click');
        expect(wrapper.vm.visibleHealthItems.length).toBe(5);
        expect(wrapper.vm.hiddenHealthItemsCount).toBe(0);
        expect(expandButton().text()).toBe('收起');
    });

    it('does not render an expand toggle when every item already fits', () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'x' })];

        const wrapper = mountDashboard();
        const expandButton = wrapper.findAll('button').find((b) => /展开其余|收起/.test(b.text()));

        expect(expandButton).toBeUndefined();
        expect(wrapper.vm.hiddenHealthItemsCount).toBe(0);
    });

    it('still routes primary actions to their target with query params', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'x' })];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard();
        const primary = wrapper.findAll('button').find((b) => b.text() === '固定 Token');

        expect(primary).toBeTruthy();
        await primary.trigger('click');

        expect(pushMock).toHaveBeenCalledWith({
            path: '/dashboard/settings',
            query: { focus: 'mytoken' },
        });
    });

    it('renders the hidden-count toggle copy in English without leaking keys', async () => {
        const expired = Math.floor(Date.now() / 1000) - 60;
        subscriptionsRef.value = [
            buildSub({
                id: 'e1',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({
                id: 'e2',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({
                id: 'e3',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({ id: 'low', userInfo: { total: 100, upload: 95, download: 0 } }),
            buildSub({ id: 'failed', lastError: 'boom' }),
            buildSub({ id: 'off', enabled: false }),
        ];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard('en-US');
        const toggle = wrapper.findAll('button').find((b) => /Show \d+ more/.test(b.text()));

        expect(toggle).toBeTruthy();
        expect(wrapper.text()).not.toContain('dashboard.');
    });

    // Regression: the item copy used to be hardcoded Chinese, so the English UI
    // showed Chinese cards.
    it('renders health item copy in English instead of leaked Chinese', async () => {
        subscriptionsRef.value = [
            buildSub({ id: 'failed', lastError: 'timeout' }),
            buildSub({ id: 'off', enabled: false }),
        ];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard('en-US');
        await wrapper.vm.$nextTick();

        const text = wrapper.text();
        expect(text).toContain('1 source(s) failed to update');
        expect(text).toContain('View failed sources');
        expect(text).toContain('Open logs');
        expect(text).toContain('Main token is still automatic');

        // The old hardcoded Chinese must be gone entirely.
        expect(text).not.toContain('个订阅最近更新失败');
        expect(text).not.toContain('主 Token 仍为自动模式');
        expect(text).not.toContain('打开日志');
        expect(text).not.toContain('healthItems.');
    });

    it('still renders health item copy in Chinese for zh-CN', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard('zh-CN');
        await wrapper.vm.$nextTick();

        expect(wrapper.text()).toContain('1 个订阅最近更新失败');
        expect(wrapper.text()).toContain('打开日志');
        expect(wrapper.text()).toContain('主 Token 仍为自动模式');
    });

    // The dashboard links with a status filter the target view now honours.
    it('navigates with the status filter the subscriptions view consumes', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];
        useSettingsStore().setConfig({ mytoken: 'stable-token', profileToken: 'share-token' });

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        // A healthy profile + stable token leave the error subscription as the
        // only outstanding item, so this label is unambiguous.
        expect(wrapper.vm.dashboardHealthItems.map((item) => item.id)).toEqual([
            'subscription-errors',
        ]);

        const primary = wrapper.findAll('button').find((b) => b.text().trim() === '查看失败订阅');

        expect(primary).toBeTruthy();
        await primary.trigger('click');

        expect(pushMock).toHaveBeenCalledWith({
            path: '/dashboard/subscriptions',
            query: { status: 'error' },
        });
    });

    // Regression: the primary handler used to read `item.action`, so an item
    // carrying the secondary `openLog` key opened the log modal *instead of*
    // navigating — the "查看失败订阅" button led nowhere.
    it('navigates from the primary button even when the item also has an openLog action', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        const item = wrapper.vm.dashboardHealthItems.find((i) => i.id === 'subscription-errors');
        // Precondition: this item genuinely carries both an action and a route.
        expect(item.action).toBe('openLog');
        expect(item.actionRoute).toBe('/dashboard/subscriptions');

        wrapper.vm.handleHealthAction(item);

        expect(pushMock).toHaveBeenCalledWith({
            path: '/dashboard/subscriptions',
            query: { status: 'error' },
        });
        expect(wrapper.vm.showLogModal).toBe(false);
    });

    // The secondary button must still open the log modal and never navigate.
    it('dispatch the openLog secondary action without navigating', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        const item = wrapper.vm.dashboardHealthItems.find((i) => i.id === 'subscription-errors');
        wrapper.vm.handleHealthSecondaryAction(item);
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.showLogModal).toBe(true);
        expect(pushMock).not.toHaveBeenCalled();
    });

    // --- Dismissal ---
    // 忽略列表存在 settings.dismissedHealthItems 里并同步到服务端，
    // 所以这里不仅要断言「列表变了」，还要断言「发出了同步请求」。

    it('hides a dismissed item and syncs the new list to the server', async () => {
        subscriptionsRef.value = [
            buildSub({ id: 'failed', lastError: 'timeout' }),
            buildSub({ id: 'off', enabled: false }),
        ];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        const before = wrapper.vm.dashboardHealthItems.map((i) => i.id);
        expect(before).toContain('auto-token');
        expect(before).toContain('disabled-subscriptions');

        const dismiss = wrapper
            .findAll('[data-testid="health-item-dismiss"]')
            .find((b, idx) => wrapper.vm.visibleHealthItems[idx]?.id === 'auto-token');
        await dismiss.trigger('click');
        await flushPromises();

        expect(wrapper.vm.dashboardHealthItems.map((i) => i.id)).not.toContain('auto-token');
        expect(wrapper.vm.dismissedHealthItemsCount).toBe(1);
        // The rest of the list is untouched.
        expect(wrapper.vm.dashboardHealthItems.map((i) => i.id)).toContain(
            'disabled-subscriptions'
        );
        // 关键：同步到设置接口，而不是只留在本机
        expect(postMock).toHaveBeenCalledWith(
            '/api/settings',
            { dismissedHealthItems: ['auto-token'] },
            PREFERENCES_SAVE_OPTIONS
        );
    });

    it('shows a restore affordance only once something is dismissed', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        const restore = () => wrapper.find('[data-testid="health-items-restore"]');
        expect(restore().exists()).toBe(false);

        await wrapper.find('[data-testid="health-item-dismiss"]').trigger('click');
        await flushPromises();
        expect(restore().exists()).toBe(true);
        expect(restore().text()).toContain('1');
    });

    it('brings a dismissed item back on restore and clears it on the server', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        await wrapper.find('[data-testid="health-item-dismiss"]').trigger('click');
        await flushPromises();
        expect(wrapper.vm.dashboardHealthItems.length).toBe(0);
        expect(wrapper.vm.hasHealthItems).toBe(false);

        await wrapper.find('[data-testid="health-items-restore"]').trigger('click');
        await flushPromises();

        expect(wrapper.vm.dashboardHealthItems.length).toBe(1);
        expect(wrapper.vm.dismissedHealthItemsCount).toBe(0);
        expect(wrapper.find('[data-testid="health-items-restore"]').exists()).toBe(false);
        expect(postMock).toHaveBeenLastCalledWith(
            '/api/settings',
            { dismissedHealthItems: [] },
            PREFERENCES_SAVE_OPTIONS
        );
    });

    it('keeps the dismissal in the settings store so a remount still hides it', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const first = mountDashboard();
        await first.vm.$nextTick();
        await first.find('[data-testid="health-item-dismiss"]').trigger('click');
        await flushPromises();
        first.unmount();

        // beforeEach 用的是 stable-token，所以列表里没有 auto-token，
        // 首个可见项是失败订阅那一项。
        expect(useSettingsStore().config.dismissedHealthItems).toEqual(['subscription-errors']);

        const second = mountDashboard();
        await second.vm.$nextTick();

        expect(second.vm.dashboardHealthItems.length).toBe(0);
        expect(second.vm.dismissedHealthItemsCount).toBe(1);
    });

    it('surfaces an error toast and keeps the item when syncing fails', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];
        postMock.mockRejectedValueOnce(new Error('NetworkError'));

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        await wrapper.find('[data-testid="health-item-dismiss"]').trigger('click');
        await flushPromises();

        const { toasts } = useToastStore();
        // silent 模式下 saveSettings 自己不弹提示，由视图给出更贴切的文案
        expect(toasts).toHaveLength(1);
        expect(toasts[0].type).toBe('error');
        expect(toasts[0].message).toBe(messages['zh-CN'].dashboard.health.dismissFailed);
        // 同步失败时条目必须留在列表里，不能假装成功。
        expect(wrapper.vm.dashboardHealthItems.map((i) => i.id)).toContain('subscription-errors');
        expect(wrapper.vm.dismissedHealthItemsCount).toBe(0);
    });

    it('does not hit the server again for an already dismissed item', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];
        useSettingsStore().setConfig({ dismissedHealthItems: ['auto-token'] });

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        await wrapper.vm.dismissHealthItemById('auto-token');
        await flushPromises();

        expect(postMock).not.toHaveBeenCalled();
    });

    // --- 旧数据一次性迁移（老用户的忽略记录只在 localStorage 里） ---

    it('migrates legacy localStorage dismissals into the synced settings', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];
        // 用列表里真实存在的 id，否则迁移虽然成功但看不到效果
        localStorage.setItem('misub:dismissedHealthItems', JSON.stringify(['subscription-errors']));

        const wrapper = mountDashboard();
        await flushPromises();

        expect(postMock).toHaveBeenCalledWith(
            '/api/settings',
            { dismissedHealthItems: ['subscription-errors'] },
            PREFERENCES_SAVE_OPTIONS
        );
        expect(wrapper.vm.dismissedHealthItemsCount).toBe(1);
        // 旧键要清掉，否则每次启动都会重复迁移
        expect(localStorage.getItem('misub:dismissedHealthItems')).toBeNull();
    });

    it('does not resurrect legacy dismissals once the server already has a list', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];
        localStorage.setItem('misub:dismissedHealthItems', JSON.stringify(['auto-token']));
        useSettingsStore().setConfig({ dismissedHealthItems: ['low-traffic'] });

        const wrapper = mountDashboard();
        await flushPromises();

        // 服务端那份为准：它更新、且汇总了所有设备。
        // 否则会把用户在别的设备上「全部恢复」掉的项又塞回来。
        expect(postMock).not.toHaveBeenCalled();
        expect(wrapper.vm.dismissedHealthItemIds).toEqual(['low-traffic']);
        expect(localStorage.getItem('misub:dismissedHealthItems')).toBeNull();
    });

    it('keeps the legacy record when the migration cannot be synced', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];
        localStorage.setItem('misub:dismissedHealthItems', JSON.stringify(['auto-token']));
        postMock.mockRejectedValueOnce(new Error('boom'));

        mountDashboard();
        await flushPromises();

        // 写不进去就清掉等于把用户的记录丢了，所以留着下次启动再试。
        expect(localStorage.getItem('misub:dismissedHealthItems')).not.toBeNull();
    });

    it('renders the dismissal copy in English without leaking keys', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard('en-US');
        await wrapper.vm.$nextTick();

        await wrapper.find('[data-testid="health-item-dismiss"]').trigger('click');
        await flushPromises();

        const restore = wrapper.find('[data-testid="health-items-restore"]');
        expect(restore.text()).toContain('1 dismissed');
        expect(wrapper.text()).not.toContain('dashboard.');
    });

    // --- Terminology ---

    // The badge and the section title used to read "Pending" / "Pending" in
    // English, which the user could not tell apart.
    it('distinguishes the readiness badge from the section title', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard('en-US');
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.readinessText).toBe('Items pending');
        expect(wrapper.text()).toContain('Pending items');
        expect(wrapper.text()).not.toContain('有待处理事项');
    });

    it('keeps the Chinese badge and title wording distinct', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard('zh-CN');
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.readinessText).toBe('有待处理项');
        expect(wrapper.text()).toContain('待处理事项');
    });
});
