import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SortEditor from '../../src/components/features/Operators/components/SortEditor.vue';
import { createI18n } from '../../src/i18n/index.js';

const mountSortEditor = (
    modelValue = { keys: [] },
    locale = 'zh-CN',
    { controlled = false } = {}
) => {
    const props = { modelValue };
    const wrapper = mount(SortEditor, {
        props: controlled
            ? {
                  ...props,
                  'onUpdate:modelValue': (val) => wrapper.setProps({ modelValue: val }),
              }
            : props,
        global: {
            plugins: [createI18n({ initialLocale: locale })],
            stubs: {
                draggable: {
                    props: ['modelValue'],
                    template:
                        '<div><div v-for="(element, index) in modelValue" :key="element.id"><slot name="item" :element="element" :index="index" /></div></div>',
                },
            },
        },
    });
    return wrapper;
};

const mountControlledSortEditor = (modelValue = { keys: [] }, locale = 'zh-CN') =>
    mountSortEditor(modelValue, locale, { controlled: true });

describe('SortEditor', () => {
    it('renders sort key options in the expected order', () => {
        const wrapper = mountSortEditor({
            keys: [{ key: 'region', order: 'asc', customOrder: ['香港'] }],
        });

        const keySelect = wrapper.findAll('select')[0];
        const options = keySelect.findAll('option').map((option) => ({
            value: option.element.value,
            text: option.text().trim(),
        }));

        expect(options).toEqual([
            { value: 'region', text: '地区' },
            { value: 'protocol', text: '协议' },
            { value: 'name', text: '节点名称' },
            { value: 'regex', text: '正则置顶' },
            { value: 'group', text: '自定义分组' },
            { value: 'server', text: '服务器' },
            { value: 'port', text: '端口' },
        ]);
    });

    it('defaults newly added sort condition to region with default region priority order', async () => {
        const wrapper = mountSortEditor({ keys: [] });

        const addButton = wrapper.findAll('button').find((btn) => btn.text().includes('添加条件'));
        expect(addButton).toBeTruthy();

        await addButton.trigger('click');

        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        expect(emitted[0][0].keys).toEqual([
            {
                key: 'region',
                order: 'asc',
                customOrder: [
                    '香港',
                    '台湾',
                    '日本',
                    '新加坡',
                    '美国',
                    '韩国',
                    '英国',
                    '德国',
                    '法国',
                    '加拿大',
                ],
            },
        ]);
    });

    it('renders regex pin editor in English without leaking Chinese or keys', async () => {
        const wrapper = mountSortEditor(
            { keys: [{ key: 'regex', order: 'asc', customOrder: [] }] },
            'en-US'
        );

        expect(wrapper.text()).not.toMatch(/[\u4e00-\u9fff]/);
        expect(wrapper.text()).not.toMatch(/\boperators\./);

        const input = wrapper.find('input[type="text"]');
        await input.setValue('dmit');
        await input.trigger('keydown.enter');

        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        expect(emitted[0][0].keys[0].customOrder).toEqual(['dmit']);
    });

    it('ignores Enter during IME composition and validates invalid regex syntax', async () => {
        const wrapper = mountSortEditor({
            keys: [{ key: 'regex', order: 'asc', customOrder: [] }],
        });

        const input = wrapper.find('input[type="text"]');
        await input.setValue('yamaxun');
        await input.trigger('keydown.enter', { isComposing: true });
        expect(wrapper.emitted('update:modelValue')).toBeFalsy();

        await input.setValue('[HK');
        await input.trigger('keydown.enter', { isComposing: false });
        expect(wrapper.emitted('update:modelValue')).toBeFalsy();
        expect(wrapper.text()).toContain('正则表达式语法有误');

        await input.setValue('亚马逊');
        expect(wrapper.text()).not.toContain('正则表达式语法有误');

        await input.trigger('keydown.enter', { isComposing: false });
        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        expect(emitted[0][0].keys[0].customOrder).toEqual(['亚马逊']);
    });

    it('keeps unsubmitted regex drafts aligned when reordering sort conditions', async () => {
        const wrapper = mountControlledSortEditor({
            keys: [
                { key: 'region', order: 'asc', customOrder: ['香港'] },
                { key: 'regex', order: 'asc', customOrder: [] },
            ],
        });

        const inputBefore = wrapper.find('input[type="text"]');
        await inputBefore.setValue('dmit');

        const moveUpButtons = wrapper.findAll('button[aria-label="上移"]');
        await moveUpButtons[1].trigger('click');

        const inputAfter = wrapper.find('input[type="text"]');
        expect(inputAfter.element.value).toBe('dmit');
    });

    it('hides sort direction select for regex pin conditions and normalizes order on switch', async () => {
        const wrapper = mountControlledSortEditor({
            keys: [
                { key: 'region', order: 'asc', customOrder: ['香港'] },
                { key: 'name', order: 'desc', customOrder: [] },
            ],
        });

        // 未切换前两行各自都有 key + order 两个 select，共 4 个
        expect(wrapper.findAll('select')).toHaveLength(4);

        const secondKeySelect = wrapper.findAll('select')[2];
        await secondKeySelect.setValue('regex');

        // 第二行切为 regex 后隐藏升降序选择框，只剩 3 个 select
        expect(wrapper.findAll('select')).toHaveLength(3);
        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted.at(-1)[0].keys[1]).toEqual({
            key: 'regex',
            order: 'asc',
            customOrder: [],
        });
    });

    it('stashes and restores customOrder across key switches, reordering, and deletion', async () => {
        const wrapper = mountControlledSortEditor({
            keys: [
                { key: 'region', order: 'asc', customOrder: ['日本', '香港'] },
                { key: 'regex', order: 'asc', customOrder: ['亚马逊', 'dmit'] },
            ],
        });

        // 行 1 从 regex 切走并切经过 protocol -> name，再切回 regex 应恢复原规则
        let row1KeySelect = wrapper.findAll('select')[2];
        await row1KeySelect.setValue('protocol');
        expect(wrapper.props('modelValue').keys[1].customOrder).toEqual([
            'vless',
            'trojan',
            'vmess',
            'hysteria2',
            'ss',
            'ssr',
            'anytls',
        ]);

        row1KeySelect = wrapper.findAll('select')[2];
        await row1KeySelect.setValue('name');
        expect(wrapper.props('modelValue').keys[1].customOrder).toEqual([]);

        // 上移到第 0 行后再切回 regex，仍应恢复暂存的正则规则
        const moveUpButtons = wrapper.findAll('button[aria-label="上移"]');
        await moveUpButtons[1].trigger('click');

        let row0KeySelect = wrapper.findAll('select')[0];
        await row0KeySelect.setValue('regex');
        expect(wrapper.props('modelValue').keys[0].customOrder).toEqual(['亚马逊', 'dmit']);

        // 第 0 行切走，第 1 行(region 自定义顺序)切为 regex，再删除第 0 行，验证下标移位后仍能恢复
        row0KeySelect = wrapper.findAll('select')[0];
        await row0KeySelect.setValue('name');

        const row1RegionSelect = wrapper.findAll('select')[2];
        await row1RegionSelect.setValue('regex');

        const removeButtons = wrapper.findAll('button[aria-label="删除排序字段"]');
        await removeButtons[0].trigger('click');

        const remainingKeySelect = wrapper.findAll('select')[0];
        await remainingKeySelect.setValue('region');
        expect(wrapper.props('modelValue').keys[0].customOrder).toEqual(['日本', '香港']);
    });
});
