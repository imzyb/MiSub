import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CronCard from '../../src/components/settings/sections/ServiceSettings/CronCard.vue';
import { setLocale } from '../../src/i18n/index.js';

const readySettings = {
    cronSecret: 'test-secret',
    enableNodePersistence: true,
    capabilities: { hasD1: true, available: true, storageType: 'd1' },
};

describe('CronCard copy button', () => {
    beforeEach(() => {
        // happy-dom 的 navigator.languages 是 en-US，这里固定到中文以便断言文案
        setLocale('zh-CN');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });

    it('copies the cron URL and shows visible feedback', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        const wrapper = mount(CronCard, {
            props: { settings: readySettings },
            global: { plugins: [createPinia()] },
        });

        const copyButton = wrapper.findAll('button').find((btn) => btn.text().includes('复制'));
        expect(copyButton).toBeTruthy();
        expect(copyButton.text()).toBe('复制');

        await copyButton.trigger('click');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText.mock.calls[0][0]).toContain('/cron?secret=test-secret');
        expect(copyButton.text()).toContain('已复制');
    });

    it('explains that a secret is required instead of rendering a dead copy button', () => {
        const wrapper = mount(CronCard, {
            props: { settings: { ...readySettings, cronSecret: '' } },
            global: { plugins: [createPinia()] },
        });

        expect(wrapper.find('button[aria-label="复制"]').exists()).toBe(false);
        expect(wrapper.text()).toContain('填写 Cron Secret');
    });
});
