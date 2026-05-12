<script setup>
import { computed, ref, onMounted } from 'vue';

const props = defineProps({
  formattedTotalRemainingTraffic: {
    type: String,
    default: '0 B'
  },
  trafficStats: {
    type: Object,
    required: true
  },
  activeSubscriptionsCount: {
    type: Number,
    default: 0
  },
  subscriptionsCount: {
    type: Number,
    default: 0
  },
  totalNodesCount: {
    type: Number,
    default: 0
  },
  activeProfilesCount: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['navigate']);

const trafficDisplay = computed(() => {
  const parts = props.formattedTotalRemainingTraffic.split(' ');
  return {
    value: parts[0] || props.formattedTotalRemainingTraffic,
    unit: parts[1] || ''
  };
});

const trafficUsedPercentage = computed(() => Number(props.trafficStats?.percentage || 0));
const remainingTrafficPercentage = computed(() => Math.max(0, 100 - trafficUsedPercentage.value));
const hasTrafficWarning = computed(() => props.subscriptionsCount > 0 && remainingTrafficPercentage.value <= 20);
const hasSubscriptionWarning = computed(() => props.subscriptionsCount === 0 || props.activeSubscriptionsCount === 0);
const hasNodeWarning = computed(() => props.subscriptionsCount > 0 && props.totalNodesCount === 0);
const hasProfileWarning = computed(() => props.activeProfilesCount === 0);

const isVisible = ref(false);

onMounted(() => {
  setTimeout(() => {
    isVisible.value = true;
  }, 100);
});

const cardBaseClass = 'stat-card group w-full text-left bg-white/90 dark:bg-gray-900/70 p-4 misub-radius-lg shadow-sm border transition-all duration-500 hover:-translate-y-0.5 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-primary-500/30';
const normalCardClass = 'border-gray-100/80 dark:border-white/10';
const warningCardClass = 'border-amber-200/80 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-500/10';

const navigate = (path, query = {}) => {
  emit('navigate', path, query);
};
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <button
      type="button"
      data-testid="stat-card-traffic"
      :class="[cardBaseClass, hasTrafficWarning ? warningCardClass : normalCardClass, { 'stat-card-visible': isVisible }]"
      style="--delay: 0ms"
      @click="navigate('/dashboard/subscriptions', hasTrafficWarning ? { status: 'low-traffic' } : {})"
    >
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-medium text-gray-500 uppercase">剩余流量</h3>
        <span class="p-1.5 misub-radius-md" :class="hasTrafficWarning ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </span>
      </div>
      <p class="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight leading-none">
        {{ trafficDisplay.value }}
        <span class="ml-1 text-xs font-medium text-gray-500 dark:text-gray-400">{{ trafficDisplay.unit }}</span>
      </p>
      <div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div
          class="h-1.5 rounded-full transition-all duration-1000 ease-out"
          :class="hasTrafficWarning ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'"
          :style="{ width: isVisible ? remainingTrafficPercentage + '%' : '0%' }"
        ></div>
      </div>
      <p class="text-xs mt-1" :class="hasTrafficWarning ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'">
        {{ hasTrafficWarning ? '流量偏低' : `已用 ${trafficStats.used} / ${trafficStats.total}` }}
      </p>
    </button>

    <button
      type="button"
      data-testid="stat-card-subscriptions"
      :class="[cardBaseClass, hasSubscriptionWarning ? warningCardClass : normalCardClass, { 'stat-card-visible': isVisible }]"
      style="--delay: 100ms"
      @click="navigate('/dashboard/subscriptions', hasSubscriptionWarning ? { status: subscriptionsCount === 0 ? 'missing' : 'disabled' } : {})"
    >
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-medium text-gray-500 uppercase">活跃订阅</h3>
        <span class="p-1.5 misub-radius-md" :class="hasSubscriptionWarning ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        </span>
      </div>
      <p class="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight leading-none">
        {{ activeSubscriptionsCount }}
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">/ {{ subscriptionsCount }}</span>
      </p>
      <p class="text-xs mt-2 flex items-center gap-1" :class="hasSubscriptionWarning ? 'text-amber-700 dark:text-amber-300' : 'text-green-600 dark:text-green-400'">
        <span class="inline-block w-2 h-2 rounded-full" :class="hasSubscriptionWarning ? 'bg-amber-500' : 'bg-green-500 animate-ping-slow'"></span>
        <span>{{ hasSubscriptionWarning ? '需要启用订阅' : '正常运行' }}</span>
      </p>
    </button>

    <button
      type="button"
      data-testid="stat-card-nodes"
      :class="[cardBaseClass, hasNodeWarning ? warningCardClass : normalCardClass, { 'stat-card-visible': isVisible }]"
      style="--delay: 200ms"
      @click="navigate('/dashboard/subscriptions', hasNodeWarning ? { status: 'zero-nodes' } : {})"
    >
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-medium text-gray-500 uppercase">节点总数</h3>
        <span class="p-1.5 misub-radius-md" :class="hasNodeWarning ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
      </div>
      <p class="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight leading-none">{{ totalNodesCount }}</p>
      <p class="text-xs mt-2" :class="hasNodeWarning ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'">
        {{ hasNodeWarning ? '需要刷新节点' : `来自 ${subscriptionsCount} 个订阅源` }}
      </p>
    </button>

    <button
      type="button"
      data-testid="stat-card-profiles"
      :class="[cardBaseClass, hasProfileWarning ? warningCardClass : normalCardClass, { 'stat-card-visible': isVisible }]"
      style="--delay: 300ms"
      @click="navigate('/dashboard/subscriptions', hasProfileWarning ? { focus: 'profiles' } : {})"
    >
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-medium text-gray-500 uppercase">组合订阅</h3>
        <span class="p-1.5 misub-radius-md" :class="hasProfileWarning ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </span>
      </div>
      <p class="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight leading-none">{{ activeProfilesCount }}</p>
      <p class="text-xs mt-2" :class="hasProfileWarning ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'">
        {{ hasProfileWarning ? '需要创建组合' : `已发布 ${activeProfilesCount} 个组合` }}
      </p>
    </button>
  </div>
</template>

<style scoped>
.stat-card {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
  transition: opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
  transition-delay: var(--delay);
}

.stat-card-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

@keyframes ping-slow {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.5); }
  100% { opacity: 0; transform: scale(2); }
}

.animate-ping-slow {
  animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .stat-card {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .animate-ping-slow {
    animation: none;
  }
}
</style>
