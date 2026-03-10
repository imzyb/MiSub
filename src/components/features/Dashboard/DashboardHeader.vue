<script setup>
defineProps({
  formattedTotalRemainingTraffic: {
    type: String,
    default: '0 B'
  }
});

defineEmits(['openLog', 'openBulkImport']);
</script>

<template>
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 glass-panel p-6 misub-radius-lg border border-white/20 dark:border-white/5 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl">
    <div class="flex flex-wrap items-center gap-4">
      <h1 class="text-3xl font-display font-bold text-gray-900 dark:text-white tracking-tight">仪表盘</h1>
      <span v-if="formattedTotalRemainingTraffic !== '0 B'"
        class="px-4 py-1.5 text-sm font-semibold text-green-700 bg-green-100/80 dark:text-green-300 dark:bg-green-500/20 rounded-full border border-green-200 dark:border-green-500/30 backdrop-blur-sm">
        剩余总流量: {{ formattedTotalRemainingTraffic }}
      </span>
    </div>
    <div class="flex items-center gap-3 w-full md:w-auto">
      <button @click="$emit('openLog')"
        class="flex-1 md:flex-none px-5 py-2.5 misub-radius-lg text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 transition-all shadow-sm hover:shadow-md">
        订阅日志
      </button>
      <button @click="$emit('openBulkImport')"
        class="flex-1 md:flex-none px-5 py-2.5 misub-radius-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all transform hover:-translate-y-0.5">
        批量导入
      </button>
    </div>
    <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 md:mt-0 md:ml-auto">提示：常用操作在此，更多管理请前往对应模块。</p>
  </div>
</template>
