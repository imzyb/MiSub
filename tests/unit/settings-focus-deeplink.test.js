import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const route = reactive({ query: {}, path: '/dashboard/settings' });

vi.mock('vue-router', async () => {
    const actual = await vi.importActual('vue-router');
    return {
        ...actual,
        useRoute: () => route,
        useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    };
});

// The view loads settings on mount; stub the composable so the suite stays
// offline and focused on the deep-link behaviour.
vi.mock('../../src/composables/useSettingsLogic.js', () => ({
    useSettingsLogic: () => ({
        settings: { mytoken: 'stable-token', profileToken: 'share-token' },
        disguiseConfig: {},
        isLoading: false,
        isSaving: false,
        showMigrationModal: false,
        hasWhitespace: false,
        isStorageTypeValid: true,
        loadSettings: vi.fn(),
        handleSave: vi.fn(),
        handleMigrationSuccess: vi.fn(),
        handleReset: vi.fn(),
        exportBackup: vi.fn(),
        importBackup: vi.fn(),
    }),
}));

import SettingsView from '../../src/views/SettingsView.vue';
import { createI18n } from '../../src/i18n/index.js';

const scrollSpy = vi.fn();

function mountView() {
    return mount(SettingsView, {
        global: {
            plugins: [createPinia(), createI18n({ initialLocale: 'zh-CN' })],
            stubs: {
                SettingsLayout: {
                    template: '<div><slot name="sidebar" /><slot /><slot name="footer" /></div>',
                },
                SettingsSidebar: true,
                BasicSettings: true,
                HomeSettings: true,
                GlobalSettings: true,
                ServiceSettings: true,
                ClientSettings: true,
                CustomPageSettings: true,
                SystemSettings: true,
                WebdavBackupSettings: true,
                MigrationModal: true,
            },
        },
    });
}

describe('SettingsView 深链 focus (?focus=mytoken / profileToken)', () => {
    beforeEach(() => {
        scrollSpy.mockClear();
        route.query = {};
        route.path = '/dashboard/settings';
        setActivePinia(createPinia());
        Element.prototype.scrollIntoView = scrollSpy;
    });

    it('defaults to the basic tab when no focus is present', () => {
        const wrapper = mountView();
        expect(wrapper.vm.activeTab).toBe('basic');
        expect(scrollSpy).not.toHaveBeenCalled();
    });

    it('selects the basic tab and highlights the main token field for ?focus=mytoken', async () => {
        route.query = { focus: 'mytoken' };
        const wrapper = mountView();
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.activeTab).toBe('basic');
        expect(wrapper.vm.highlightedFocusId).toBe('setting-mytoken');
    });

    it('highlights the profile token field for ?focus=profileToken', async () => {
        route.query = { focus: 'profileToken' };
        const wrapper = mountView();
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.activeTab).toBe('basic');
        expect(wrapper.vm.highlightedFocusId).toBe('setting-profileToken');
    });

    it('ignores an unknown focus and keeps the default tab', async () => {
        route.query = { focus: 'bogus' };
        const wrapper = mountView();
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.activeTab).toBe('basic');
        expect(wrapper.vm.highlightedFocusId).toBe('');
    });

    it('re-applies the focus when the query changes while mounted', async () => {
        const wrapper = mountView();
        expect(wrapper.vm.highlightedFocusId).toBe('');

        route.query = { focus: 'profileToken' };
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.highlightedFocusId).toBe('setting-profileToken');
    });
});
