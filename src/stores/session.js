
import { ref } from 'vue';
import { defineStore } from 'pinia';
import router from '../router';
import { fetchInitialData, login as apiLogin, fetchPublicConfig } from '../lib/api';
import { api } from '../lib/http.js';
import { handleError } from '../utils/errorHandler.js';
import { useDataStore } from './useDataStore';

export const useSessionStore = defineStore('session', () => {
  const sessionState = ref('loading'); // loading, loggedIn, loggedOut
  const initialData = ref(null);
  const subscriptionConfig = ref({}); // [NEW] Added subscriptionConfig
  const publicConfig = ref({ enablePublicPage: true }); // Default true until fetched

  async function checkSession() {
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

    if (dataResult.success) {
      initialData.value = dataResult.data;
      if (dataResult.data.config) {
        subscriptionConfig.value = dataResult.data.config;
      }

      // 直接注入数据到 dataStore，避免 Dashboard 重复请求
      const dataStore = useDataStore();
      dataStore.hydrateFromData(dataResult.data);

      sessionState.value = 'loggedIn';
    } else {
      // Auth failed or other error
      if (dataResult.errorType === 'auth') {
        sessionState.value = 'loggedOut';
      } else {
        // Network or other error, still show logged out
        console.error("Session check failed:", dataResult.error);
        handleError(new Error(dataResult.error || '会话检查失败'), '会话检查', {
          errorType: dataResult.errorType
        });
        sessionState.value = 'loggedOut';
      }
    }
  }

  async function login(password) {
    const result = await apiLogin(password);
    if (result.success) {
      handleLoginSuccess();
      // 登录成功后跳转到首页 (HomeView will show Dashboard)
      router.push({ path: '/' });
    } else {
      throw new Error(result.error || '登录失败');
    }
  }

  function handleLoginSuccess() {
    sessionState.value = 'loading';
    checkSession();
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

    // 跳转到首页（由于状态已变更为loggedOut，HomeView会自动渲染PublicProfilesView）
    router.push({ path: '/' });
  }

  return { sessionState, initialData, publicConfig, subscriptionConfig, checkSession, login, logout };
});
