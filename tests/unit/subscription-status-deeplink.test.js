import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Reactive so the view's `watch(() => route.query.status)` actually fires.
const route = reactive({ query: {}, path: '/dashboard/subscriptions' });
const replaceMock = vi.fn();

vi.mock('vue-router', async () => {
    const actual = await vi.importActual('vue-router');
    return {
        ...actual,
        useRoute: () => route,
        useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
    };
});

import SubscriptionGroupsView from '../../src/views/SubscriptionGroupsView.vue';
import { createI18n } from '../../src/i18n/index.js';
import { useDataStore } from '../../src/stores/useDataStore.js';

const expired = Math.floor(Date.now() / 1000) - 60;

// useSubscriptions only treats entries with an http(s) URL as subscriptions,
// so every fixture needs one to be visible to the view.
const withUrl = (entry) => ({ url: `https://example.com/${entry.id}`, ...entry });

const seed = {
    failed: withUrl({
        id: 'failed',
        name: 'Failed',
        enabled: true,
        nodeCount: 3,
        lastError: 'boom',
    }),
    off: withUrl({ id: 'off', name: 'Off', enabled: false, nodeCount: 2 }),
    empty: withUrl({ id: 'empty', name: 'Empty', enabled: true, nodeCount: 0 }),
    expired: withUrl({
        id: 'expired',
        name: 'Expired',
        enabled: true,
        nodeCount: 5,
        userInfo: { total: 100, upload: 1, download: 1, expire: expired },
    }),
    healthy: withUrl({ id: 'healthy', name: 'Healthy', enabled: true, nodeCount: 4 }),
    low: withUrl({
        id: 'low',
        name: 'Low',
        enabled: true,
        nodeCount: 4,
        userInfo: { total: 100, upload: 90, download: 0 },
    }),
};

let pinia;

function mountView(locale = 'zh-CN') {
    return mount(SubscriptionGroupsView, {
        global: {
            plugins: [pinia, createI18n({ initialLocale: locale })],
            stubs: {
                SubscriptionPanel: false,
                Modal: true,
                SubscriptionEditModal: true,
                BulkImportModal: true,
                NodePreviewModal: true,
                QRCodeModal: true,
                draggable: true,
            },
        },
    });
}

describe('SubscriptionGroupsView 深链状态筛选 (?status=)', () => {
    beforeEach(() => {
        replaceMock.mockClear();
        route.query = {};
        // The view and the test must share one Pinia instance, otherwise the
        // seeded subscriptions never reach the component.
        pinia = createPinia();
        setActivePinia(pinia);
        useDataStore().subscriptions = Object.values(seed);
    });

    it('filters the list to failed sources when ?status=error', async () => {
        route.query = { status: 'error' };
        const wrapper = mountView();
        // onMounted applies the filter; props settle on the next tick.
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.activeStatusFilter).toBe('error');
        expect(wrapper.vm.visibleSubscriptions.map((s) => s.id)).toEqual(['failed']);
        expect(wrapper.find('[data-testid="subscription-status-filter"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('仅显示最近更新失败的订阅');
    });

    it('filters disabled, expired, zero-node and low-traffic statuses', async () => {
        route.query = { status: 'disabled' };
        expect(mountView().vm.visibleSubscriptions.map((s) => s.id)).toEqual(['off']);

        route.query = { status: 'expired' };
        expect(mountView().vm.visibleSubscriptions.map((s) => s.id)).toEqual(['expired']);

        route.query = { status: 'zero-nodes' };
        expect(mountView().vm.visibleSubscriptions.map((s) => s.id)).toEqual(['empty']);

        route.query = { status: 'low-traffic' };
        expect(mountView().vm.visibleSubscriptions.map((s) => s.id)).toEqual(['low']);
    });

    it('shows the full list when no status is present', () => {
        const wrapper = mountView();
        expect(wrapper.vm.activeStatusFilter).toBe('');
        expect(wrapper.vm.visibleSubscriptions.length).toBe(6);
    });

    it('ignores an unrecognised status instead of showing an empty list', () => {
        route.query = { status: 'bogus' };
        const wrapper = mountView();

        expect(wrapper.vm.activeStatusFilter).toBe('');
        expect(wrapper.vm.visibleSubscriptions.length).toBe(6);
    });

    it('clears the filter and strips the query param', async () => {
        route.query = { status: 'error' };
        const wrapper = mountView();

        await wrapper.vm.clearStatusFilter();

        expect(wrapper.vm.activeStatusFilter).toBe('');
        expect(replaceMock).toHaveBeenCalledWith({ query: {} });
    });

    it('keeps the filter in sync when the query changes while mounted', async () => {
        const wrapper = mountView();
        expect(wrapper.vm.visibleSubscriptions.length).toBe(6);

        // A second navigation from the dashboard updates the query in place.
        route.query = { status: 'error' };
        await wrapper.vm.$nextTick();

        // The watcher on route.query.status drives applyStatusFromQuery.
        expect(wrapper.vm.activeStatusFilter).toBe('error');
        expect(wrapper.vm.visibleSubscriptions.map((s) => s.id)).toEqual(['failed']);
    });

    it('renders the English filter label without leaking i18n keys', async () => {
        route.query = { status: 'error' };
        const wrapper = mountView('en-US');
        await wrapper.vm.$nextTick();

        expect(wrapper.find('[data-testid="subscription-status-filter"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('Showing sources that failed to update');
        expect(wrapper.text()).not.toContain('subscriptions.');
    });
});
