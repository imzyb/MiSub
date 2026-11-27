import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RouteProgress from '../../src/components/ui/RouteProgress.vue';
import { setLocale } from '../../src/i18n/index.js';

const BAR = 'div.bg-gradient-to-r';

const mountProgress = (props = {}) =>
    mount(RouteProgress, {
        props: { active: false, ...props },
        global: { plugins: [createPinia()] },
    });

const width = (wrapper) => wrapper.find(BAR).attributes('style') || '';

describe('RouteProgress', () => {
    beforeEach(() => {
        setLocale('zh-CN');
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('导航一开始就画出进度条，不用等 chunk 下载完', async () => {
        const wrapper = mountProgress();
        expect(width(wrapper)).toContain('width: 0%');

        await wrapper.setProps({ active: true });

        expect(width(wrapper)).toContain('width: 10%');
        expect(width(wrapper)).toContain('opacity: 1');
    });

    it('超过阈值仍未完成时补一个「正在加载」提示', async () => {
        const wrapper = mountProgress({ active: true, threshold: 400 });
        expect(wrapper.find('[data-route-loading]').exists()).toBe(false);

        await vi.advanceTimersByTimeAsync(450);

        const hint = wrapper.find('[data-route-loading]');
        expect(hint.exists()).toBe(true);
        expect(hint.text()).toContain('正在加载');
    });

    it('导航结束后进度条走满、随后复位隐藏', async () => {
        const wrapper = mountProgress({ active: true, threshold: 400 });
        await vi.advanceTimersByTimeAsync(450);
        expect(wrapper.find('[data-route-loading]').exists()).toBe(true);

        await wrapper.setProps({ active: false });
        expect(width(wrapper)).toContain('width: 100%');

        await vi.advanceTimersByTimeAsync(300);
        expect(width(wrapper)).toContain('width: 0%');
        expect(wrapper.find('[data-route-loading]').exists()).toBe(false);
    });
});
