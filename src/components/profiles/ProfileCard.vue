<script setup>
import { computed } from 'vue';

const props = defineProps({
  profile: {
    type: Object,
    required: true
  },
  isSorting: {
    type: Boolean,
    default: false,
  },
  compact: {
    type: Boolean,
    default: false,
  }
});

const emit = defineEmits(['delete', 'change', 'edit', 'open-copy', 'preview', 'move-up', 'move-down', 'view-logs', 'qrcode']);

import Switch from '../ui/Switch.vue';

const subscriptionCount = computed(() => Array.isArray(props.profile?.subscriptions) ? props.profile.subscriptions.length : 0);
const manualNodeCount = computed(() => Array.isArray(props.profile?.manualNodes) ? props.profile.manualNodes.length : 0);
const isEnabled = computed(() => props.profile?.enabled !== false);
const isPublic = computed(() => props.profile?.isPublic === true);

</script>

<template>
  <div
    class="group flex min-h-[180px] flex-col rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary-500/5 dark:border-white/10 dark:bg-gray-900/70"
    :class="[compact ? 'p-4' : 'p-5', { 'opacity-60 grayscale-[0.5]': !isEnabled }]"
  >
    <div class="flex items-start justify-between gap-3" :class="compact ? 'flex-col' : ''">
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
            订阅组
          </span>
          <span v-if="!isEnabled" class="rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
            已停用
          </span>
          <span v-else-if="isPublic" class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            已公开
          </span>
        </div>
        <p class="truncate text-lg font-semibold text-gray-900 dark:text-white" :title="profile.name">
          {{ profile.name }}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ subscriptionCount }} 个订阅，{{ manualNodeCount }} 个节点
        </p>
      </div>

      <div class="shrink-0 flex items-center gap-1 opacity-100 transition-opacity duration-200" :class="compact ? 'self-end flex-wrap justify-end' : ''">

		<button @click.stop="emit('preview')" class="p-2.5 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 flex items-center justify-center" title="预览节点">
			<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
		</button>
		<button @click.stop="emit('qrcode')" class="p-2.5 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 flex items-center justify-center" title="显示二维码">
			<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
				<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
			</svg>
		</button>
		<button @click.stop="emit('edit')" class="p-2.5 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 flex items-center justify-center" title="编辑">
			<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
		</button>
		<button @click.stop="emit('delete')" class="p-2.5 rounded-full hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-colors min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 flex items-center justify-center" title="删除">
			<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
		</button>
	  </div>
    </div>

    <div class="mt-4 grid gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-sm dark:border-white/10 dark:bg-white/5">
      <div class="flex items-center justify-between gap-3 text-gray-600 dark:text-gray-300">
        <span>启用状态</span>
        <Switch 
          :model-value="isEnabled"
          @update:model-value="(val) => $emit('change', { ...profile, enabled: val })"
          label="启用"
        />
      </div>
      <div class="flex items-center justify-between gap-3 text-gray-600 dark:text-gray-300">
        <span>公开访问</span>
        <Switch 
          :model-value="isPublic"
          @update:model-value="(val) => $emit('change', { ...profile, isPublic: val })"
          label="公开"
        />
      </div>
      <div class="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>被订阅 {{ profile.downloadCount || 0 }} 次</span>
        <button @click.stop="emit('view-logs')" class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-white hover:text-gray-800 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white" title="查看日志">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          日志
        </button>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-white/10" :class="compact ? 'items-stretch' : ''">
      <div class="flex items-center gap-2 sm:gap-4">
        <button @click="emit('open-copy')" class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-800/60" :class="compact ? 'w-full justify-center' : ''">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
           复制订阅
         </button>
       </div>
      <div class="flex items-center gap-1 transition-opacity duration-200">
        <template v-if="isSorting">
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
        </template>
      </div>
    </div>
  </div>
</template>
