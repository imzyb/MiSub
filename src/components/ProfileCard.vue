<script setup>
import { computed } from 'vue';

const props = defineProps({
  profile: {
    type: Object,
    required: true
  },
});

const emit = defineEmits(['delete', 'change', 'edit', 'copy-link']);

</script>

<template>
  <div
    class="group bg-white/90 dark:bg-gray-900/80 rounded-2xl card-shadow hover:card-shadow-hover p-4 smooth-all hover:-translate-y-1 flex flex-col justify-between"
    style="z-index: 1;"
    :class="{ 'opacity-50': !profile.enabled }"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="w-full truncate">
        <p class="font-bold text-lg text-gray-800 dark:text-gray-100 truncate" :title="profile.name">
          {{ profile.name }}
        </p>
         <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          包含 {{ profile.subscriptions.length }} 个订阅，{{ profile.manualNodes.length }} 个节点
        </p>
      </div>

               <div class="shrink-0 flex items-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button @click="emit('edit')" class="p-1.5 rounded-full hover:bg-gray-500/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="编辑">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
          </button>
          <button @click="emit('delete')" class="p-1.5 rounded-full hover:bg-red-500/10 text-gray-400 hover:text-red-500" title="删除">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
      </div>
    </div>

    <div class="flex justify-between items-center mt-3">
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" :checked="profile.enabled" @change="$emit('change', { ...profile, enabled: $event.target.checked })" class="sr-only peer">
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-indigo-600 dark:peer-checked:bg-green-600"></div>
        <span class="ml-3 text-sm font-medium text-gray-600 dark:text-gray-300">{{ profile.enabled ? '已启用' : '已禁用' }}</span>
      </label>

      <button @click="emit('copy-link')" class="text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs flex items-center gap-2">
         <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        复制
      </button>
    </div>
  </div>
</template>
