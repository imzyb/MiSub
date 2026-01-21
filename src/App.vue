<script setup>
import { computed, defineAsyncComponent, onMounted, watch } from 'vue'; // [UPDATED] added computed
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useDataStore } from './stores/useDataStore';
import { useSessionStore } from './stores/session';
import { useThemeStore } from './stores/theme';
import { useToastStore } from './stores/toast';
import { useUIStore } from './stores/ui';
import NavBar from './components/layout/NavBar.vue';
import LoadingSpinner from './components/ui/LoadingSpinner.vue';

// Lazy components
const Login = defineAsyncComponent(() => import('./components/modals/Login.vue'));
const NotFound = defineAsyncComponent(() => import('./views/NotFound.vue'));
const Toast = defineAsyncComponent(() => import('./components/ui/Toast.vue'));
const Footer = defineAsyncComponent(() => import('./components/layout/Footer.vue'));
const PWAUpdatePrompt = defineAsyncComponent(() => import('./components/features/PWAUpdatePrompt.vue'));
const PWADevTools = defineAsyncComponent(() => import('./components/features/PWADevTools.vue'));
const Dashboard = defineAsyncComponent(() => import('./components/features/Dashboard/Dashboard.vue'));
const Header = defineAsyncComponent(() => import('./components/layout/Header.vue'));

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const { theme } = storeToRefs(themeStore);
const { initTheme } = themeStore;

const sessionStore = useSessionStore();
const { sessionState } = storeToRefs(sessionStore);
const { checkSession, login, logout } = sessionStore;

const toastStore = useToastStore();
const { toast: toastState } = storeToRefs(toastStore);

const dataStore = useDataStore();
const { isDirty, saveState } = storeToRefs(dataStore);

const uiStore = useUIStore();
const { layoutMode } = storeToRefs(uiStore);

// [NEW] Computed properties for layout logic
const isLoggedIn = computed(() => sessionState.value === 'loggedIn');
const isPublicRoute = computed(() => route.meta.isPublic);

const showModernNavBar = computed(() => isLoggedIn.value && layoutMode.value === 'modern');
const showLegacyHeader = computed(() => !showModernNavBar.value && (isLoggedIn.value || isPublicRoute.value));

const shouldCenterMain = computed(() => 
  sessionState.value !== 'loggedIn' && 
  sessionState.value !== 'loading' && 
  !isPublicRoute.value
);

const showSavePrompt = computed(() => 
  layoutMode.value === 'modern' && (isDirty.value || saveState.value === 'success')
);

// Determine which login component to show (Custom Path -> NotFound, else -> Login)
const loginComponent = computed(() => 
  sessionStore.publicConfig?.customLoginPath ? NotFound : Login
);

onMounted(async () => {
  initTheme();
  await checkSession();
});

watch(sessionState, async (newVal) => {
  if (newVal === 'loggedIn') {
    try {
      await dataStore.fetchData();
    } catch (error) {
      // 错误提示已由 dataStore 处理
    }
  }
}, { immediate: true });

watch([sessionState, isPublicRoute], ([newState, isPublic]) => {
  if (newState === 'loggedOut' && !isPublic) {
    router.replace('/');
  }
}, { immediate: true });

const handleSave = async () => {
  try {
    await dataStore.saveData();
  } catch (error) {
    // 错误提示已由 dataStore 处理
  }
};
const handleDiscard = async () => {
  try {
    await dataStore.fetchData(true);
    toastStore.showToast('已放弃所有未保存的更改');
  } catch (error) {
    toastStore.showToast(`放弃更改失败: ${error.message}`, 'error');
  }
};

</script>

