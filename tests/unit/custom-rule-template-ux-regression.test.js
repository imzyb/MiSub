import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TransformSelector from '../../src/components/forms/TransformSelector.vue';
import RuleTemplateManager from '../../src/components/settings/sections/ServiceSettings/RuleTemplateManager.vue';
import { useDataStore } from '../../src/stores/useDataStore.js';

vi.mock('../../src/services/api.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

vi.mock('../../src/stores/settings.js', () => ({
  useSettingsStore: () => ({
    config: {},
    setConfig: vi.fn()
  })
}));

vi.mock('../../src/stores/editor.js', () => ({
  useEditorStore: () => ({
    setLoading: vi.fn()
  })
}));

vi.mock('../../src/composables/useToast.js', () => ({
  useToast: () => ({
    showToast: vi.fn()
  })
}));

function mountWithStore(component, options = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const dataStore = useDataStore();
  dataStore.ruleTemplates = options.ruleTemplates || [];
  return mount(component, {
    ...options,
    global: {
      plugins: [pinia],
      ...(options.global || {})
    }
  });
}

describe('Custom rule template UX regressions', () => {
  it('hides local custom templates when third-party backend only accepts remote config URLs', () => {
    const wrapper = mountWithStore(TransformSelector, {
      props: {
        modelValue: '',
        type: 'config',
        excludeBuiltinAssets: true
      },
      ruleTemplates: [{ id: 'local-a', name: '本地模板 A', enabled: true, content: '[custom]\n' }]
    });

    const optionValues = wrapper.findAll('option').map(option => option.attributes('value'));
    expect(optionValues).not.toContain('custom:local-a');
    expect(wrapper.text()).toContain('第三方订阅转换仅支持远程模板 URL');
  });

  it('restricts custom_template mode to saved custom: templates instead of remote URL input', () => {
    const wrapper = mountWithStore(TransformSelector, {
      props: {
        modelValue: '',
        type: 'config',
        customTemplatesOnly: true,
        allowEmpty: false
      },
      ruleTemplates: [{ id: 'local-a', name: '本地模板 A', enabled: true, content: '[custom]\n' }]
    });

    const optionValues = wrapper.findAll('option').map(option => option.attributes('value'));
    expect(optionValues).toContain('custom:local-a');
    expect(optionValues).not.toContain('custom');
    expect(optionValues.some(value => String(value || '').startsWith('http'))).toBe(false);
    expect(wrapper.text()).toContain('仅可选择已保存的 custom: 自定义规则模板');
  });

  it('keeps template variable helper collapsed by default and expands on demand', async () => {
    const wrapper = mountWithStore(TransformSelector, {
      props: {
        modelValue: '',
        type: 'config'
      }
    });

    expect(wrapper.text()).toContain('模板变量说明');
    expect(wrapper.text()).toContain('适用于统一模板渲染。');
    expect(wrapper.text()).not.toContain('<%file_name%>');
    expect(wrapper.find('button[aria-expanded="false"]').exists()).toBe(true);

    await wrapper.find('button[aria-expanded="false"]').trigger('click');

    const helper = wrapper.text();
    expect(wrapper.find('button[aria-expanded="true"]').exists()).toBe(true);
    expect(helper).toContain('<%file_name%>');
    expect(helper).toContain('<%fileName%>');
    expect(helper).toContain('<%target_format%>');
    expect(helper).toContain('<%targetFormat%>');
    expect(helper).toContain('<%node_count%>');
    expect(helper).toContain('<%primary_strategy_chain%>');
    expect(helper).toContain('<%primaryStrategyChain%>');
    expect(helper).toContain('<%region_strategy_chain%>');
    expect(helper).toContain('<%regionStrategyChain%>');
    expect(helper).toContain('<%protocol_strategy_chain%>');
    expect(helper).toContain('<%protocolStrategyChain%>');
    expect(helper).toContain('<%all_strategy_groups%>');
    expect(helper).toContain('<%allStrategyGroups%>');
    expect(helper).toContain('<%region_group_names%>');
    expect(helper).toContain('<%regionGroupNames%>');
    expect(helper).toContain('<%region_group_counts%>');
    expect(helper).toContain('<%regionGroupCounts%>');
    expect(helper).toContain('<%region_group_list%>');
    expect(helper).toContain('<%regionGroupList%>');
    expect(helper).toContain('<%protocol_group_names%>');
    expect(helper).toContain('<%protocolGroupNames%>');
    expect(helper).toContain('<%protocol_group_counts%>');
    expect(helper).toContain('<%protocolGroupCounts%>');
    expect(helper).toContain('<%protocol_group_list%>');
    expect(helper).toContain('<%protocolGroupList%>');
  });

  it('warns when a selected custom: template no longer exists or is disabled', () => {
    const wrapper = mountWithStore(TransformSelector, {
      props: {
        modelValue: 'custom:missing-template',
        type: 'config',
        customTemplatesOnly: true,
        allowEmpty: false
      },
      ruleTemplates: [{ id: 'other-template', name: '其他模板', enabled: true, content: '[custom]\n' }]
    });

    expect(wrapper.text()).toContain('当前引用的自定义规则模板不存在或已停用');
    expect(wrapper.text()).toContain('custom:missing-template');
  });

  it('prefills new custom rule templates with a complete editable standard template', async () => {
    const wrapper = mountWithStore(RuleTemplateManager, {
      ruleTemplates: []
    });

    await wrapper.findAll('button').find(button => ['New template', '新建模板'].includes(button.text())).trigger('click');
    const textareaValue = wrapper.find('textarea').element.value;

    expect(textareaValue).toContain('[custom]');
    expect(textareaValue).toContain('ruleset=🎯 全球直连,[]GEOIP,CN');
    expect(textareaValue).toContain('custom_proxy_group=🚀 节点选择`select`');
    expect(textareaValue).toContain('enable_rule_generator=true');
    expect(textareaValue).toContain('overwrite_original_rules=true');
  });
});
