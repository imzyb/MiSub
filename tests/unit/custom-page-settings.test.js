import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import CustomPageSettings from '../../src/components/settings/sections/CustomPageSettings.vue';
import { createI18n } from '../../src/i18n/index.js';

vi.mock('../../src/components/ui/Switch.vue', () => ({
    default: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template:
            '<button class="switch-stub" type="button" @click="$emit(\'update:modelValue\', !modelValue)">{{ String(modelValue) }}</button>',
    },
}));

const buildSettings = (settings = {}) => ({
    ...settings,
    customPage: {
        enabled: true,
        type: 'html',
        content: '',
        css: '',
        useDefaultLayout: true,
        allowExternalStylesheets: true,
        allowScripts: true,
        hideBranding: false,
        hideHeader: false,
        hideFooter: false,
        ...settings.customPage,
    },
});

const mountSettings = (settings = {}) =>
    mount(CustomPageSettings, {
        props: {
            settings: buildSettings(settings),
        },
        // 断言的是英文文案，必须显式指定语言：组件未传 i18n 时会回落到
        // 全局单例，其 locale 取决于同批次其他测试是否调用过 setLocale('en-US')，
        // 之前因此变成「按文件顺序时好时坏」的偶发失败。
        global: {
            plugins: [createI18n({ initialLocale: 'en-US' })],
        },
    });

describe('CustomPageSettings safety messaging', () => {
    it('shows fixed-disabled security messaging instead of toggles for scripts and external stylesheets', () => {
        const wrapper = mountSettings();
        const text = wrapper.text();

        expect(text).toContain('External stylesheets are safely disabled');
        expect(text).toContain('Script execution is safely disabled');
        expect(text).toContain('Always disabled');
        expect(text).not.toContain('允许外链样式表');
        expect(text).not.toContain('允许脚本执行');
    });

    it('keeps legacy script and external stylesheet flags disabled when applying templates', async () => {
        const originalConfirm = window.confirm;
        window.confirm = vi.fn(() => true);
        const wrapper = mountSettings({
            customPage: {
                allowExternalStylesheets: true,
                allowScripts: true,
            },
        });

        try {
            await wrapper.find('[data-testid="custom-page-template"]').trigger('click');

            expect(wrapper.props('settings').customPage.allowExternalStylesheets).toBe(false);
            expect(wrapper.props('settings').customPage.allowScripts).toBe(false);
        } finally {
            window.confirm = originalConfirm;
        }
    });
});
