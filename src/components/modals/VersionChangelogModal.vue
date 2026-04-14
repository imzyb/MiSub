<script setup>
import { computed } from 'vue';
import { useVersionStore } from '../../stores/version';
import Modal from '../forms/Modal.vue';

const versionStore = useVersionStore();

const props = defineProps({
  show: Boolean,
  release: {
    type: Object,
    default: () => ({ tag_name: '', name: '', body: '', html_url: '' })
  },
  currentVersion: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:show', 'confirm', 'suppress']);

const isLatest = computed(() => {
  if (!props.release?.tag_name) return true;
  return props.currentVersion === props.release.tag_name || 
         props.currentVersion === props.release.tag_name.replace(/^v/, '');
});
</script>

<template>
  <Modal
    :show="show"
    @update:show="emit('update:show', $event)"
    size="lg"
    :close-on-confirm="false"
  >
    <template #title>
      <div class="flex items-center gap-3">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">系统更新日志</h3>
        <span 
          v-if="isLatest" 
          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
        >
          最新版本
        </span>
        <span 
          v-else 
          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 animate-pulse"
        >
          有新版本
        </span>
      </div>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        <template v-if="isLatest">
          当前版本 v{{ currentVersion }} 已是最新版本。
        </template>
        <template v-else>
          检测到上游新版本 {{ release.tag_name }}，当前版本为 v{{ currentVersion }}。建议及时更新。
        </template>
      </p>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="rounded-lg border border-indigo-200/70 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
          <div class="font-semibold">{{ isLatest ? 'v' + currentVersion + ' 版本更新亮点' : (release.name || release.tag_name || '版本说明') }}</div>
          <div v-if="!isLatest && release.published_at" class="mt-1 text-xs opacity-80">发布时间：{{ new Date(release.published_at).toLocaleString() }}</div>
        </div>

        <div class="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/70 p-4 text-sm leading-6 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 whitespace-pre-wrap">
          <template v-if="isLatest && versionStore.localChangelog">
            {{ versionStore.localChangelog }}
          </template>
          <template v-else-if="release.body">
            {{ release.body }}
          </template>
          <template v-else>
            当前版本未提供详细更新说明。
          </template>
        </div>

        <a
          v-if="release.html_url"
          :href="release.html_url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          查看上游发布页
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <button
          @click="emit('suppress')"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          不再显示
        </button>
        <button
          @click="emit('confirm')"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          确认
        </button>
      </div>
    </template>
  </Modal>
</template>
