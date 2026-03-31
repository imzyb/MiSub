/**
 * 保存指示器组件
 * @author MiSub Team
 */

<script setup>
defineProps({
  dirty: {
    type: Boolean,
    required: true
  },
  saveState: {
    type: String,
    required: true,
    validator: (value) => ['idle', 'saving', 'success', 'error'].includes(value)
  }
});

defineEmits(['save']);

const saveButtonText = computed(() => {
  switch (saveState.value) {
    case 'saving':
      return '保存中...';
    case 'success':
      return '已保存';
    case 'error':
      return '保存失败';
    default:
      return '保存更改';
  }
});

const saveButtonClass = computed(() => {
  const baseClass = 'px-4 py-2 misub-radius-md text-sm font-medium transition-all duration-200';

  if (saveState.value === 'saving') {
    return `${baseClass} bg-gray-400 text-white cursor-not-allowed`;
  }

  if (saveState.value === 'success') {
    return `${baseClass} bg-green-600 text-white hover:bg-green-700`;
  }

  if (saveState.value === 'error') {
    return `${baseClass} bg-red-600 text-white hover:bg-red-700`;
  }

  if (!dirty.value) {
    return `${baseClass} bg-gray-300 text-gray-500 cursor-not-allowed`;
  }

  return `${baseClass} bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`;
});
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0 transform -translate-y-2"
    enter-to-class="opacity-100 transform translate-y-0"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100 transform translate-y-0"
    leave-to-class="opacity-0 transform -translate-y-2"
  >
    <div
      v-if="dirty || saveState !== 'idle'"
      class="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 misub-radius-md shadow-lg border border-gray-200 dark:border-gray-700 p-4"
    >
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <!-- Status Icon -->
          <div v-if="saveState === 'saving'" class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>

          <div v-else-if="saveState === 'success'" class="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
              <path d="M6.564.75l-3.59 3.612-1.538-1.55L0 4.26 2.974 7.25 8 2.193z"/>
            </svg>
          </div>

          <div v-else-if="saveState === 'error'" class="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L4 3.293l1.146-1.147a.5.5 0 1 1 .708.708L4.707 4l1.147 1.146a.5.5 0 0 1-.708.708L4 4.707l-1.146 1.147a.5.5 0 0 1-.708-.708L3.293 4 2.146 2.854z"/>
            </svg>
          </div>

          <div v-else class="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
            <svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="1"/>
            </svg>
          </div>
        </div>

        <!-- Status Text -->
        <div class="text-sm text-gray-600 dark:text-gray-300">
          <span v-if="saveState === 'saving'">正在保存...</span>
          <span v-else-if="saveState === 'success'">保存成功</span>
          <span v-else-if="saveState === 'error'">保存失败</span>
          <span v-else>有待保存的更改</span>
        </div>

        <!-- Save Button -->
        <button
          :class="saveButtonClass"
          :disabled="saveState === 'saving' || (!dirty && saveState === 'idle')"
          @click="$emit('save')"
        >
          {{ saveButtonText }}
        </button>
      </div>
    </div>
  </Transition>
</template>