<template>
  <div class="entrance-container">
     <LoadingSpinner v-if="isLoading" type="spinner" size="md" color="indigo" message="正在加载..." />
     <LoadingSpinner v-else-if="!activeComponent" type="spinner" size="md" color="indigo" message="正在准备页面..." />
     <component v-else :is="activeComponent" v-bind="componentProps" />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSessionStore } from '../stores/session';
import LoadingSpinner from '../components/ui/LoadingSpinner.vue';

// Lazy load components
const Login = defineAsyncComponent(() => import('../components/modals/Login.vue'));
const NotFound = defineAsyncComponent(() => import('./NotFound.vue'));

const route = useRoute();
const router = useRouter();
const sessionStore = useSessionStore();
const { publicConfig, isConfigReady, sessionState } = storeToRefs(sessionStore);

const activeComponent = ref(null);
const componentProps = ref({});
const isLoading = computed(() => !isConfigReady.value || sessionState.value === 'loading' || sessionState.value === 'loggedIn');

watch([() => route.path, publicConfig, isConfigReady], () => {
    if (isConfigReady.value) {
        checkPath();
    }
}, { immediate: true });

watch(sessionState, (state) => {
    if (state === 'loggedIn' && route.path !== '/') {
        router.replace('/');
    }
}, { immediate: true });

async function checkPath() {
    if (sessionState.value === 'loggedIn') {
        activeComponent.value = null;
        componentProps.value = {};
        return;
    }
    // 1. Get Configured Path
    // Settings might be in initialData (if logged in) or publicConfig (if not)
    // Actually, 'customLoginPath' might be considered a 'secret' setting? 
    // No, client needs to know it to match. OR the backend handles the match, validates it and serves the app.
    // BUT the Client Router also needs to know if the current URL is valid.
    
    // Issue: If User is NOT logged in, we only have 'publicConfig'. 
    // Does 'publicConfig' contain 'customLoginPath'? CHECK 'functions/modules/api-router.js' or where public config comes from.
    // Ideally, we shouldn't expose the custom path in public config if we want it to be obscure?
    // BUT the user just typed it in the URL bar. We know what the current URL is.
    // If the server served index.html, it means the server APPROVED this path (or it's in the whitelist).
    
    // Strategy:
    // If the server served index.html for this path, it's either a known route or the custom login path.
    // Since 'customLoginPath' is dynamic, the client side router catch-all caught it.
    // We can try to guess or just ask the backend "Is this the login path?"
    // OR more simply: We assume `customLoginPath` IS exposed in publicConfig.
    // Let's verify if `publicConfig` includes it. 
    
    // If not, we can rely on a dedicated API check or just update `checkSession` to return it.
    // For now, let's look at `publicConfig` in `session.js`.
    
    const config = publicConfig.value || {};
    // Fallback: default login is always valid if no custom path set?
    // Logic: 
    // If matched custom path -> Show Login
    // If matched '/login' AND custom path IS set -> Show 404 (Hidden)
    // If matched '/login' AND custom path NOT set -> Show Login
    // Else -> Show 404

    const currentPath = route.path;
    const configuredPath = config.customLoginPath ? '/' + config.customLoginPath.replace(/^\//, '') : '/login';
    
    if (currentPath === configuredPath) {
        activeComponent.value = Login;
        // Pass login function prop if needed, or rely on store
        componentProps.value = {
            login: sessionStore.login
        };
    } else if (currentPath === '/login' && !config.customLoginPath) {
        // Default login path allowed
        activeComponent.value = Login;
        componentProps.value = {
             login: sessionStore.login
        };
    } else {
        // Not a login path, and fell through to catch-all
        activeComponent.value = NotFound;
        componentProps.value = {};
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
