import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import OperatorChain from '../../src/components/features/Operators/OperatorChain.vue';
import { createI18n } from '../../src/i18n/index.js';

const englishGlobal = () => ({
  plugins: [createI18n({ initialLocale: 'en-US' })],
  stubs: {
    draggable: {
      props: ['modelValue'],
      template: '<div><div v-for="element in modelValue" :key="element.id"><slot name="item" :element="element" /></div></div>'
    }
  }
});

const expectNoChineseOrKeys = (text) => {
  expect(text).not.toMatch(/[\u4e00-\u9fff]/);
  expect(text).not.toMatch(/\b(operators|common|actions)\./);
};

const operatorList = [
  {
    id: 'filter-1',
    type: 'filter',
    enabled: true,
    params: {
      protocols: { enabled: false, values: [] },
      regions: { enabled: false, values: [] },
      include: { enabled: false, rules: [] },
      exclude: { enabled: false, rules: [] }
    }
  },
  {
    id: 'rename-1',
    type: 'rename',
    enabled: true,
    params: {
      regex: { enabled: true, rules: [] },
      template: { enabled: false, template: '', offset: 1 }
    }
  },
  {
    id: 'sort-1',
    type: 'sort',
    enabled: true,
    params: { keys: [{ key: 'group', order: 'asc', customOrder: [] }] }
  },
  {
    id: 'dedup-1',
    type: 'dedup',
    enabled: true,
    params: { mode: 'serverPort', includeProtocol: true, prefer: { protocolOrder: [] } }
  },
  {
    id: 'script-1',
    type: 'script',
    enabled: true,
    params: { url: '', code: '' }
  }
];

describe('operator chain English translations', () => {
  it('renders empty state and add buttons in English', () => {
    const wrapper = mount(OperatorChain, {
      props: { modelValue: [] },
      global: englishGlobal()
    });

    expect(wrapper.text()).toContain('Start chained processing');
    expect(wrapper.text()).toContain('Filter nodes');
    expect(wrapper.text()).toContain('Regex rename');
    expect(wrapper.text()).toContain('Script execution');
    expect(wrapper.text()).toContain('Node sorting');
    expect(wrapper.text()).toContain('Smart deduplication');
    expectNoChineseOrKeys(wrapper.text());
  });

  it('renders expanded operator editors in English', async () => {
    const wrapper = mount(OperatorChain, {
      props: { modelValue: operatorList },
      global: englishGlobal()
    });

    expect(wrapper.text()).toContain('Include protocol in deduplication');
    expect(wrapper.text()).toContain('Preferred protocols to keep');
    expectNoChineseOrKeys(wrapper.text());

    const headers = wrapper.findAll('.cursor-pointer');

    await headers[0].trigger('click');
    expect(wrapper.text()).toContain('Protocol limit');
    expect(wrapper.text()).toContain('Region limit');
    expect(wrapper.text()).toContain('Include nodes (regex)');
    expect(wrapper.text()).toContain('Exclude nodes (regex)');
    expect(wrapper.text()).toContain('Off');
    expectNoChineseOrKeys(wrapper.text());

    await headers[1].trigger('click');
    expect(wrapper.text()).toContain('Regex replacement');
    expect(wrapper.text()).toContain('Common regex');
    expect(wrapper.text()).toContain('No regex rules yet');
    expectNoChineseOrKeys(wrapper.text());

    await headers[2].trigger('click');
    expect(wrapper.text()).toContain('Sort weights');
    expect(wrapper.text()).toContain('Add condition');
    expect(wrapper.text()).toContain('Custom group');
    expectNoChineseOrKeys(wrapper.text());

    await headers[4].trigger('click');
    expect(wrapper.text()).toContain('Remote script URL');
    expect(wrapper.find('input[placeholder="GitGist/raw link"]').exists()).toBe(true);
    expectNoChineseOrKeys(wrapper.text());
  });
});
