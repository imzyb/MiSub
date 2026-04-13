<script setup>
import { defineAsyncComponent, onMounted, watch, computed, ref } from 'vue';
import RouteErrorBoundary from './components/ui/RouteErrorBoundary.vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from './stores/theme';
import { useSessionStore } from './stores/session';
import { useToastStore } from './stores/toast';
import { useDataStore } from './stores/useDataStore';
import { useUIStore } from './stores/ui';
import { storeToRefs } from 'pinia';
import NavBar from './components/layout/NavBar.vue';
import { detectLegacyD1 } from './lib/api.js';
import { fetchGithubLatestRelease } from './lib/api.js';
import packageJson from '../package.json';

// Lazy components
const Login = defineAsyncComponent(() => import('./components/modals/Login.vue'));
const NotFound = defineAsyncComponent(() => import('./views/NotFound.vue'));
const Toast = defineAsyncComponent(() => import('./components/ui/Toast.vue'));
const Footer = defineAsyncComponent(() => import('./components/layout/Footer.vue'));
const Dashboard = defineAsyncComponent(() => import('./components/features/Dashboard/Dashboard.vue'));
const Header = defineAsyncComponent(() => import('./components/layout/Header.vue'));
const SavePrompt = defineAsyncComponent(() => import('./components/ui/SavePrompt.vue'));
const ScrollToTop = defineAsyncComponent(() => import('./components/ui/ScrollToTop.vue'));
const LegacyD1MigrationModal = defineAsyncComponent(() => import('./components/modals/LegacyD1MigrationModal.vue'));
const VersionChangelogModal = defineAsyncComponent(() => import('./components/modals/VersionChangelogModal.vue'));

const route = useRoute();
const themeStore = useThemeStore();
const { theme } = storeToRefs(themeStore);
const { initTheme } = themeStore;

const sessionStore = useSessionStore();
const { sessionState } = storeToRefs(sessionStore);
const { checkSession, login, logout } = sessionStore;

const toastStore = useToastStore();

const dataStore = useDataStore();
const { isDirty, saveState } = storeToRefs(dataStore);

const uiStore = useUIStore();
const { layoutMode } = storeToRefs(uiStore);

const isLoggedIn = computed(() => sessionState.value === 'loggedIn');
const isPublicRoute = computed(() => route.meta.isPublic);
const isSessionLoading = computed(() => sessionState.value === 'loading');

const showModernNavBar = computed(() => isLoggedIn.value && layoutMode.value === 'modern');
const showLegacyHeader = computed(() => {
  if (showModernNavBar.value) return false;
  if (isLoggedIn.value) return true;
  if (isSessionLoading.value || !isPublicRoute.value) return false;
  return true;
});
const showPublicFooter = computed(() => {
  return true;
});
const shouldShowFooter = computed(() => !isSessionLoading.value && (!isPublicRoute.value || showPublicFooter.value));

const shouldCenterMain = computed(() =>
  sessionState.value !== 'loggedIn' &&
  sessionState.value !== 'loading' &&
  !isPublicRoute.value
);

const showSavePrompt = computed(() =>
  layoutMode.value === 'modern' && (isDirty.value || saveState.value === 'success')
);
const showLegacyD1MigrationModal = ref(false);
const legacyD1Details = ref({ hasLegacySubscriptions: false, hasLegacyProfiles: false });
const showVersionChangelogModal = ref(false);
const showVersionUpdateNotice = ref(false);
const versionReleaseInfo = ref(null);
const pendingVersionModal = ref(false);
const currentVersion = packageJson.version;
const upstreamRepo = 'imzyb/MiSub';

const normalizeVersion = (version) => String(version || '').trim().replace(/^v/i, '');
const compareVersions = (left, right) => {
  const a = normalizeVersion(left).split('.').map(n => parseInt(n, 10) || 0);
  const b = normalizeVersion(right).split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
};

