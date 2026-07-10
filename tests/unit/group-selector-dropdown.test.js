import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import GroupSelector from '../../src/components/ui/GroupSelector.vue';

describe('GroupSelector', () => {
  it('点击下拉箭头时展示全部已有分组，而不是只展示当前分组', async () => {
    const wrapper = mount(GroupSelector, {
      props: {
        modelValue: 'FreezeHost',
        groups: ['FreezeHost', 'S5'],
        placeholder: '选择或输入新分组...'
      },
      attachTo: document.body,
      global: { stubs: { Teleport: false } }
    });

    await wrapper.find('[data-testid="group-selector-toggle"]').trigger('click');
    await nextTick();
    await nextTick();

    expect(document.body.textContent).toContain('FreezeHost');
    expect(document.body.textContent).toContain('S5');

    wrapper.unmount();
  });

  it('已有分组只存在首尾空白差异时不显示创建新分组', async () => {
    const wrapper = mount(GroupSelector, {
      props: {
        modelValue: ' S5 ',
        groups: ['S5'],
        placeholder: '选择或输入新分组...'
      },
      attachTo: document.body,
      global: { stubs: { Teleport: false } }
    });

    await wrapper.find('[data-testid="group-selector-toggle"]').trigger('click');
    await nextTick();
    await nextTick();

    expect(document.body.textContent).toContain('S5');
    expect(document.body.textContent).not.toContain('创建新分组');

    wrapper.unmount();
  });
});
