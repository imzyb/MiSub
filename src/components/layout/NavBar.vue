<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUIStore } from '../../stores/ui.js';
import { useSessionStore } from '../../stores/session.js';
import { storeToRefs } from 'pinia';
import BaseIcon from '../ui/BaseIcon.vue';
import BrandLogo from './BrandLogo.vue';
import NavActionGroup from './NavActionGroup.vue';
import { MAIN_NAV_ITEMS } from '../../constants/navigation.js';

const route = useRoute();
const uiStore = useUIStore();
const sessionStore = useSessionStore();
const { publicConfig } = storeToRefs(sessionStore);
const isPublicEnabled = computed(() => publicConfig.value?.enablePublicPage === true);
const hideBranding = computed(() => publicConfig.value?.customPage?.enabled === true && publicConfig.value?.customPage?.hideBranding === true);

defineProps({
  isLoggedIn: Boolean
});

const emit = defineEmits(['logout']);

const navItems = MAIN_NAV_ITEMS;

function isActive(path) {
  if (path === '/') return route.path === '/';
  if (path === '/dashboard') return route.path === '/dashboard';
  return route.path.startsWith(path);
}
</script>

<template>
  <header
    aria-label="顶部导航栏"
    class="app-nav-bar md:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-2.5 w-full bg-white/90 dark:bg-[#030712]/88 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/10 shadow-sm transition-all duration-300"
  >
    <BrandLogo text-size-class="text-lg" :icon-size="32" />

    <NavActionGroup
      :is-logged-in="isLoggedIn"
      :show-explore="isPublicEnabled"
      :hide-external-repo="hideBranding"
      :with-focus-ring="true"
      rounded-class="rounded-full"
      @toggle-layout="uiStore.toggleLayout()"
      @logout="emit('logout')"
    />
  </header>

  <header
    aria-label="主导航栏"
    class="app-nav-bar hidden md:block sticky top-0 z-50 w-full bg-white/90 dark:bg-[#030712]/88 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/10 transition-all duration-300"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-[76px] flex items-center justify-between">
      <div class="shrink-0 pr-5">
        <BrandLogo text-size-class="text-lg" :icon-size="32" />
      </div>

      <nav aria-label="主导航" class="nav-tab-shell">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-tab group"
          :class="isActive(item.path) ? 'nav-tab-active' : 'nav-tab-inactive'"
        >
          <div v-if="isActive(item.path)" class="nav-tab-active-pill"></div>

          <BaseIcon
            :path="item.iconPath"
            className="relative z-10 h-4 w-4 shrink-0 transition-transform duration-300"
            :class="isActive(item.path) ? 'scale-105' : 'opacity-75 group-hover:opacity-100'"
          />
          <span class="relative z-10">{{ item.name }}</span>
        </router-link>
      </nav>

      <div class="flex items-center pl-5 ml-3 gap-2">
        <NavActionGroup
          :is-logged-in="isLoggedIn"
          :show-explore="isPublicEnabled"
          :hide-external-repo="hideBranding"
          :with-focus-ring="true"
          :show-divider="true"
          rounded-class="rounded-full"
          @toggle-layout="uiStore.toggleLayout()"
          @logout="emit('logout')"
        />
      </div>
    </div>
  </header>

  <nav
    v-if="isLoggedIn"
    aria-label="底部主导航"
    class="md:hidden mobile-nav-glass z-[60]"
  >
    <div class="mobile-nav-inner">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-mobile-item"
        :class="isActive(item.path) ? 'nav-mobile-item-active' : 'nav-mobile-item-inactive'"
      >
        <span class="nav-mobile-icon-wrap">
          <BaseIcon
            :path="item.iconPath"
            className="w-5 h-5 transition-transform duration-300"
            :class="isActive(item.path) ? 'scale-110' : ''"
          />
        </span>

        <span class="text-[10px] font-medium tracking-tight">{{ item.name }}</span>
      </router-link>
    </div>
  </nav>
</template>
