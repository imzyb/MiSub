import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import LogModal from '../../src/components/modals/LogModal.vue';
import { createI18n } from '../../src/i18n/index.js';

const state = vi.hoisted(() => ({
    logs: [
        { id: 'a', profileId: 'p1', profileName: 'Same', clientIp: '1.1.1.1', timestamp: 1, status: 'success', userAgent: 'Clash' },
        { id: 'b', profileId: 'p2', profileName: 'Same', clientIp: '2.2.2.2', timestamp: 2, status: 'success', userAgent: 'Clash' },
        { id: 'c', profileName: 'Same', clientIp: '3.3.3.3', timestamp: 3, status: 'success', userAgent: 'Clash' },
    ],
}));

vi.mock('../../src/lib/http.js', () => ({
    api: {
        get: vi.fn(async () => ({ data: state.logs })),
        del: vi.fn(async () => ({})),
    },
}));

vi.mock('../../src/stores/toast', () => ({
    useToastStore: () => ({ showToast: vi.fn() }),
}));

function mountModal(props = {}) {
    return mount(LogModal, {
        props: { show: false, ...props },
        global: {
            plugins: [createPinia(), createI18n({ initialLocale: 'en-US' })],
            stubs: { Teleport: true },
        },
    });
}

describe('LogModal profile filtering', () => {
    it('keeps same-named profiles apart when filtering by unique profile id', async () => {
        const wrapper = mountModal({ filterProfileId: 'p1', filterProfileName: 'Same' });
        await wrapper.setProps({ show: true });
        await flushPromises();
        const text = wrapper.text();
        expect(text).toContain('1.1.1.1');
        expect(text).not.toContain('2.2.2.2');
        expect(text).not.toContain('3.3.3.3');
    });

    it('keeps legacy logs out of per-profile views but visible globally', async () => {
        const scoped = mountModal({ filterProfileId: 'p2', filterProfileName: 'Same' });
        await scoped.setProps({ show: true });
        await flushPromises();
        const scopedText = scoped.text();
        expect(scopedText).toContain('2.2.2.2');
        expect(scopedText).not.toContain('1.1.1.1');
        expect(scopedText).not.toContain('3.3.3.3');

        const global = mountModal();
        await global.setProps({ show: true });
        await flushPromises();
        expect(global.text()).toContain('3.3.3.3');
    });

    it('shows every log when no filter is supplied', async () => {
        const wrapper = mountModal();
        await wrapper.setProps({ show: true });
        await flushPromises();
        const text = wrapper.text();
        expect(text).toContain('1.1.1.1');
        expect(text).toContain('2.2.2.2');
        expect(text).toContain('3.3.3.3');
    });
});
