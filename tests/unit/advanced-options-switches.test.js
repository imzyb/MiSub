import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AdvancedOptions from '../../src/components/modals/SubscriptionEditModal/AdvancedOptions.vue';

describe('AdvancedOptions', () => {
  it('renders subscription toggles with concise labels and Switch controls', () => {
    const wrapper = mount(AdvancedOptions, {
      props: {
        editingSubscription: {
          customUserAgent: '',
          notes: '',
          enableNodeCache: false,
          plusAsSpace: false
        }
      }
    });

    expect(wrapper.text()).toContain('保护性缓存节点');
    expect(wrapper.text()).toContain('+ 号转空格');
    expect(wrapper.text()).toContain('拉取失败或空节点时使用上次缓存，避免节点清零');
    expect(wrapper.text()).toContain('将节点名中的 + 号显示为空格');
    expect(wrapper.findAllComponents({ name: 'Switch' }).length).toBe(2);
  });
});
