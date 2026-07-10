import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import PublicProfilesView from '../../src/views/PublicProfilesView.vue';

vi.mock('../../src/lib/http.js', () => ({
  api: {
    get: vi.fn()
  }
}));

vi.mock('../../src/stores/toast.js', () => ({
  useToastStore: () => ({
    showToast: vi.fn()
  })
}));

vi.mock('../../src/components/modals/NodePreview/NodePreviewModal.vue', () => ({
  default: { template: '<div />' }
}));
vi.mock('../../src/components/features/AnnouncementCard.vue', () => ({
  default: { template: '<div />' }
}));
vi.mock('../../src/components/modals/GuestbookModal.vue', () => ({
  default: { template: '<div />' }
}));
vi.mock('../../src/components/modals/QuickImportModal.vue', () => ({
  default: { template: '<div />' }
}));

import { api } from '../../src/lib/http.js';

describe('PublicProfilesView hero loading state', () => {
  let wrapper;

  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation((url) => {
      if (url === '/api/clients') {
        return Promise.resolve({ success: true, data: [] });
      }
      return Promise.resolve({ success: true, data: [] });
    });
  });

  afterEach(async () => {
    await vi.dynamicImportSettled();
    wrapper?.unmount();
    vi.clearAllMocks();
  });

  it('does not flash fallback hero text before the public profile config loads', async () => {
    let resolveProfiles;
    api.get.mockImplementation((url) => {
      if (url === '/api/public/profiles') {
        return new Promise((resolve) => {
          resolveProfiles = resolve;
        });
      }
      if (url === '/api/clients') {
        return Promise.resolve({ success: true, data: [] });
      }
      return Promise.resolve({ success: true, data: [] });
    });

    wrapper = mount(PublicProfilesView, {
      global: {
        stubs: {
          ProfileGrid: true,
          BaseIcon: true,
          AnnouncementCard: true,
          GuestbookModal: true,
          QuickImportModal: true,
          NodePreviewModal: true
        }
      }
    });

    expect(wrapper.text()).not.toContain('发现');
    expect(wrapper.text()).not.toContain('优质订阅');

    resolveProfiles({
      success: true,
      data: [{ id: '1', name: 'Demo', enabled: true }],
      config: {
        hero: {
          title1: '自定义发现',
          title2: '自定义订阅',
          description: '自定义描述'
        }
      }
    });

    await flushPromises();
    await vi.dynamicImportSettled();

    expect(wrapper.text()).toContain('自定义发现');
    expect(wrapper.text()).toContain('自定义订阅');
    expect(wrapper.text()).toContain('自定义描述');
  });

  it('does not flash the default public page before custom page config loads', async () => {
    let resolveProfiles;
    api.get.mockImplementation((url) => {
      if (url === '/api/public/profiles') {
        return new Promise((resolve) => {
          resolveProfiles = resolve;
        });
      }
      if (url === '/api/clients') {
        return Promise.resolve({ success: true, data: [] });
      }
      return Promise.resolve({ success: true, data: [] });
    });

    wrapper = mount(PublicProfilesView, {
      global: {
        stubs: {
          ProfileGrid: true,
          BaseIcon: true,
          AnnouncementCard: true,
          GuestbookModal: true,
          QuickImportModal: true,
          NodePreviewModal: true,
          CustomPublicRenderer: {
            template: '<div class="custom-renderer-stub">自定义公开页</div>'
          }
        }
      }
    });

    expect(wrapper.text()).not.toContain('Cosmic Selection');
    expect(wrapper.text()).not.toContain('发现');
    expect(wrapper.text()).not.toContain('优质订阅');

    resolveProfiles({
      success: true,
      data: [{ id: '1', name: 'Demo', enabled: true }],
      config: {
        customPage: {
          enabled: true,
          content: '<div>{{profiles}}</div>',
          css: '',
          useDefaultLayout: true
        }
      }
    });

    await flushPromises();
    await vi.dynamicImportSettled();

    expect(wrapper.text()).toContain('自定义公开页');
    expect(wrapper.text()).not.toContain('Cosmic Selection');
  });

  it('renders custom public page as full-bleed when default layout is disabled', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/public/profiles') {
        return Promise.resolve({
          success: true,
          data: [{ id: '1', name: 'Demo', enabled: true }],
          config: {
            customPage: {
              enabled: true,
              content: '<section>Immersive</section>',
              css: '',
              useDefaultLayout: false
            }
          }
        });
      }
      if (url === '/api/clients') {
        return Promise.resolve({ success: true, data: [] });
      }
      return Promise.resolve({ success: true, data: [] });
    });

    wrapper = mount(PublicProfilesView, {
      global: {
        stubs: {
          ProfileGrid: true,
          BaseIcon: true,
          AnnouncementCard: true,
          GuestbookModal: true,
          QuickImportModal: true,
          NodePreviewModal: true,
          CustomPublicRenderer: {
            inheritAttrs: false,
            template: '<div class="custom-renderer-stub" :class="$attrs.class">自定义公开页</div>'
          }
        }
      }
    });

    await flushPromises();
    await vi.dynamicImportSettled();

    const renderer = wrapper.find('.custom-renderer-stub');
    expect(renderer.exists()).toBe(true);
    expect(renderer.classes()).toContain('min-h-[100dvh]');
    expect(renderer.classes()).toContain('w-full');
    expect(renderer.classes()).not.toContain('max-w-7xl');
  });
});
