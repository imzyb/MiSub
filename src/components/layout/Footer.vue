<script setup>
import { computed } from 'vue';
import { useVersionStore } from '../../stores/version';
import packageJson from '../../../package.json';

const versionStore = useVersionStore();
const currentYear = computed(() => new Date().getFullYear());
const currentVersion = packageJson.version;
</script>

<template>
<footer class="w-full text-center p-8 border-t border-gray-200 dark:border-white/10 mt-8">
<p class="text-xs text-gray-500 dark:text-gray-400">
Copyright © {{ currentYear }}
<a
href="https://github.com/imzyb/MiSub"
target="_blank"
rel="noopener noreferrer"
class="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
>
MiSUB
</a>.
All Rights Reserved.
</p>
<button 
  @click="versionStore.openModal"
  class="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-mono hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer"
>
v{{ currentVersion }}
</button>
</footer>
</template>