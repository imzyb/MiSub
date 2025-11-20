
import { defineStore } from 'pinia';
import { reactive } from 'vue';

export const useToastStore = defineStore('toast', () => {
  const toast = reactive({
    id: null,
    message: '',
    type: 'info',
  });

  let timeoutId = null;

  function showToast(message, type = 'info', duration = 3000) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    toast.id = Date.now();
    toast.message = message;
    toast.type = type;

    timeoutId = setTimeout(() => {
      hideToast();
    }, duration);
  }

  function hideToast() {
    toast.id = null;
  }

  return { toast, showToast, hideToast };
});
