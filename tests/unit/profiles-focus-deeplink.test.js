import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/modals/LogModal.vue', () => ({ default: { template: '<div />' } }));
vi.mock('../../src/components/modals/ProfileModal.vue', () => ({
    default: { template: '<div />' },
}));
vi.mock('../../src/components/modals/NodePreview/NodePreviewModal.vue', () => ({
    default: { template: '<div />' },
}));
vi.mock('../../src/components/profiles/ProfilePanel.vue', () => ({
    default: { template: '<div />' },
}));
vi.mock('../../src/utils/network-error.js', () => ({
    showNetworkError: vi.fn(),
    isNetworkError: vi.fn(() => false),
}));
vi.mock('../../src/components/modals/QRCodeModal.vue', () => ({
    default: { template: '<div />' },
}));
vi.mock('../../src/components/modals/CopyLinkModal.vue', () => ({
    default: { template: '<div />' },
}));

const route = reactive({ query: {}, path: '/dashboard/settings' });

vi.mock('vue-router', async () => {
    const actual = await vi.importActual('vue-router');
    return {
        ...actual,
        useRoute: () => route,
        useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    };
});

import MySubscriptionsView from '../../src/views/MySubscriptionsView.vue';
import { createI18n } from '../../src/i18n/index.js';
import { useDataStore } from '../../src/stores/useDataStore.js';

const scrollSpy = vi.fn();
const mountedWrappers = [];
afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

function mountView() {
    const wrapper = mount(MySubscriptionsView, {
        global: {
            plugins: [createPinia(), createI18n({ initialLocale: 'zh-CN' })],
            stubs: {
                ProfilePanel: true,
                Modal: true,
                LogModal: true,
                ProfileModal: true,
                NodePreviewModal: true,
                QRCodeModal: true,
                CopyLinkModal: true,
            },
        },
    });
    mountedWrappers.push(wrapper);
    return wrapper;
}

describe('MySubscriptionsView 深链 focus (?focus=profiles)', () => {
    beforeEach(() => {
        scrollSpy.mockClear();
        route.query = {};
        route.path = '/dashboard/subscriptions';
        setActivePinia(createPinia());
        useDataStore().profiles = [];
        Element.prototype.scrollIntoView = scrollSpy;
    });

    it('exposes a stable anchor for the profiles section', () => {
        const wrapper = mountView();
        expect(wrapper.find('[data-testid="profiles-section"]').exists()).toBe(true);
    });

    it('scrolls to the profiles section when ?focus=profiles', async () => {
        route.query = { focus: 'profiles' };
        const wrapper = mountView();
        await wrapper.vm.$nextTick();

        expect(scrollSpy).toHaveBeenCalled();
    });

    it('does not scroll when no focus is requested', async () => {
        const wrapper = mountView();
        await wrapper.vm.$nextTick();

        expect(scrollSpy).not.toHaveBeenCalled();
    });

    it('ignores an unrecognised focus value', async () => {
        route.query = { focus: 'mytoken' };
        const wrapper = mountView();
        await wrapper.vm.$nextTick();

        // mytoken belongs to the settings page, not the subscriptions page.
        expect(scrollSpy).not.toHaveBeenCalled();
    });
});
