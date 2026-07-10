<script setup>
import { computed } from 'vue';
import { useI18n } from '@/i18n/index.js';

const { t } = useI18n();

const props = defineProps({
  stats: {
    type: Object,
    required: true,
    default: () => ({ totalSubscriptions: 0, enabledSubscriptions: 0, totalNodes: 0 })
  }
});

const statsData = computed(() => [
  { name: t('dashboard.totalSubscriptions'), value: props.stats.totalSubscriptions, color: 'text-gray-900 dark:text-white' },
  { name: t('dashboard.enabled'), value: props.stats.enabledSubscriptions, color: 'text-green-600 dark:text-green-400' },
  { name: t('dashboard.totalNodes'), value: props.stats.totalNodes, color: 'text-blue-600 dark:text-blue-400' }
]);
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div v-for="stat in statsData" :key="stat.name"
         class="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md p-5 misub-radius-lg shadow-lg dark:shadow-2xl">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ stat.name }}</p>
      <p class="mt-1 text-3xl font-semibold" :class="stat.color">{{ stat.value }}</p>
    </div>
  </div>
</template>