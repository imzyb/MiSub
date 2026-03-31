/**
 * 节点预览头部组件
 * @author MiSub Team
 */

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  totalNodes: {
    type: Number,
    default: 0
  },
  filteredNodes: {
    type: Number,
    default: 0
  }
});

defineEmits(['close']);
</script>

<template>
  <!-- 头部 -->
  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
    <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">
      {{ title }}
    </h3>

    <!-- 节点统计 -->
    <div class="flex items-center space-x-4">
      <div class="text-sm text-gray-500 dark:text-gray-400">
        <span v-if="filteredNodes === totalNodes">
          共 {{ totalNodes }} 个节点
        </span>
        <span v-else>
          {{ filteredNodes }} / {{ totalNodes }} 个节点
        </span>
      </div>

      <!-- 关闭按钮 -->
      <button
        @click="$emit('close')"
        class="misub-radius-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-2"
      >
        <span class="sr-only">关闭</span>
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  </div>
</template>