import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUIStore = defineStore('ui', () => {
  const isSettingsModalVisible = ref(false);
  const layoutMode = ref(localStorage.getItem('layoutMode') || 'modern');

  function show() {
    isSettingsModalVisible.value = true;
  }

  function hide() {
    isSettingsModalVisible.value = false;
  }

  function toggleLayout() {
    layoutMode.value = layoutMode.value === 'modern' ? 'legacy' : 'modern';
    localStorage.setItem('layoutMode', layoutMode.value);

    // Always redirect to root / to ensure clean state and consistent entry point
    // This handles:
    // 1. Switching to Legacy directly invokes Dashboard at /
    // 2. Switching to Modern ensures we start at Dashboard as requested
    window.location.href = '/';
  }

  return { isSettingsModalVisible, layoutMode, show, hide, toggleLayout };
});
