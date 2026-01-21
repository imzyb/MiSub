
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchInitialData, login as apiLogin, fetchPublicConfig } from '../lib/api';
import { api } from '../lib/http.js';
import { useDataStore } from './useDataStore';
import router from '../router';

const loginReloadKey = 'misub_login_reloaded';

function canUseSessionStorage() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }
    const testKey = '__misub_session_test__';
    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

export const useSessionStore = defineStore('session', () => {
  const sessionState = ref('loading'); // loading, loggedIn, loggedOut
  const initialData = ref(null);
  const publicConfig = ref({ enablePublicPage: true }); // Default true until fetched
  const isConfigReady = ref(false);
  async function checkSession() {
    try {
      // Parallel fetch of initial data (auth check) and public config
      const [dataResult, pConfigResult] = await Promise.all([
        fetchInitialData(),
        fetchPublicConfig()
      ]);

      // Update public config
      if (pConfigResult.success) {
        publicConfig.value = pConfigResult.data;
      } else {
        // Fallback to default if fetch fails
        publicConfig.value = { enablePublicPage: false };
      }
      isConfigReady.value = true;

      if (dataResult.success) {
        initialData.value = dataResult.data;

        // 直接注入数据到 dataStore，避免 Dashboard 重复请求
        const dataStore = useDataStore();
        dataStore.hydrateFromData(dataResult.data);

        sessionState.value = 'loggedIn';
        return true;
      }

      // Auth failed or other error
      if (dataResult.errorType === 'auth') {
        sessionState.value = 'loggedOut';
      } else {
        // Network or other error, still show logged out
        console.error("Session check failed:", dataResult.error);
        sessionState.value = 'loggedOut';
      }
      return false;
    } catch (error) {
      console.error('Session check failed unexpectedly:', error);
      sessionState.value = 'loggedOut';
      return false;
    }
  }

  async function login(password) {
    const result = await apiLogin(password);
    if (result.success) {
      const success = await handleLoginSuccess();
      if (success) {
        // 登录成功后跳转到首页 (HomeView will show Dashboard)
        // 避免首次登录时路由切换导致的渲染异常，执行一次强制刷新
        if (canUseSessionStorage()) {
          const hasReloaded = window.sessionStorage.getItem(loginReloadKey) === '1';
          if (!hasReloaded) {
            window.sessionStorage.setItem(loginReloadKey, '1');
            window.location.replace('/');
            return;
          }
        }
        await router.push({ path: '/' });
      } else {
        throw new Error('登录后校验失败，请稍后重试');
      }
    } else {
      throw new Error(result.error || '登录失败');
    }
  }

  async function handleLoginSuccess() {
    sessionState.value = 'loading';
    return checkSession();
  }

  async function logout() {
    try {
      await api.get('/api/logout');
    } catch (error) {
      console.warn('Logout request failed:', error);
    }
    sessionState.value = 'loggedOut';
    initialData.value = null;

    // 清除缓存数据
    const dataStore = useDataStore();
    dataStore.clearCachedData();
    if (canUseSessionStorage()) {
      window.sessionStorage.removeItem(loginReloadKey);
    }

    // 跳转到首页（由于状态已变更为loggedOut，HomeView会自动渲染PublicProfilesView）
    router.push({ path: '/' });
  }

  return { sessionState, initialData, publicConfig, isConfigReady, checkSession, login, logout };
});
