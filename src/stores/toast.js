import { defineStore } from 'pinia';
import { ref } from 'vue';
import { TIMING } from '../constants/timing.js';

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([]);

  function showToast(message, type = 'info', duration = TIMING.TOAST_DURATION_MS) {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    const toastItem = {
      id,
      message,
      type,
      duration
    };

    toasts.value.push(toastItem);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  function removeToast(id) {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  }

  function hideToast() {
    toasts.value = [];
  }

  return { toasts, showToast, removeToast, hideToast };
});
