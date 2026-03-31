<script setup>
const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  },
  parseStatus: {
    type: String,
    default: ''
  },
  errorMessage: {
    type: String,
    default: ''
  },
  successMessage: {
    type: String,
    default: ''
  }
});
</script>

<template>
  <div v-if="isLoading || parseStatus || errorMessage || successMessage" class="space-y-2">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      <span>{{ parseStatus || '正在处理...' }}</span>
    </div>

    <!-- 成功信息 -->
    <div v-if="successMessage" class="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span>{{ successMessage }}</span>
    </div>

    <!-- 错误信息 -->
    <div v-if="errorMessage" class="flex items-start space-x-2 text-sm text-red-600 dark:text-red-400">
      <svg class="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z">
        </path>
      </svg>
      <span>{{ errorMessage }}</span>
    </div>
  </div>
</template>
