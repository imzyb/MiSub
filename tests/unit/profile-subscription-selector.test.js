import { computed, defineComponent } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ProfileModal from '../../src/components/modals/ProfileModal.vue';
import SubscriptionSelector from '../../src/components/modals/ProfileModal/SubscriptionSelector.vue';
import { createI18n } from '../../src/i18n/index.js';

vi.mock('../../src/composables/useManualNodes.js', () => ({
    useManualNodes: () => ({ manualNodeGroups: computed(() => []) }),
}));

const ModalStub = defineComponent({
    template: '<div><slot name="body" /></div>',
});

const DraggableStub = defineComponent({
    name: 'Draggable',
    props: {
        modelValue: {
            type: Array,
            default: () => [],
        },
    },
    emits: ['update:modelValue'],
    template:
        '<button data-test="reorder" @click="$emit(\'update:modelValue\', [...modelValue].reverse())">reorder</button>',
});

describe('profile subscription selection', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('only displays enabled airport subscriptions', () => {
        const wrapper = mount(ProfileModal, {
            props: {
                show: true,
                isNew: false,
                profile: {
                    id: 'profile-1',
                    name: 'Profile',
                    subscriptions: ['enabled-sub', 'disabled-sub'],
                    manualNodes: [],
                },
                allSubscriptions: [
                    {
                        id: 'enabled-sub',
                        name: 'Enabled Airport',
                        url: 'https://enabled.example/sub',
                        enabled: true,
                    },
                    {
                        id: 'disabled-sub',
                        name: 'Disabled Airport',
                        url: 'https://disabled.example/sub',
                        enabled: false,
                    },
                ],
                allManualNodes: [],
            },
            global: {
                plugins: [createI18n(), createPinia()],
                stubs: {
                    Modal: ModalStub,
                    ProfileForm: true,
                    NodeSelector: true,
                    Draggable: true,
                },
            },
        });

        expect(wrapper.text()).toContain('Enabled Airport');
        expect(wrapper.text()).not.toContain('Disabled Airport');
    });

    it('preserves hidden disabled selections when visible subscriptions are reordered', async () => {
        const wrapper = mount(SubscriptionSelector, {
            props: {
                subscriptions: [
                    { id: 'enabled-a', name: 'Airport A' },
                    { id: 'enabled-b', name: 'Airport B' },
                ],
                filteredSubscriptions: [],
                selectedIds: ['enabled-a', 'disabled-hidden', 'enabled-b'],
            },
            global: {
                plugins: [createI18n()],
                stubs: { Draggable: DraggableStub },
            },
        });

        await wrapper.get('[data-test="reorder"]').trigger('click');

        expect(wrapper.emitted('update:selectedIds')).toEqual([
            [['enabled-b', 'disabled-hidden', 'enabled-a']],
        ]);
    });
});
