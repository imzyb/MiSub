import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createI18n } from '../../src/i18n/index.js';
import BrandLogo from '../../src/components/layout/BrandLogo.vue';
import Login from '../../src/components/modals/Login.vue';

/**
 * 品牌图标必须走打包资源（/assets/...），不能再指向 public 下的 /logo.png：
 * 伪装开启时服务端会对未鉴权的 /logo.png 返回伪装 404（有意的指纹防护），
 * 于是登录页 / 公开页永远拿不到图标，控制台还持续刷 404。
 */
function mountWithPlugins(Component, options = {}) {
    return mount(Component, {
        global: {
            plugins: [createPinia(), createI18n({ initialLocale: 'zh-CN' })],
            stubs: {
                RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
                Button: { template: '<button><slot /></button>' },
            },
            ...(options.global || {}),
        },
        ...options,
    });
}

describe('品牌图标使用打包资源', () => {
    it('BrandLogo 不再直接引用受伪装守卫的 /logo.png', () => {
        const wrapper = mountWithPlugins(BrandLogo);
        const img = wrapper.get('img');
        expect(img.attributes('src')).not.toBe('/logo.png');
        expect(img.attributes('src')).toMatch(/logo/i);
        wrapper.unmount();
    });

    it('登录页图标同样不直接引用 /logo.png', () => {
        const wrapper = mountWithPlugins(Login, { props: { login: async () => true } });
        const img = wrapper.get('img');
        expect(img.attributes('src')).not.toBe('/logo.png');
        expect(img.attributes('src')).toMatch(/logo/i);
        wrapper.unmount();
    });
});
