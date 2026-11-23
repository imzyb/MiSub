/**
 * 回归测试：旧版节点净化配置迁移到操作符链后必须真的生效。
 *
 * 历史问题：迁移时把旧「脚本改名」写成 params.code，而脚本操作符只执行
 * 受限 DSL（params.dsl），迁移产物等于静默失效；旧「脚本过滤」「精简模式」
 * 也没有等价操作符，却是无声丢弃。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import OperatorChain from '../../src/components/features/Operators/OperatorChain.vue';
import { useToastStore } from '../../src/stores/toast.js';
import { setLocale } from '../../src/i18n/index.js';

beforeEach(() => {
    setLocale('zh-CN');
});

function legacyConfig(overrides = {}) {
    return {
        enabled: true,
        filter: {
            include: { enabled: false, rules: [] },
            exclude: { enabled: false, rules: [] },
            protocols: { enabled: false, values: [] },
            regions: { enabled: false, values: [] },
            script: { enabled: false, expression: '' },
            useless: { enabled: false },
        },
        rename: {
            regex: { enabled: false, rules: [] },
            template: { enabled: false, template: '' },
            script: { enabled: false, expression: '' },
        },
        dedup: {
            enabled: false,
            mode: 'serverPort',
            includeProtocol: true,
            prefer: { protocolOrder: [] },
        },
        sort: { enabled: false, keys: [] },
        ...overrides,
    };
}

function mountChain(legacyData) {
    const pinia = createPinia();
    setActivePinia(pinia);
    return mount(OperatorChain, {
        props: { modelValue: [], legacyData },
        global: { plugins: [pinia] },
    });
}

async function migrate(wrapper) {
    const button = wrapper.findAll('button').find((item) => item.text().includes('立即迁移'));
    expect(button).toBeTruthy();
    await button.trigger('click');
    const emitted = wrapper.emitted('update:modelValue') || [];
    return emitted.length > 0 ? emitted[emitted.length - 1][0] : [];
}

describe('operator chain legacy migration', () => {
    it('旧脚本改名迁移为受限 DSL，而不是已停用的 code', async () => {
        const wrapper = mountChain(
            legacyConfig({
                rename: {
                    regex: { enabled: false, rules: [] },
                    template: { enabled: false, template: '' },
                    script: { enabled: true, expression: '{emoji}{region}-{index}' },
                },
            })
        );
        const ops = await migrate(wrapper);
        const scriptOp = ops.find((op) => op.type === 'script');
        expect(scriptOp).toBeTruthy();
        expect(scriptOp.params.dsl).toEqual([
            { action: 'rename', template: '{emoji}{region}-{index}' },
        ]);
        expect(scriptOp.params.code).toBeUndefined();
    });

    it('无等价操作符的旧能力迁移时给出提示，而不是静默丢弃', async () => {
        const wrapper = mountChain(
            legacyConfig({
                filter: {
                    include: { enabled: true, rules: ['hk'] },
                    exclude: { enabled: false, rules: [] },
                    protocols: { enabled: false, values: [] },
                    regions: { enabled: false, values: [] },
                    script: { enabled: true, expression: 'name => name' },
                    useless: { enabled: true },
                },
            })
        );
        await migrate(wrapper);
        const toasts = useToastStore().toasts;
        const warning = toasts.map((item) => item.message).join(' ');
        expect(warning).toContain('脚本过滤');
        expect(warning).toContain('精简模式');
    });

    it('新增脚本操作符默认使用空 DSL 而不是 code', async () => {
        const wrapper = mountChain(null);
        const addButton = wrapper
            .findAll('button')
            .find((item) => item.text().includes('脚本执行'));
        expect(addButton).toBeTruthy();
        await addButton.trigger('click');
        const emitted = wrapper.emitted('update:modelValue') || [];
        const ops = emitted[emitted.length - 1][0];
        const scriptOp = ops.find((op) => op.type === 'script');
        expect(scriptOp.params).toEqual({ dsl: [] });
    });
});
