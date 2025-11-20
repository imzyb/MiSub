<script setup>
defineProps({
  type: {
    type: String,
    default: 'card', // card, list, dashboard
    validator: (value) => ['card', 'list', 'dashboard'].includes(value)
  },
  count: {
    type: Number,
    default: 1
  }
});
</script>

<template>
  <div>
    <!-- 卡片骨架屏 -->
    <template v-if="type === 'card'">
      <div
        v-for="i in count"
        :key="i"
        class="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl p-6 card-shadow animate-pulse"
        :style="{ '--delay-index': i - 1 }"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <div class="h-4 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-lg w-3/4 mb-2 skeleton-shimmer"></div>
            <div class="h-3 bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded w-1/2 skeleton-shimmer"></div>
          </div>
          <div class="w-12 h-6 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-full skeleton-shimmer"></div>
        </div>
        <div class="space-y-3">
          <div class="h-3 bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded w-full skeleton-shimmer"></div>
          <div class="h-3 bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded w-2/3 skeleton-shimmer"></div>
        </div>
      </div>
    </template>

    <!-- 列表骨架屏 -->
    <template v-if="type === 'list'">
      <div
        v-for="i in count"
        :key="i"
        class="flex items-center p-4 bg-white/90 dark:bg-gray-900/80 backdrop-blur-md rounded-xl card-shadow animate-pulse mb-3"
        :style="{ '--delay-index': i - 1 }"
      >
        <div class="w-10 h-10 bg-gradient-to-br from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-full skeleton-shimmer mr-4"></div>
        <div class="flex-1">
          <div class="h-4 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded w-1/3 mb-2 skeleton-shimmer"></div>
          <div class="h-3 bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded w-1/2 skeleton-shimmer"></div>
        </div>
        <div class="w-16 h-8 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded skeleton-shimmer"></div>
      </div>
    </template>

    <!-- 仪表盘骨架屏 -->
    <template v-if="type === 'dashboard'">
      <div class="space-y-8">
        <!-- 标题区域 -->
        <div class="flex justify-between items-center">
          <div class="h-8 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-lg w-48 skeleton-shimmer"></div>
          <div class="flex gap-3">
            <div class="h-10 w-24 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-lg skeleton-shimmer"></div>
            <div class="h-10 w-20 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-lg skeleton-shimmer"></div>
          </div>
        </div>

        <!-- 统计卡片 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            v-for="i in 3"
            :key="i"
            class="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl p-6 card-shadow animate-pulse"
          >
            <div class="h-12 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-lg w-full mb-4 skeleton-shimmer"></div>
            <div class="h-6 bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded w-3/4 skeleton-shimmer"></div>
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="space-y-4">
          <div
            v-for="i in 4"
            :key="i"
            class="h-20 bg-white/90 dark:bg-gray-900/80 backdrop-blur-md rounded-xl card-shadow animate-pulse skeleton-shimmer"
          ></div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 骨架屏动画 */
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}

.skeleton-shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  animation: shimmer 2s infinite;
}

.dark .skeleton-shimmer::after {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* 交错动画 */
.animate-pulse {
  animation-delay: calc(var(--delay-index) * 100ms);
}
</style>