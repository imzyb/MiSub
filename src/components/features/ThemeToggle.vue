<script setup>
import { storeToRefs } from 'pinia';
import { useThemeStore } from '../../stores/theme.js';

const store = useThemeStore();
const { theme } = storeToRefs(store);
const { toggleTheme } = store;
</script>

<template>
<button
@click="toggleTheme"
class="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
:aria-label="theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'"
:aria-pressed="theme === 'dark'"
>
<div v-if="theme === 'dark'" key="dark-icon" class="transition-opacity duration-300">
<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
</svg>
</div>
<div v-else key="light-icon" class="transition-opacity duration-300">
<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
<path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
</svg>
</div>
</button>
</template>
