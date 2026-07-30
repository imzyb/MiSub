import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CopyLinkModal from '../../src/components/modals/CopyLinkModal.vue';
import { useDataStore } from '../../src/stores/useDataStore.js';

const modalStub = {
  props: ['show'],
  template: '<div v-if="show"><slot name="title" /><slot name="body" /></div>'
};

describe('CopyLinkModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies a native sing-box link instead of a base64 link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    const wrapper = mount(CopyLinkModal, {
      props: {
        show: true,
        token: 'share-token',
        profile: { id: 'p1', customId: 'daily', name: '日常使用' }
      },
      global: {
        plugins: [createPinia()],
        stubs: { Modal: modalStub }
      }
    });

    const singBoxItem = wrapper.findAll('.cursor-pointer').find(item => item.text().includes('Sing-Box'));
    expect(singBoxItem).toBeTruthy();
    await singBoxItem.trigger('click');

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/share-token/daily?singbox`);
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('?base64'));
  });

  it('lists stored full profile templates as profile-specific output links', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    const pinia = createPinia();
    setActivePinia(pinia);
    useDataStore().ruleTemplates = [{
      id: 'android-singbox',
      name: 'Android 私有配置',
      type: 'profile',
      target: 'singbox',
      enabled: true
    }];
    const wrapper = mount(CopyLinkModal, {
      props: {
        show: true,
        token: 'share-token',
        profile: { id: 'p1', customId: 'daily', name: '日常使用' }
      },
      global: {
        plugins: [pinia],
        stubs: { Modal: modalStub }
      }
    });

    const templateItem = wrapper.findAll('.cursor-pointer').find(item => item.text().includes('Android 私有配置'));
    expect(templateItem).toBeTruthy();
    await templateItem.trigger('click');

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/share-token/daily?target=singbox&template=custom%3Aandroid-singbox`
    );
  });
});
