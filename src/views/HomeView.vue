<script setup>
import { defineAsyncComponent, computed } from 'vue';
import { useSessionStore } from '../stores/session';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';

// Lazy load components
const DashboardView = defineAsyncComponent(() => import('./DashboardView.vue'));
const PublicProfilesView = defineAsyncComponent(() => import('./PublicProfilesView.vue'));
const NotFoundView = defineAsyncComponent(() => import('./NotFound.vue')); // [NEW] Use NotFound if public access disabled

const sessionStore = useSessionStore();
const { sessionState, publicConfig } = storeToRefs(sessionStore);
const route = useRoute();

const isExploreRoute = computed(() => route.path === '/explore');

const currentView = computed(() => {
    // Always allow public page on /explore
    if (isExploreRoute.value) {
        if (publicConfig.value && !publicConfig.value.enablePublicPage) {
            return NotFoundView;
        }
        return PublicProfilesView;
    }

    // If logged using 'loggedIn' state, show Dashboard
    if (sessionState.value === 'loggedIn') {
        return DashboardView;
    }
    
    // If public page is disabled, do NOT redirect to /login (which exposes entry).
    // Instead, show 404/Disguise logic.
    if (sessionState.value === 'loggedOut' && publicConfig.value && !publicConfig.value.enablePublicPage) {
        return NotFoundView;
    }
    
    // Otherwise show Public Profiles
    return PublicProfilesView;
});

// [REMOVED] Watcher that forced redirect to /login
// watchEffect(() => {
//     if (sessionState.value === 'loggedOut' && publicConfig.value && !publicConfig.value.enablePublicPage) {
//         router.replace('/login');
//     }
// });
</script>

<template>
    <component :is="currentView" />
</template>