<template>
  <div 
    :class="theme" 
    class="min-h-screen flex flex-col text-gray-800 dark:text-gray-200 transition-colors duration-300 bg-gray-100 dark:bg-gray-950"
  >
    <!-- Navigation -->
    <NavBar 
      v-if="showModernNavBar" 
      :is-logged-in="true" 
      @logout="logout" 
    />
    <Header 
      v-else-if="showLegacyHeader" 
      :is-logged-in="isLoggedIn" 
      @logout="logout" 
    />

    <main 
      class="grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
      :class="{ 'flex items-center justify-center': shouldCenterMain }"
    >
      <div v-if="sessionState === 'loading'" class="flex justify-center p-8">
        <LoadingSpinner type="spinner" size="md" color="indigo" message="正在加载..." />
      </div>
      
      <!-- LOGGED IN VIEW -->
      <template v-else-if="isLoggedIn">
          <Transition name="slide-fade">
            <div v-if="showSavePrompt" 
                class="fixed bottom-24 md:bottom-auto md:top-24 left-1/2 -translate-x-1/2 z-40 p-1.5 pr-2 rounded-full shadow-2xl flex items-center gap-3 transition-all duration-300 backdrop-blur-xl border border-white/20 dark:border-white/10"
                :class="saveState === 'success' ? 'bg-teal-500/20 text-teal-600 dark:text-teal-300 shadow-teal-500/10' : 'bg-white/80 dark:bg-gray-900/80 shadow-black/10'">
                
                <div class="pl-2 pr-1 flex items-center gap-2">
                    <span v-if="saveState === 'success'" class="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                    <span v-else class="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                    <p class="text-xs font-semibold whitespace-nowrap">
                        {{ saveState === 'success' ? '已保存更改' : '未保存更改' }}
                    </p>
                </div>

                <div class="flex items-center gap-1">
                    <button v-if="saveState !== 'success'" @click="handleDiscard" class="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/10 whitespace-nowrap">
                        放弃
                    </button>
                    <button @click="handleSave" :disabled="saveState !== 'idle'" class="px-4 py-1.5 text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white rounded-full shadow-lg shadow-primary-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none whitespace-nowrap">
                        {{ saveState === 'saving' ? '保存中...' : (saveState === 'success' ? '完成' : '立即保存') }}
                    </button>
                </div>
            </div>
          </Transition>

          <Suspense v-if="layoutMode === 'modern'">
            <template #default>
              <router-view v-slot="{ Component, route: viewRoute }">
                <transition name="fade" mode="out-in">
                  <component v-if="Component" :is="Component" :key="viewRoute.fullPath" />
                </transition>
              </router-view>
            </template>
            <template #fallback>
              <div class="flex justify-center py-12">
                <LoadingSpinner type="spinner" size="md" color="indigo" message="页面加载中..." />
              </div>
            </template>
          </Suspense>

          <Dashboard v-else />
      </template>

      <!-- PUBLIC ROUTE VIEW (Not logged in, but isPublic) -->
       <template v-else-if="isPublicRoute">
         <Suspense>
           <template #default>
             <router-view v-slot="{ Component, route: viewRoute }">
               <transition name="fade" mode="out-in">
                 <component v-if="Component" :is="Component" :key="viewRoute.fullPath" />
               </transition>
             </router-view>
           </template>
           <template #fallback>
             <div class="flex justify-center py-12">
               <LoadingSpinner type="spinner" size="md" color="indigo" message="页面加载中..." />
             </div>
           </template>
         </Suspense>
       </template>
      
      <!-- LOGIN VIEW (Not logged in, not public) -->
      <template v-else>
         <component 
            :is="loginComponent" 
            :login="login" 
         />
      </template>

    </main>
    
    <Toast :show="toastState.id" :message="toastState.message" :type="toastState.type" />
    <PWAUpdatePrompt />
    <PWADevTools />
    <Footer />
  </div>
</template>

<style>
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
.ios-content-offset {
    padding-top: calc(var(--safe-top));
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-fade-enter-active, .slide-fade-leave-active { transition: all 0.3s ease; }
.slide-fade-enter-from, .slide-fade-leave-to { transform: translateY(-10px); opacity: 0; }
</style>