const getVersionModalDismissKey = (releaseTag) => `misub_release_notes_hidden:${normalizeVersion(currentVersion)}:${normalizeVersion(releaseTag)}`;

const maybeShowVersionModal = () => {
  if (!versionReleaseInfo.value) return;
  const dismissKey = getVersionModalDismissKey(versionReleaseInfo.value.tag_name);
  if (localStorage.getItem(dismissKey) === 'true') return;
  if (showLegacyD1MigrationModal.value) {
    pendingVersionModal.value = true;
    return;
  }
  showVersionChangelogModal.value = true;
  pendingVersionModal.value = false;
};

// Determine which login component to show (Custom Path -> NotFound, else -> Login)
const loginComponent = computed(() => {
  const rawPath = sessionStore.publicConfig?.customLoginPath;
  const normalizedPath = (rawPath && typeof rawPath === 'string') ? rawPath.trim().replace(/^\/+/, '') : '';
  // 只有当存在有效的自定义路径（非空且不等于默认 'login'）时才显示 NotFound
  return (normalizedPath && normalizedPath !== 'login') ? NotFound : Login;
});

const isDefaultPassword = computed(() => {
  return sessionStore.subscriptionConfig?.isDefaultPassword === true;
});

onMounted(async () => {
  initTheme();
  await checkSession();
});

watch(sessionState, async (newVal) => {
  if (newVal === 'loggedIn') {
    await dataStore.fetchData();

    try {
      const result = await detectLegacyD1();
      if (result?.success && result.data?.hasLegacyData) {
        legacyD1Details.value = result.data;
        showLegacyD1MigrationModal.value = true;
      }
    } catch {
      // Non-blocking legacy check.
    }

    try {
        const release = await fetchGithubLatestRelease(upstreamRepo);
      if (release?.tag_name) {
        versionReleaseInfo.value = release;
        const versionCompare = compareVersions(release.tag_name, currentVersion);
        if (versionCompare > 0) {
          showVersionUpdateNotice.value = true;
          toastStore.showToast(`检测到上游新版本 ${release.tag_name}，当前版本为 ${currentVersion}`, 'warning');
        } else if (versionCompare === 0) {
          showVersionUpdateNotice.value = false;
          maybeShowVersionModal();
        }
      }
    } catch {
      // Non-blocking version check.
    }
  }
}, { immediate: true });

const handleLegacyD1MigrationSuccess = async () => {
  showLegacyD1MigrationModal.value = false;
  await dataStore.fetchData(true);
  if (pendingVersionModal.value) {
    maybeShowVersionModal();
  }
};

const handleLegacyD1MigrationClose = (value) => {
  showLegacyD1MigrationModal.value = value;
  if (!value && pendingVersionModal.value) {
    maybeShowVersionModal();
  }
};

const handleVersionModalConfirm = () => {
  showVersionChangelogModal.value = false;
};

const handleVersionModalSuppress = () => {
  if (versionReleaseInfo.value?.tag_name) {
    localStorage.setItem(getVersionModalDismissKey(versionReleaseInfo.value.tag_name), 'true');
  }
  showVersionChangelogModal.value = false;
};

const handleSave = async () => {
  await dataStore.saveData();
};
const handleDiscard = async () => {
  await dataStore.fetchData(true);
  toastStore.showToast('已放弃所有未保存的更改');
};

</script>

<template>
  <div :class="theme"
    class="min-h-screen flex flex-col text-gray-800 dark:text-gray-200 transition-colors duration-300 bg-gray-100 dark:bg-[#030712]">
    <!-- Navigation -->
    <NavBar v-if="showModernNavBar" :is-logged-in="true" @logout="logout" />
    <Header v-else-if="showLegacyHeader" :is-logged-in="isLoggedIn" @logout="logout" />

