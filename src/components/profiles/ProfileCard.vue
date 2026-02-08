<script setup>
import { computed } from 'vue';

const props = defineProps({
  profile: {
    type: Object,
    required: true
  },
});

const emit = defineEmits(['delete', 'change', 'edit', 'copy-link', 'copy-clash-link', 'preview', 'move-up', 'move-down', 'view-logs', 'qrcode']);

import Switch from '../ui/Switch.vue';

</script>

<template>
  <div
    class="group glass-panel p-5 card-hover flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/10 min-h-[160px]"
    :class="{ 'opacity-60 grayscale-[0.5]': !profile.enabled }"
  >
    <div class="flex items-center justify-between gap-2">
      <p class="font-bold text-lg text-gray-800 dark:text-gray-100 truncate" :title="profile.name">
        {{ profile.name }}
      </p>

      <div class="shrink-0 flex items-center gap-1 xl:opacity-0 group-hover:opacity-100 transition-opacity duration-200">

        <button @click.stop="emit('preview')" class="p-2 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors" title="预览节点">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        </button>
        <button @click.stop="emit('qrcode')" class="p-2 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors" title="显示二维码">
           <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
             <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
             <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
           </svg>
        </button>
        <button @click.stop="emit('edit')" class="p-2 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors" title="编辑">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
        </button>
        <button @click.stop="emit('delete')" class="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-colors" title="删除">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
    
    <!-- 单独一行显示包含信息 -->
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
      包含 {{ profile.subscriptions.length }} 个订阅,{{ profile.manualNodes.length }} 个节点
    </p>

    <div class="flex justify-between items-center mt-3">
      <div class="flex items-center gap-4">
        <!-- 启用开关 -->
        <Switch 
          :model-value="profile.enabled"
          @update:model-value="(val) => $emit('change', { ...profile, enabled: val })"
          label="启用"
        />

        <!-- 公开开关 -->
        <Switch 
          :model-value="profile.isPublic"
          @update:model-value="(val) => $emit('change', { ...profile, isPublic: val })"
          label="公开"
        />
      </div>

      <div class="flex items-center gap-2">
        <!-- Clash 专用复制按钮 -->
        <button @click="emit('copy-clash-link')" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-300 transition-colors shadow-xs flex items-center gap-1" title="复制 Clash 专用链接（支持链式代理）">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
           Clash
        </button>
        <button @click="emit('copy-link')" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 transition-colors shadow-xs flex items-center gap-1">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
           复制
        </button>
      </div>
    </div>

    <!-- 下载统计 -->
    <div class="mt-2 flex items-center justify-between gap-2">
      <div class="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span class="break-words flex-1">被订阅 {{ profile.downloadCount || 0 }} 次</span>
      </div>
      
      <div class="flex items-center gap-1 xl:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button @click.stop="emit('view-logs')" class="p-1 rounded-full hover:bg-gray-500/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mr-1" title="查看日志">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
        <button @click="emit('move-up')" class="p-1 rounded-full hover:bg-gray-500/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="上移">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button @click="emit('move-down')" class="p-1 rounded-full hover:bg-gray-500/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="下移">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>

  </div>
</template>
