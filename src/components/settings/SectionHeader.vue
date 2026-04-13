<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  tone: {
    type: String,
    default: 'indigo',
  },
});

const toneClassMap = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  green: 'bg-green-500/10 text-green-600 dark:text-green-300',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-300',
  red: 'bg-red-500/10 text-red-600 dark:text-red-300',
};
</script>

<template>
  <div class="mb-5 flex items-start gap-3">
    <div class="flex h-10 w-10 items-center justify-center rounded-xl" :class="toneClassMap[tone] || toneClassMap.indigo">
      <slot name="icon" />
    </div>
    <div class="space-y-1">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
      <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
    </div>
  </div>
</template>
