<script setup>
import SkeletonCard from './SkeletonCard.vue';
</script>

<template>
  <div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div v-for="i in 3" :key="i" class="bg-white/90 dark:bg-gray-900/80 p-5 rounded-xl animate-pulse">
        <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
        <div class="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-md mt-2"></div>
      </div>
    </div>

    <div class="flex justify-between items-center mt-8 mb-4 border-b border-gray-200 dark:border-white/10 pb-4">
        <div class="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <SkeletonCard v-for="i in 6" :key="i" />
    </div>
  </div>
</template>