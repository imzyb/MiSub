import { defineStore } from 'pinia';
import { ref } from 'vue';
import { TIMING } from '../constants/timing.js';

const DURATION_BY_TYPE = {
  success: TIMING.TOAST_DURATION_SUCCESS,
  error:   TIMING.TOAST_DURATION_ERROR,
  warning: TIMING.TOAST_DURATION_WARNING,
};

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([]);
  const queue = ref([]);

  function _resolveDuration(type, duration) {
    if (duration !== undefined) return duration;
    return DURATION_BY_TYPE[type] ?? TIMING.TOAST_DURATION_MS;
  }

  function _display(toastItem) {
    toasts.value.push(toastItem);
    setTimeout(() => removeToast(toastItem.id), toastItem.duration);
  }

  function _flush() {
    while (toasts.value.length < TIMING.TOAST_MAX_VISIBLE && queue.value.length > 0) {
      _display(queue.value.shift());
    }
  }

  function showToast(message, type = 'info', duration) {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    const toastItem = { id, message, type, duration: _resolveDuration(type, duration) };

    if (toasts.value.length < TIMING.TOAST_MAX_VISIBLE) {
      _display(toastItem);
    } else {
      queue.value.push(toastItem);
    }
  }

  function removeToast(id) {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
      _flush();
    }
  }

  function hideToast() {
    toasts.value = [];
    queue.value = [];
  }

  return { toasts, showToast, removeToast, hideToast };
});
