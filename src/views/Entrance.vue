<template>
  <div class="entrance-container">
     <!-- If access is allowed (Login), the component renders differently via the component map or state -->
     <!-- Actually, we redirect or render component based on check -->
     <component :is="activeComponent" v-bind="componentProps" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineAsyncComponent, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '../stores/session';
import { storeToRefs } from 'pinia';

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
watch(() => route.path, () => {
    checkPath();
});

// Watch for config loaded
watch(publicConfig, () => {
    checkPath();
});

// Watch for session state changes (loading -> loggedIn/loggedOut)
// so we re-check once publicConfig is actually fetched
watch(() => sessionStore.sessionState, () => {
    checkPath();
});

/**
 * 判断 customLoginPath 是否为有效的自定义路径
 * 空字符串、纯斜杠、'login' 均视为无效（等同于使用默认 /login）
 */
function isValidCustomLoginPath(raw) {
    if (!raw || typeof raw !== 'string') return false;
    const normalized = raw.trim().replace(/^\/+/, '');
    return normalized.length > 0 && normalized !== 'login';
}

function checkPath() {
    // 在 session 还在 loading 时，publicConfig 尚未从 API 加载，不做判断
    if (sessionStore.sessionState === 'loading') {
        activeComponent.value = null;
        return;
    }

    const config = publicConfig.value || {};
    const currentPath = route.path;

    // 判断是否存在有效的自定义登录路径
    const hasCustomPath = isValidCustomLoginPath(config.customLoginPath);
    const configuredPath = hasCustomPath
        ? '/' + config.customLoginPath.trim().replace(/^\/+/, '')
        : '/login';

    if (currentPath === configuredPath) {
        // 匹配到配置的登录路径（自定义或默认 /login）
        activeComponent.value = Login;
        componentProps.value = { login: sessionStore.login };
    } else if (currentPath === '/login' && !hasCustomPath) {
        // 没有自定义路径时，/login 也是有效的登录入口
        activeComponent.value = Login;
        componentProps.value = { login: sessionStore.login };
    } else {
        // 不匹配任何登录路径 → 显示 404
        activeComponent.value = NotFound;
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
