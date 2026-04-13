import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import BasicSettings from '../../src/components/settings/sections/BasicSettings.vue';

const showToast = vi.fn();

vi.mock('../../src/stores/toast', () => ({
  useToastStore: () => ({ showToast })
}));

describe('BasicSettings validation feedback', () => {
  beforeEach(() => {
    showToast.mockReset();
  });

  it('keeps reserved tokens in the field and shows inline error state', async () => {
    const wrapper = mount(BasicSettings, {
      props: {
        settings: {
          FileName: '',
          mytoken: 'settings',
          profileToken: 'profile-token',
          customLoginPath: 'login',
          enablePublicPage: true
        },
        disguiseConfig: {
          enabled: false,
          pageType: 'default',
          redirectUrl: ''
        }
      },
      global: {
        stubs: {
          Switch: {
            template: '<div />'
          }
        }
      }
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.props().settings.mytoken).toBe('settings');
    expect(wrapper.text()).toContain('系统保留路径不可用作自定义订阅 Token');
    expect(wrapper.props().settings.customLoginPath).toBe('login');
    expect(wrapper.text()).toContain('"/login" 是系统保留路径，不可用作自定义管理后台路径');
  });
});
