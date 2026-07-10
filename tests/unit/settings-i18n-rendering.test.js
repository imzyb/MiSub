import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BasicSettings from '../../src/components/settings/sections/BasicSettings.vue';
import ClientSettings from '../../src/components/settings/sections/ClientSettings.vue';
import TransformCard from '../../src/components/settings/sections/ServiceSettings/TransformCard.vue';
import RuleTemplateManager from '../../src/components/settings/sections/ServiceSettings/RuleTemplateManager.vue';
import TelegramCard from '../../src/components/settings/sections/ServiceSettings/TelegramCard.vue';
import SystemSettings from '../../src/components/settings/sections/SystemSettings.vue';
import { createI18n } from '../../src/i18n/index.js';

vi.mock('../../src/lib/http.js', () => ({
  api: {
    get: vi.fn(async (url) => {
      if (url === '/api/clients') {
        return {
          success: true,
          data: [
            {
              id: 'clash-verge',
              name: 'Clash Verge',
              icon: '🌐',
              description: 'Desktop client',
              platforms: ['windows'],
              url: 'https://example.com',
              repo: 'example/client'
            }
          ]
        };
      }
      return { success: true, data: [] };
    }),
    post: vi.fn(async () => ({ success: true, data: [] })),
    del: vi.fn(async () => ({ success: true, data: [] }))
  }
}));

vi.mock('../../src/stores/toast', () => ({
  useToastStore: () => ({ showToast: vi.fn() })
}));

const SwitchStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<button type="button" />'
};

const ModalStub = {
  props: ['show', 'title', 'confirmText', 'cancelText'],
  emits: ['update:show', 'confirm'],
  template: '<section v-if="show"><h2>{{ title }}</h2><slot name="body" /><slot name="footer" /></section>'
};

const englishMountOptions = () => ({
  global: {
    plugins: [createI18n({ initialLocale: 'en-US' })],
    stubs: {
      Switch: SwitchStub,
      Modal: ModalStub
    }
  }
});

const expectNoChineseOrKeys = (text) => {
  expect(text).not.toMatch(/[\u4e00-\u9fff]/);
  expect(text).not.toContain('settings.');
};

describe('settings page English translations', () => {
  it('renders BasicSettings access control copy in English', () => {
    const wrapper = mount(BasicSettings, {
      props: {
        settings: {
          FileName: '',
          mytoken: 'token',
          profileToken: 'profile-token',
          customLoginPath: 'admin',
          enablePublicPage: true,
          enableAccessLog: false,
          accessLogMode: 'light',
          showRemainingTraffic: true,
          autoUpdateInterval: 0
        },
        disguiseConfig: {
          enabled: true,
          pageType: 'redirect',
          redirectUrl: 'example.com'
        }
      },
      ...englishMountOptions()
    });

    expect(wrapper.text()).toContain('Web Access Control');
    expect(wrapper.text()).toContain('Allow public access without login');
    expect(wrapper.text()).toContain('Disguise strategy');
    expect(wrapper.text()).toContain('Target URL');
    expectNoChineseOrKeys(wrapper.text());
  });

  it('renders ClientSettings management copy in English', async () => {
    const wrapper = mount(ClientSettings, englishMountOptions());
    await flushPromises();

    expect(wrapper.text()).toContain('Client Management');
    expect(wrapper.text()).toContain('Reset defaults');
    expect(wrapper.text()).toContain('Add client');
    expect(wrapper.text()).toContain('Up');
    expect(wrapper.text()).toContain('Down');
    expect(wrapper.text()).toContain('Edit');
    expectNoChineseOrKeys(wrapper.text());
  });

  it('renders service cards in English without leaking keys', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const transform = mount(TransformCard, {
      props: {
        settings: {
          transformConfigMode: 'preset',
          transformConfig: '',
          builtinSkipCertVerify: false,
          builtinEnableUdp: false,
          ruleLevel: 'std',
          subconverter: {
            engineMode: 'external',
            defaultBackend: 'api.v1.mk',
            defaultOptions: { udp: true, emoji: true, scv: true, tfo: false, sort: false, list: false }
          }
        }
      },
      global: {
        plugins: [createI18n({ initialLocale: 'en-US' }), pinia],
        stubs: {
          TransformSelector: true,
          RuleTemplateManager: true
        }
      }
    });

    expect(transform.text()).toContain('Default conversion engine');
    expect(transform.text()).toContain('External backend parameters');
    expect(transform.text()).toContain('Test backend availability');
    expectNoChineseOrKeys(transform.text());

    const telegram = mount(TelegramCard, {
      props: {
        settings: {
          BotToken: '',
          ChatID: '',
          telegram_push_config: {
            enabled: true,
            bot_token: '',
            webhook_secret: '',
            allowed_user_ids: [],
            allow_all_users: false
          }
        }
      },
      ...englishMountOptions()
    });

    expect(telegram.text()).toContain('Telegram notification bot');
    expect(telegram.text()).toContain('Webhook Secret (required)');
    expect(telegram.text()).toContain('setWebhook link');
    expectNoChineseOrKeys(telegram.text());

    const rules = mount(RuleTemplateManager, {
      global: {
        plugins: [createI18n({ initialLocale: 'en-US' }), pinia]
      }
    });
    await flushPromises();

    expect(rules.text()).toContain('Custom rule templates');
    expect(rules.text()).toContain('No custom rule templates yet');
    expectNoChineseOrKeys(rules.text());
  });

  it('renders SystemSettings storage backup external api and admin security copy in English', () => {
    const wrapper = mount(SystemSettings, {
      props: {
        settings: { storageType: 'd1', externalApi: { enabled: true, tokens: [{ name: 'default', token: 'secret' }] } },
        exportBackup: vi.fn(),
        importBackup: vi.fn(),
        handleReset: vi.fn()
      },
      ...englishMountOptions()
    });

    expect(wrapper.text()).toContain('Data storage type');
    expect(wrapper.text()).toContain('D1 database (recommended)');
    expect(wrapper.text()).toContain('External management API');
    expect(wrapper.text()).toContain('Bearer token');
    expect(wrapper.text()).toContain('Generate random token');
    expect(wrapper.text()).toContain('Backup and restore');
    expect(wrapper.text()).toContain('Export backup');
    expect(wrapper.text()).toContain('Administrator security settings');
    expect(wrapper.text()).toContain('Change admin password');
    expectNoChineseOrKeys(wrapper.text());
  });
});
