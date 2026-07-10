import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import LogModal from '../../src/components/modals/LogModal.vue';
import QuickImportModal from '../../src/components/modals/QuickImportModal.vue';
import ManualNodeDedupModal from '../../src/components/modals/ManualNodeDedupModal.vue';
import ManualNodeEditModal from '../../src/components/modals/ManualNodeEditModal.vue';
import { createI18n } from '../../src/i18n/index.js';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../src/lib/http.js', () => ({
  api: {
    get: vi.fn(async () => ({ data: [] })),
    del: vi.fn(async () => ({}))
  }
}));

vi.mock('../../src/stores/toast', () => ({
  useToastStore: () => ({ showToast: vi.fn() })
}));

const englishGlobal = () => ({
  plugins: [createI18n({ initialLocale: 'en-US' })],
  stubs: {
    Teleport: true
  }
});

const expectEnglishOnly = (text) => {
  expect(text).not.toMatch(/[\u4e00-\u9fff]/);
  expect(text).not.toMatch(/\b(logs|quickImport|manualNodes|common|actions)\./);
};

describe('modal English translations', () => {
  it('renders subscription access log modal in English', async () => {
    const wrapper = mount(LogModal, {
      props: { show: true },
      global: englishGlobal()
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Subscription access logs');
    expect(wrapper.text()).toContain('No log records yet');
    expect(wrapper.text()).toContain('Refresh');
    expect(wrapper.text()).toContain('Clear');
    expectEnglishOnly(wrapper.text());
  });

  it('renders quick import modal in English', () => {
    const wrapper = mount(QuickImportModal, {
      props: {
        show: true,
        profile: { id: 'p1', name: 'Demo' },
        clients: [],
        profileToken: 'profiles'
      },
      global: englishGlobal()
    });

    expect(wrapper.text()).toContain('Choose client import');
    expect(wrapper.text()).toContain('No clients support one-click import yet');
    expect(wrapper.text()).toContain('Tips:');
    expectEnglishOnly(wrapper.text());
  });

  it('renders manual node dedup modal in English', () => {
    const wrapper = mount(ManualNodeDedupModal, {
      props: {
        show: true,
        plan: {
          removeCount: 1,
          keepCount: 2,
          removeNodes: [{ id: 'n1', url: 'vmess://example' }]
        }
      },
      global: englishGlobal()
    });

    expect(wrapper.text()).toContain('Confirm deduplication');
    expect(wrapper.text()).toContain('Preview nodes to remove');
    expect(wrapper.text()).toContain('Unnamed node');
    expectEnglishOnly(wrapper.text());
  });

  it('renders manual node edit modal in English', () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(ManualNodeEditModal, {
      props: {
        show: true,
        isNew: true,
        editingNode: { name: '', group: '', url: '' },
        groups: []
      },
      global: {
        plugins: [createI18n({ initialLocale: 'en-US' }), pinia],
        stubs: {
          Teleport: true
        }
      }
    });

    expect(wrapper.text()).toContain('Add manual node');
    expect(wrapper.text()).toContain('Edit a single node');
    expect(wrapper.text()).toContain('Node name (optional)');
    expect(wrapper.text()).toContain('Group (optional)');
    expect(wrapper.find('textarea').attributes('placeholder')).toContain('Enter one link');
    expectEnglishOnly(wrapper.text());
  });
});
