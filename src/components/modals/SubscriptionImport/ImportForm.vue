<script setup>
import { computed } from 'vue';

const props = defineProps({
  subscriptionUrl: {
    type: String,
    default: ''
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:subscriptionUrl', 'submit']);

const urlModel = computed({
  get: () => props.subscriptionUrl,
  set: (val) => emit('update:subscriptionUrl', val)
});
</script>

<template>
  <div>
    <label for="subscription-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      订阅链接
    </label>
    <input
      id="subscription-url"
      v-model="urlModel"
      type="url"
      placeholder="https://example.com/subscription-link"
      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 misub-radius-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
      @keyup.enter="emit('submit')"
      :disabled="isLoading"
    />
  </div>

  <div class="text-xs text-gray-500 dark:text-gray-400">
    <p>提示：导入的节点将被添加到手动节点列表，请确保节点链接格式正确。</p>
  </div>
</template>
