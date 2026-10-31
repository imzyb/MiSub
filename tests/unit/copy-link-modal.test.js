import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CopyLinkModal from '../../src/components/modals/CopyLinkModal.vue';

const modalStub = {
    props: ['show'],
    template: '<div v-if="show"><slot name="title" /><slot name="body" /></div>',
};

describe('CopyLinkModal', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('copies a native sing-box link instead of a base64 link', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
        const wrapper = mount(CopyLinkModal, {
            props: {
                show: true,
                token: 'share-token',
                profile: { id: 'p1', customId: 'daily', name: '日常使用' },
            },
            global: {
                plugins: [createPinia()],
                stubs: { Modal: modalStub },
            },
        });

        const singBoxItem = wrapper
            .findAll('.cursor-pointer')
            .find((item) => item.text().includes('Sing-Box'));
        expect(singBoxItem).toBeTruthy();
        await singBoxItem.trigger('click');

        expect(writeText).toHaveBeenCalledWith(
            `${window.location.origin}/share-token/daily?singbox`
        );
        expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('?base64'));
    });
});
