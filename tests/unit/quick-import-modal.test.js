import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import QuickImportModal from '../../src/components/modals/QuickImportModal.vue';

describe('QuickImportModal', () => {
  it('renders through shared Modal and emits close on visibility update', async () => {
    const wrapper = mount(QuickImportModal, {
      props: {
        show: true,
        profile: { id: 'p1', name: 'Demo' },
        clients: [],
        profileToken: 'profiles'
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    });

    expect(wrapper.text()).toContain('选择客户端导入');
    await wrapper.findComponent({ name: 'Modal' }).vm.$emit('update:show', false);

    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
