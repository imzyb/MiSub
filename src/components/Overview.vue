<script setup>
import { computed } from 'vue';

const props = defineProps({
  stats: {
    type: Object,
    required: true,
    default: () => ({ totalSubscriptions: 0, enabledSubscriptions: 0, totalNodes: 0 })
  }
});

const statsData = computed(() => [
  { name: '总订阅数', value: props.stats.totalSubscriptions, color: 'text-gray-900 dark:text-white' },
  { name: '已启用', value: props.stats.enabledSubscriptions, color: 'text-green-600 dark:text-green-400' },
  { name: '总节点数', value: props.stats.totalNodes, color: 'text-blue-600 dark:text-blue-400' }
]);
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div v-for="stat in statsData" :key="stat.name"
         class="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md p-5 rounded-2xl shadow-lg dark:shadow-2xl">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ stat.name }}</p>
      <p class="mt-1 text-3xl font-semibold" :class="stat.color">{{ stat.value }}</p>
    </div>
  </div>
</template>