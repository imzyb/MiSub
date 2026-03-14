<script setup>
import { computed } from 'vue';
import { useUIStore } from '../../stores/ui.js';
import { useSessionStore } from '../../stores/session.js';
import BrandLogo from './BrandLogo.vue';
import NavActionGroup from './NavActionGroup.vue';

const uiStore = useUIStore();
const sessionStore = useSessionStore();

const shouldHideLoginButton = computed(() => {
  if (sessionStore.sessionState === 'loading') {
    return true;
  }

  const rawPath = sessionStore.publicConfig?.customLoginPath;
  if (!rawPath || typeof rawPath !== 'string') {
    return false;
  }

  const normalizedPath = rawPath.trim().replace(/^\/+/, '');
  if (!normalizedPath || normalizedPath === 'login') {
    return false;
  }

  return true;
});

const props = defineProps({
  isLoggedIn: Boolean
});

const emit = defineEmits(['logout']);
</script>

<template>
  <header
    class="ios-fixed-header bg-gradient-to-b from-white/95 via-white/90 to-white/95 dark:from-[#030712]/95 dark:via-[#030712]/90 dark:to-[#030712]/95 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/30 dark:border-white/5 supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-[#030712]/80 transition-all duration-300"
  >
    <div class="ios-status-overlay"></div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="safe-top-inset">
        <div class="flex justify-between items-center h-16 md:h-20">
          <BrandLogo text-size-class="text-lg" :icon-size="20" />

          <NavActionGroup
            :is-logged-in="isLoggedIn"
            :show-explore="false"
            :show-settings="true"
            :show-login-button="!shouldHideLoginButton"
            :with-focus-ring="true"
            rounded-class="misub-radius-md"
            @open-settings="uiStore.show()"
            @toggle-layout="uiStore.toggleLayout()"
            @logout="emit('logout')"
          />
        </div>
      </div>
    </div>
  </header>
</template>
