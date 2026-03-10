<script setup>
import SkeletonCard from '../ui/SkeletonCard.vue';
</script>

<template>
  <div>
    <!-- Header Skeleton -->
    <div class="flex justify-between items-center mb-8">
      <div class="h-8 w-32 bg-gray-200 dark:bg-gray-700 misub-radius-md animate-pulse"></div>
      <div class="h-9 w-24 bg-gray-200 dark:bg-gray-700 misub-radius-md animate-pulse"></div>
    </div>

    <!-- Main Grid Skeleton -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-start">
      <div class="lg:col-span-2 md:col-span-2 space-y-12">
        <!-- Subscription Panel Skeleton -->
        <div class="space-y-4">
             <div class="h-6 w-24 bg-gray-200 dark:bg-gray-700 misub-radius-md animate-pulse mb-4"></div>
             <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SkeletonCard v-for="i in 4" :key="`sub-${i}`" />
             </div>
        </div>

        <!-- Manual Node Panel Skeleton -->
        <div class="space-y-4">
             <div class="h-6 w-24 bg-gray-200 dark:bg-gray-700 misub-radius-md animate-pulse mb-4"></div>
             <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <SkeletonCard v-for="i in 6" :key="`node-${i}`" />
             </div>
        </div>
      </div>
      
      <!-- Right Column Skeleton -->
      <div class="lg:col-span-1 space-y-8">
        <!-- RightPanel/Profile Stats Skeleton -->
        <div class="bg-white dark:bg-gray-800 misub-radius-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
            <div class="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 misub-radius-md mb-4"></div>
            <div class="space-y-3">
                <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 misub-radius-md"></div>
                <div class="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 misub-radius-md"></div>
            </div>
        </div>

        <!-- Profile Panel Skeleton -->
        <div class="space-y-4">
             <div class="h-6 w-24 bg-gray-200 dark:bg-gray-700 misub-radius-md animate-pulse mb-4"></div>
             <div class="space-y-3">
                <div v-for="i in 2" :key="`prof-${i}`" class="h-16 w-full bg-gray-200 dark:bg-gray-700 misub-radius-lg animate-pulse"></div>
             </div>
        </div>
      </div>
    </div>
  </div>
</template>