<script setup>
    import { defineAsyncComponent, computed, watchEffect, h } from 'vue';
    import { useSessionStore } from '../stores/session';
    import { storeToRefs } from 'pinia';
    import { useRoute, useRouter } from 'vue-router';

    // Lazy load components
    const PublicProfilesView = defineAsyncComponent(() => import('./PublicProfilesView.vue'));
    const NotFoundView = defineAsyncComponent(() => import('./NotFound.vue'));

    // 已登录等待重定向时的占位组件。
    // 必须使用 render 函数而不是运行时模板字符串（{ template: '<div></div>' }）：
    // 项目在懒加载 vuedraggable（UMD 内含 Vue 完整版）后会注册 runtime compiler，
    // 运行时模板将经 new Function("Vue", code) 编译，在启用严格 CSP 的部署上
    // 会被拦截并抛 EvalError: call to Function() blocked by CSP，
    // 最终以「操作失败，请稍后重试」的错误提示弹出。
    // 见 tests/unit/runtime-compiler-csp.test.js
    const RedirectPlaceholder = { render: () => h('div') };

    const sessionStore = useSessionStore();
    const { sessionState, publicConfig } = storeToRefs(sessionStore);
    const route = useRoute();
    const router = useRouter();

    const isExploreRoute = computed(() => route.path === '/explore');

    // 如果用户已登录且访问的是首页 /，自动通过逻辑重定向到仪表盘 /dashboard
    watchEffect(() => {
        if (sessionState.value === 'loggedIn' && !isExploreRoute.value) {
            // 导航被中断/失败时不应冒泡为未处理的 Promise 拒绝（会触发全局错误提示）
            router.replace('/dashboard').catch(() => {});
        }
    });

    const currentView = computed(() => {
        // 1. 明确的 /explore 路由，显示公开页
        if (isExploreRoute.value) {
            if (publicConfig.value && !publicConfig.value.enablePublicPage) {
                return NotFoundView;
            }
            return PublicProfilesView;
        }

        // 2. 根路径 /
        // 已登录：显示空白（等待 watchEffect 执行重定向）
        if (sessionState.value === 'loggedIn') {
            return RedirectPlaceholder;
        }

        // 未登录 + 公开页关闭：显示 404 (Disguise)
        if (
            sessionState.value === 'loggedOut' &&
            publicConfig.value &&
            !publicConfig.value.enablePublicPage
        ) {
            return NotFoundView;
        }

        // 其他情况（未登录 + 公开页开启）：显示公开页
        return PublicProfilesView;
    });
</script>

<template>
    <component :is="currentView" />
</template>
