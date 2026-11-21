import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import ProfileForm from '../../src/components/modals/ProfileModal/ProfileForm.vue';
import { createI18n } from '../../src/i18n/index.js';

function mountForm(overrides = {}, locale = 'zh-CN') {
    const localProfile = {
        id: 'uuid-1',
        linkId: 'uuid-1',
        customId: '',
        name: 'Demo',
        enabled: true,
        isPublic: false,
        subscriptions: [],
        manualNodes: [],
        subProfiles: [],
        operators: [],
        prefixSettings: {},
        subconverter: { engineMode: '' },
        transformConfigMode: 'preset',
        ...overrides,
    };
    const wrapper = mount(ProfileForm, {
        props: {
            localProfile,
            uiText: {},
            globalSettings: { subconverter: { engineMode: 'builtin' } },
            prefixToggleOptions: [],
            groupPrefixToggleOptions: [],
        },
        global: {
            plugins: [createPinia(), createI18n({ initialLocale: locale })],
            stubs: { teleport: true },
        },
    });
    return { wrapper, localProfile };
}

describe('ProfileForm subscription ID field', () => {
    it('shows the effective subscription id in the placeholder when the input is empty', () => {
        const { wrapper } = mountForm();
        expect(wrapper.find('#profile-custom-id').attributes('placeholder')).toBe(
            '留空则使用 uuid-1'
        );
    });

    it('falls back to the generic placeholder for an unsaved profile', () => {
        const { wrapper } = mountForm({ id: undefined, linkId: undefined });
        expect(wrapper.find('#profile-custom-id').attributes('placeholder')).not.toContain(
            '留空则使用'
        );
    });

    it('renders an inline reset button that rotates linkId and clears customId', async () => {
        const { wrapper, localProfile } = mountForm({ customId: 'home' });
        const reset = wrapper.findAll('button').find((b) => b.text() === '重置');
        expect(reset).toBeTruthy();

        await reset.trigger('click');
        const confirm = wrapper.findAll('button').find((b) => b.text() === '确认');
        expect(confirm).toBeTruthy();

        await confirm.trigger('click');
        expect(localProfile.customId).toBe('');
        expect(localProfile.linkId).not.toBe('uuid-1');
    });
});
