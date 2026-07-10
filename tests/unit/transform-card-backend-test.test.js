import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import TransformCard from '../../src/components/settings/sections/ServiceSettings/TransformCard.vue';

vi.mock('../../src/lib/api.js', () => ({
  testSubconverterBackend: vi.fn()
}));

const { testSubconverterBackend } = await import('../../src/lib/api.js');

function createSettings(overrides = {}) {
  return {
    transformConfigMode: 'preset',
    transformConfig: '',
    builtinSkipCertVerify: false,
    builtinEnableUdp: false,
    ruleLevel: 'std',
    subconverter: {
      engineMode: 'external',
      defaultBackend: 'api.v1.mk',
      defaultOptions: {
        udp: true,
        emoji: true,
        scv: true,
        tfo: false,
        sort: false,
        list: false
      },
      ...(overrides.subconverter || {})
    },
    ...overrides
  };
}

describe('TransformCard third-party backend test button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a safe backend test action and displays success feedback', async () => {
    testSubconverterBackend.mockResolvedValue({
      success: true,
      available: true,
      message: '第三方转换后端可用，响应 200，耗时 123ms。',
      endpoint: 'https://api.v1.mk/sub',
      elapsedMs: 123
    });

    const wrapper = mount(TransformCard, {
      props: { settings: createSettings() },
      global: {
        stubs: {
          TransformSelector: true,
          RuleTemplateManager: true
        }
      }
    });

    expect(wrapper.text()).toContain('Test backend availability');
    expect(wrapper.text()).toContain('Your real subscription links are not sent');

    await wrapper.get('[data-testid="test-subconverter-backend"]').trigger('click');
    await nextTick();
    await nextTick();

    expect(testSubconverterBackend).toHaveBeenCalledWith('api.v1.mk', 'clash');
    expect(wrapper.get('[data-testid="subconverter-backend-test-result"]').text()).toContain('第三方转换后端可用');
    expect(wrapper.get('[data-testid="subconverter-backend-test-result"]').text()).toContain('https://api.v1.mk/sub');
  });

  it('clears old backend test result after backend changes', async () => {
    const settings = createSettings();
    testSubconverterBackend.mockResolvedValue({
      success: false,
      available: false,
      error: '测试失败'
    });

    const wrapper = mount(TransformCard, {
      props: { settings },
      global: {
        stubs: {
          TransformSelector: true,
          RuleTemplateManager: true
        }
      }
    });

    await wrapper.get('[data-testid="test-subconverter-backend"]').trigger('click');
    await nextTick();
    await nextTick();
    expect(wrapper.find('[data-testid="subconverter-backend-test-result"]').exists()).toBe(true);

    const backendInput = wrapper.get('input[type="text"]');
    await backendInput.setValue('subapi.cmliussss.net');
    await nextTick();

    expect(wrapper.find('[data-testid="subconverter-backend-test-result"]').exists()).toBe(false);
  });
});
