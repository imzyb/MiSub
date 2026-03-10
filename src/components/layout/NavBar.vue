<script setup>
import { useRoute } from 'vue-router';
import { useUIStore } from '../../stores/ui.js';
import BaseIcon from '../ui/BaseIcon.vue';
import BrandLogo from './BrandLogo.vue';
import NavActionGroup from './NavActionGroup.vue';
import { MAIN_NAV_ITEMS } from '../../constants/navigation.js';

const route = useRoute();
const uiStore = useUIStore();

defineProps({
  isLoggedIn: Boolean
});

const emit = defineEmits(['logout']);

const navItems = MAIN_NAV_ITEMS;
</script>

<template>
  <!-- Mobile Top Header (Moved to top for Sticky behavior) -->
  <header class="md:hidden pointer-events-auto sticky top-0 z-50 flex items-center justify-between px-4 py-3 w-full bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 transition-all duration-300">
      <BrandLogo text-size-class="text-lg" :icon-size="18" />
      
      <NavActionGroup
        :is-logged-in="true"
        :with-focus-ring="true"
        rounded-class="rounded-full"
        @toggle-layout="uiStore.toggleLayout()"
        @logout="emit('logout')"
      />
  </header>

  <div class="pointer-events-none sticky top-0 z-50 w-full flex justify-center pt-4 px-4">
    <!-- Desktop Floating Island -->
    <header class="pointer-events-auto hidden md:flex items-center gap-2 p-2 rounded-full glass-panel shadow-2xl shadow-primary-500/10 border-white/40 dark:border-white/10 transition-all duration-500 hover:shadow-primary-500/20 max-w-4xl w-full justify-between bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl">
      
      <!-- Logo Area -->
      <div class="pl-4 pr-6 shrink-0 border-r border-gray-200 dark:border-white/10">
        <BrandLogo text-size-class="text-lg" :icon-size="20" />
      </div>

      <!-- Navigation Links -->
      <nav class="flex items-center gap-1">
        <router-link 
          v-for="item in navItems" 
          :key="item.path" 
          :to="item.path"
          class="nav-tab group"
          :class="[
            route.path === item.path 
              ? 'nav-tab-active' 
              : 'nav-tab-inactive'
          ]"
        >
          <!-- Active Background Pill -->
          <div v-if="route.path === item.path" class="nav-tab-active-pill"></div>
          
          <span class="relative z-10">{{ item.name }}</span>
        </router-link>
      </nav>

      <!-- Right Actions -->
      <div class="flex items-center pl-4 ml-2 gap-2 border-l border-gray-200 dark:border-white/10">
        <NavActionGroup
          :is-logged-in="true"
          :with-focus-ring="true"
          :show-divider="true"
          rounded-class="rounded-full"
          @toggle-layout="uiStore.toggleLayout()"
          @logout="emit('logout')"
        />
      </div>

    </header>

    <!-- Mobile Bottom Navigation -->
    <nav v-if="isLoggedIn" class="md:hidden pointer-events-auto mobile-nav-glass fixed bottom-0 inset-x-0 safe-bottom-inset z-[60]">
        <div class="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
          <router-link 
            v-for="item in navItems" 
            :key="item.path" 
            :to="item.path"
            class="nav-mobile-item"
            :class="route.path === item.path ? 'nav-mobile-item-active' : 'nav-mobile-item-inactive'"
          >
            <!-- Icons -->
            <div class="relative">
                <BaseIcon 
                  :path="item.iconPath" 
                  className="w-6 h-6 transition-transform duration-300"
                  :class="route.path === item.path ? 'scale-110' : ''"
                />
            </div>
            
            <span class="text-[10px] font-medium tracking-tight">{{ item.name }}</span>
          </router-link>
        </div>
    </nav>
  </div>
</template>
