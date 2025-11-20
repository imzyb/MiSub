<script setup>
import { onMounted } from 'vue';
import { useThemeStore } from './stores/theme';
import { useSessionStore } from './stores/session';
import { useToastStore } from './stores/toast';
import { storeToRefs } from 'pinia';

import Dashboard from './components/Dashboard.vue';
import DashboardSkeleton from './components/DashboardSkeleton.vue';
import Login from './components/Login.vue';
import Header from './components/Header.vue';
import Toast from './components/Toast.vue';
import Footer from './components/Footer.vue';

const themeStore = useThemeStore();
const { theme } = storeToRefs(themeStore);
const { initTheme } = themeStore;

const sessionStore = useSessionStore();
const { sessionState, initialData } = storeToRefs(sessionStore);
const { checkSession, login, logout } = sessionStore;

const toastStore = useToastStore();
const { toast: toastState } = storeToRefs(toastStore);

onMounted(() => {
  initTheme();
  checkSession();
});
</script>

<template>
  <div 
    :class="theme" 
    class="min-h-screen flex flex-col text-gray-800 dark:text-gray-200 transition-colors duration-300 bg-gray-100 dark:bg-gray-950"
  >
    <Header :is-logged-in="sessionState === 'loggedIn'" @logout="logout" />

    <main 
      class="grow"
      :class="{
        'flex items-center justify-center': sessionState !== 'loggedIn' && sessionState !== 'loading',
        'overflow-y-auto': sessionState === 'loggedIn' || sessionState === 'loading',
        'ios-content-offset': sessionState === 'loggedIn' || sessionState === 'loading'
      }"
    >
      <DashboardSkeleton v-if="sessionState === 'loading'" />
      <Dashboard v-else-if="sessionState === 'loggedIn' && initialData" :data="initialData" />
      <Login v-else :login="login" />
    </main>
    
    <Toast :show="toastState.id" :message="toastState.message" :type="toastState.type" />
    <Footer />
  </div>
</template>

<style>
:root.dark {
  color-scheme: dark;
}
:root.light {
  color-scheme: light;
}

/* iOS内容偏移适配 - 只在iOS设备上生效 */
@supports (-webkit-touch-callout: none) {
  .ios-content-offset {
    /* 为iOS状态栏和Header高度预留空间，防止内容穿透 */
    padding-top: calc(env(safe-area-inset-top, 0px) + 80px);
    margin-top: 0;
  }
  
  /* 确保整个应用区域正确适配 */
  body {
    padding-top: env(safe-area-inset-top, 0px);
  }
  
  /* 全局iOS适配 */
  html, body {
    overflow-x: hidden;
    position: relative;
  }
  
  /* 确保内容区域不会穿透 */
  * {
    -webkit-overflow-scrolling: touch;
  }
}

/* 非iOS设备的正常样式 */
@supports not (-webkit-touch-callout: none) {
  .ios-content-offset {
    /* 非iOS设备不需要额外的顶部间距 */
    padding-top: 0;
  }
}
</style>
