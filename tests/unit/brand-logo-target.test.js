/**
 * 回归测试：品牌 LOGO 的跳转目标。
 *
 * 已登录时若 LOGO 仍指向 "/"，点击后会先挂载 HomeView 再由 watchEffect
 * replace 到 /dashboard，导致仪表盘组件树被卸载后重新挂载（自动更新定时器重启、
 * 数据重复校验、界面闪烁），并且多绕一跳无意义的路由。
 * 期望：已登录时 LOGO 直接指向 /dashboard；未登录时保持 "/"。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import BrandLogo from '../../src/components/layout/BrandLogo.vue';
import Header from '../../src/components/layout/Header.vue';
import NavBar from '../../src/components/layout/NavBar.vue';

function makeRouter() {
    return createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { render: () => null } },
            { path: '/dashboard', component: { render: () => null } },
            { path: '/dashboard/nodes', component: { render: () => null } },
            { path: '/explore', component: { render: () => null } },
            { path: '/login', component: { render: () => null } },
        ],
    });
}

async function mountWithPlugins(component, options = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = makeRouter();
    await router.push('/dashboard/nodes');
    await router.isReady();
    const wrapper = mount(component, {
        global: {
            plugins: [pinia, router],
            stubs: { NavActionGroup: true },
            ...(options.global || {}),
        },
        ...options,
    });
    return wrapper;
}

describe('品牌 LOGO 跳转目标', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('BrandLogo 默认指向首页 /', async () => {
        const wrapper = await mountWithPlugins(BrandLogo);
        expect(wrapper.find('.nav-brand-wrap').attributes('href')).toBe('/');
        wrapper.unmount();
    });

    it('BrandLogo 支持自定义跳转目标', async () => {
        const wrapper = await mountWithPlugins(BrandLogo, { props: { to: '/dashboard' } });
        expect(wrapper.find('.nav-brand-wrap').attributes('href')).toBe('/dashboard');
        wrapper.unmount();
    });

    it('NavBar（仅登录后可见）中 LOGO 指向 /dashboard', async () => {
        const wrapper = await mountWithPlugins(NavBar, { props: { isLoggedIn: true } });
        const logo = wrapper.find('.nav-brand-wrap');
        expect(logo.exists()).toBe(true);
        expect(logo.attributes('href')).toBe('/dashboard');
        wrapper.unmount();
    });

    it('Header 已登录时 LOGO 指向 /dashboard', async () => {
        const wrapper = await mountWithPlugins(Header, { props: { isLoggedIn: true } });
        expect(wrapper.find('.nav-brand-wrap').attributes('href')).toBe('/dashboard');
        wrapper.unmount();
    });

    it('Header 未登录时 LOGO 指向 /', async () => {
        const wrapper = await mountWithPlugins(Header, { props: { isLoggedIn: false } });
        expect(wrapper.find('.nav-brand-wrap').attributes('href')).toBe('/');
        wrapper.unmount();
    });
});
