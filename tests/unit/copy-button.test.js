import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CopyButton from '../../src/components/ui/CopyButton.vue';
import { setLocale } from '../../src/i18n/index.js';

describe('CopyButton', () => {
    beforeEach(() => {
        setLocale('zh-CN');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });

    const mountButton = (props = {}) =>
        mount(CopyButton, {
            props: { value: 'https://example.com/a', ...props },
            global: { plugins: [createPinia()] },
        });

    it('把「复制」切成「已复制」，并抛出 copied 事件', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        const wrapper = mountButton();
        expect(wrapper.text()).toBe('复制');

        await wrapper.trigger('click');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(writeText).toHaveBeenCalledWith('https://example.com/a');
        expect(wrapper.text()).toContain('已复制');
        expect(wrapper.emitted('copied')).toHaveLength(1);
    });

    it('没有内容时禁用，不渲染成点了没反应的按钮', () => {
        const wrapper = mountButton({ value: '' });
        expect(wrapper.attributes('disabled')).toBeDefined();
    });

    it('剪贴板 API 不可用时回退到 execCommand', async () => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        document.execCommand = vi.fn().mockReturnValue(true);

        const wrapper = mountButton();
        await wrapper.trigger('click');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(wrapper.text()).toContain('已复制');
    });

    it('图标模式只留图标，并用 title 暴露无障碍名称', () => {
        const wrapper = mountButton({ variant: 'icon', title: '复制链接' });
        expect(wrapper.attributes('aria-label')).toBe('复制链接');
        expect(wrapper.text()).toBe('');
    });
});