<main class="grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6" :class="{
'flex items-center justify-center': shouldCenterMain,
'ios-header-padding': showLegacyHeader
}">
<div
v-if="sessionState === 'loading'"
class="flex flex-col items-center justify-center p-8 min-h-[60vh]"
role="status"
aria-live="polite"
>
<div class="relative mb-8">
<div class="w-16 h-16 border-4 border-primary-200 dark:border-primary-800 rounded-full animate-pulse"></div>
<div class="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-primary-500 rounded-full animate-spin"></div>
</div>
<div class="flex flex-col items-center gap-3">
<div class="h-6 w-32 bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded animate-pulse"></div>
<div class="h-4 w-24 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded animate-pulse"></div>
</div>
</div>

      <template v-else-if="isLoggedIn">
<!-- Security Banner -->
<div v-if="isDefaultPassword" class="mb-4 px-4 py-4 bg-gradient-to-r from-red-500/90 via-red-600/90 to-red-500/90 backdrop-blur-xl text-white misub-radius-lg border border-red-400/30 shadow-lg shadow-red-500/20">
<div class="mx-auto flex max-w-7xl items-center justify-center gap-4">
<div class="relative">
<div class="absolute inset-0 bg-white/30 rounded-full blur-md animate-pulse"></div>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 relative z-10">
<path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
</svg>
</div>
<p class="text-sm font-medium">
安全警告：检测到您正在使用默认密码 "admin"。为了您的系统安全，请立即前往设置修改密码。
</p>
</div>
</div>

<div v-if="showVersionUpdateNotice && versionReleaseInfo" class="mb-4 rounded-lg border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-amber-800 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
<div class="flex items-start justify-between gap-4">
<div class="space-y-1">
<p class="text-sm font-semibold">检测到上游新版本 {{ versionReleaseInfo.tag_name }}</p>
<p class="text-sm opacity-90">当前版本为 {{ currentVersion }}。建议在确认变更内容后安排升级。</p>
<a v-if="versionReleaseInfo.html_url" :href="versionReleaseInfo.html_url" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-2">
查看发布说明
</a>
</div>
<button @click="showVersionUpdateNotice = false" class="rounded-md px-2 py-1 text-sm hover:bg-amber-100/80 dark:hover:bg-white/10">知道了</button>
</div>
</div>

        <SavePrompt :is-dirty="showSavePrompt" :save-state="saveState" @save="handleSave" @discard="handleDiscard" />

        <router-view v-if="layoutMode === 'modern'" v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <RouteErrorBoundary :reset-key="route.fullPath">
              <component :is="Component" />
            </RouteErrorBoundary>
          </transition>
        </router-view>

        <Dashboard v-else />
      </template>

      <!-- PUBLIC ROUTE VIEW (Not logged in, but isPublic) -->
      <template v-else-if="isPublicRoute">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <RouteErrorBoundary :reset-key="route.fullPath">
              <component :is="Component" />
            </RouteErrorBoundary>
          </transition>
        </router-view>
      </template>

      <!-- LOGIN VIEW (Not logged in, not public) -->
      <template v-else>
        <component :is="loginComponent" :login="login" />
      </template>

    </main>

<Toast />
    <LegacyD1MigrationModal
      :show="showLegacyD1MigrationModal"
      :details="legacyD1Details"
      @update:show="handleLegacyD1MigrationClose"
      @success="handleLegacyD1MigrationSuccess"
    />
    <VersionChangelogModal
      :show="showVersionChangelogModal"
      :release="versionReleaseInfo || {}"
      :current-version="currentVersion"
      @update:show="showVersionChangelogModal = $event"
      @confirm="handleVersionModalConfirm"
      @suppress="handleVersionModalSuppress"
    />
    <Footer v-if="shouldShowFooter" />
<ScrollToTop v-if="isLoggedIn || isPublicRoute" />
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

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* iOS Specific Padding for Fixed Header */
@supports (-webkit-touch-callout: none) {
  .ios-header-padding {
    padding-top: calc(env(safe-area-inset-top, 0px) + 80px) !important;
  }
}
</style>
