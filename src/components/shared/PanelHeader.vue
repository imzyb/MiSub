<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 0
  }
});
</script>

<template>
  <div class="flex flex-row items-center justify-between mb-4 gap-4">
    <div class="flex items-center gap-3 shrink-0">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ props.title }}</h2>
      <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ props.count }}</span>
    </div>
    <div class="flex items-center gap-2 sm:w-auto justify-end sm:justify-start">
      <slot name="actions" />
    </div>
  </div>
</template>
