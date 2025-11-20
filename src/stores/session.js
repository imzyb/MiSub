
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchInitialData, login as apiLogin } from '../lib/api';

export const useSessionStore = defineStore('session', () => {
  const sessionState = ref('loading'); // loading, loggedIn, loggedOut
  const initialData = ref(null);

  async function checkSession() {
    try {
      const data = await fetchInitialData();
      if (data) {
        initialData.value = data;
        sessionState.value = 'loggedIn';
      } else {
        sessionState.value = 'loggedOut';
      }
    } catch (error) {
      console.error("Session check failed:", error);
      sessionState.value = 'loggedOut';
    }
  }

  async function login(password) {
    try {
      const response = await apiLogin(password);
      if (response.ok) {
        handleLoginSuccess();
      } else {
        const errData = await response.json();
        throw new Error(errData.error || '登录失败');
      }
    } catch(e) {
      throw e;
    }
  }

  function handleLoginSuccess() {
    sessionState.value = 'loading';
    checkSession();
  }

  async function logout() {
    await fetch('/api/logout');
    sessionState.value = 'loggedOut';
    initialData.value = null;
  }

  return { sessionState, initialData, checkSession, login, logout };
});
