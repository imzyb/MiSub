import { beforeEach, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import QuickImportModal from '../../src/components/modals/QuickImportModal.vue';

describe('QuickImportModal', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/public');
  });

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

  it('uses mihomo deep link and an explicit Clash target for Clash-Party one-click import', async () => {
    delete window.location;
    window.location = { href: 'https://misub.example/public', origin: 'https://misub.example' };

    const wrapper = mount(QuickImportModal, {
      props: {
        show: true,
        profile: { id: 'p1', customId: '!luckyss', name: 'Lucky SS' },
        clients: [{ id: 'clash-party', name: 'Clash Party', platforms: ['windows'] }],
        profileToken: ''
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    });

    await wrapper.find('button.group').trigger('click');

    const expectedUrl = encodeURIComponent('https://misub.example/profiles/!luckyss?target=clash');
    expect(window.location.href).toBe(`mihomo://install-config?url=${expectedUrl}&name=Lucky%20SS`);
  });
});
