<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  resetKey: {
    type: [String, Number],
    default: ''
  }
});

const hasError = ref(false);
const errorMessage = ref('');

const reset = () => {
  hasError.value = false;
  errorMessage.value = '';
};

watch(() => props.resetKey, () => {
  reset();
});

const handleReload = () => {
  window.location.reload();
};

const errorCaptured = (error) => {
  hasError.value = true;
  errorMessage.value = error?.message || '页面渲染失败';
  return false;
};

defineExpose({ reset, errorCaptured });
</script>

<template>
  <div v-if="hasError" class="w-full py-12 flex flex-col items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
    <div class="text-base font-semibold text-gray-900 dark:text-white">页面加载异常</div>
    <div class="max-w-md text-center text-xs text-gray-500">{{ errorMessage }}</div>
    <button
      class="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
      @click="handleReload"
    >
      重新加载
    </button>
  </div>
  <slot v-else />
</template>

<script>
export default {
  errorCaptured(err) {
    return this.$.exposed.errorCaptured(err);
  }
}
</script>
