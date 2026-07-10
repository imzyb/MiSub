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
    const nextMode = layoutMode.value === 'modern' ? 'legacy' : 'modern';
    localStorage.setItem('layoutMode', nextMode);

    // Navigate immediately WITHOUT modifying the reactive ref first.
    // Setting layoutMode.value before window.location.href triggers Vue
    // reactivity to re-render the component tree (unmounting the old layout,
    // mounting the new one) during the brief window before the browser
    // actually navigates. Any component error in that window is caught
    // by the global app.config.errorHandler and displayed as a Toast
    // error notification at the top-right of the screen.
    window.location.href = '/';
  }

  return { isSettingsModalVisible, layoutMode, show, hide, toggleLayout };
});
