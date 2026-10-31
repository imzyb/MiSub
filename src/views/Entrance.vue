<template>
    <div class="entrance-container">
        <!-- If access is allowed (Login), the component renders differently via the component map or state -->
        <!-- Actually, we redirect or render component based on check -->
        <component :is="activeComponent" v-bind="componentProps" />
    </div>
</template>

<script setup>
    import { ref, computed, onMounted, defineAsyncComponent, watch, markRaw } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { useSessionStore } from '../stores/session';
    import { storeToRefs } from 'pinia';
    import { isValidCustomLoginPath } from '../utils/login-path.js';
    import { readSessionPreference, writeSessionPreference } from '../utils/session-preference.js';

    // Lazy load components
    const Login = defineAsyncComponent(() => import('../components/modals/Login.vue'));
    const NotFound = defineAsyncComponent(() => import('./NotFound.vue'));

    const route = useRoute();
    const router = useRouter();
    const sessionStore = useSessionStore();
    const { publicConfig, initialData } = storeToRefs(sessionStore); // Ensure publicConfig contains settings or we need to access settings differently

    const activeComponent = ref(null);
    const componentProps = ref({});

    onMounted(async () => {
        checkPath();
    });

    // Watch for path changes if component is reused
    watch(
        () => route.path,
        () => {
            checkPath();
        }
    );

    // Watch for config loaded
    watch(publicConfig, () => {
        checkPath();
    });

    // Watch for session state changes (loading -> loggedIn/loggedOut)
    // so we re-check once publicConfig is actually fetched
    watch(
        () => sessionStore.sessionState,
        () => {
            checkPath();
        }
    );

    function checkPath() {
        // 在 session 还在 loading 时，publicConfig 尚未从 API 加载，不做判断
        if (sessionStore.sessionState === 'loading') {
            activeComponent.value = null;
            return;
        }

        const config = publicConfig.value || {};
        const currentPath = route.path;

        // customLoginPath 不再由公开 API 返回；后端只在当前 Referer 是实际登录路径时
        // 返回 isLoginPath=true。未知路径不会被误当成登录页。
        let rememberedPath = readSessionPreference('misub:login-path') || '';
        const inferredPath = config.isLoginPath ? rememberedPath || currentPath : rememberedPath;
        const hasCustomPath =
            isValidCustomLoginPath(config.customLoginPath) || Boolean(inferredPath);
        const configuredPath = isValidCustomLoginPath(config.customLoginPath)
            ? '/' + config.customLoginPath.trim().replace(/^\/+/, '')
            : inferredPath || '/login';

        if (config.isLoginPath && inferredPath) {
            // 写失败不影响可用性：当前路由本身仍然有效，下次从路由推断即可。
            writeSessionPreference('misub:login-path', inferredPath);
        }

        if (currentPath === configuredPath) {
            // 匹配到配置的登录路径（自定义或默认 /login）
            activeComponent.value = markRaw(Login);
            componentProps.value = { login: sessionStore.login };
        } else if (currentPath === '/login' && !hasCustomPath) {
            // 没有自定义路径时，/login 也是有效的登录入口
            activeComponent.value = markRaw(Login);
            componentProps.value = { login: sessionStore.login };
        } else {
            // 不匹配任何登录路径 → 显示 404
            activeComponent.value = markRaw(NotFound);
        }
    }
</script>

<style scoped>
    .entrance-container {
        width: 100%;
        min-height: 80vh;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
