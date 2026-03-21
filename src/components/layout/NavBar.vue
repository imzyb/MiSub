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

const props = defineProps({
  isLoggedIn: Boolean
});

const emit = defineEmits(['logout']);

const navItems = MAIN_NAV_ITEMS;

// 路由激活判断：/ 精确匹配，其他路径前缀匹配（支持子路由）
function isActive(path) {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
}
</script>

<template>
  <!-- Mobile Top Header -->
  <header
    aria-label="顶部导航栏"
    class="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-2.5 w-full bg-white/85 dark:bg-[#030712]/85 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 shadow-sm transition-all duration-300"
  >
    <BrandLogo text-size-class="text-lg" :icon-size="32" />

    <NavActionGroup
      :is-logged-in="isLoggedIn"
      :show-explore="isPublicEnabled"
      :with-focus-ring="true"
      rounded-class="rounded-full"
      @toggle-layout="uiStore.toggleLayout()"
      @logout="emit('logout')"
    />
  </header>

  <!-- Desktop Header -->
  <header
    aria-label="主导航栏"
    class="hidden md:block sticky top-0 z-50 w-full bg-white/85 dark:bg-[#030712]/85 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 transition-all duration-300"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
      <!-- Logo Area -->
      <div class="shrink-0 pr-6 border-r border-gray-200 dark:border-white/10">
        <BrandLogo text-size-class="text-lg" :icon-size="32" />
      </div>

      <!-- Navigation Links -->
      <nav aria-label="主导航" class="flex items-center gap-1">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-tab group"
          :class="[
            isActive(item.path)
              ? 'nav-tab-active'
              : 'nav-tab-inactive'
          ]"
        >
          <!-- Active Background Pill -->
          <div v-if="isActive(item.path)" class="nav-tab-active-pill"></div>

          <span class="relative z-10">{{ item.name }}</span>
        </router-link>
      </nav>

      <!-- Right Actions -->
      <div class="flex items-center pl-4 ml-2 gap-2 border-l border-gray-200 dark:border-white/10">
        <NavActionGroup
          :is-logged-in="isLoggedIn"
          :show-explore="isPublicEnabled"
          :with-focus-ring="true"
          :show-divider="true"
          rounded-class="rounded-full"
          @toggle-layout="uiStore.toggleLayout()"
          @logout="emit('logout')"
        />
      </div>
    </div>
  </header>

  <!-- Mobile Bottom Tab Bar（独立于 sticky wrapper 之外，避免 z-index 层叠上下文问题）-->
  <nav
    v-if="isLoggedIn"
    aria-label="底部主导航"
    class="md:hidden mobile-nav-glass fixed bottom-0 inset-x-0 safe-bottom-inset z-[60]"
  >
    <div class="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-mobile-item"
        :class="isActive(item.path) ? 'nav-mobile-item-active' : 'nav-mobile-item-inactive'"
      >
        <div class="relative">
          <BaseIcon
            :path="item.iconPath"
            className="w-6 h-6 transition-transform duration-300"
            :class="isActive(item.path) ? 'scale-110' : ''"
          />
        </div>

        <span class="text-[10px] font-medium tracking-tight">{{ item.name }}</span>
      </router-link>
    </div>
  </nav>
</template>
