<script setup>
import Modal from '../forms/Modal.vue';

defineProps({
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
</script>

<template>
  <Modal
    :show="show"
    @update:show="emit('update:show', $event)"
    size="3xl"
    :close-on-confirm="false"
  >
    <template #title>
      <div>
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">当前版本更新内容</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          当前版本 `{{ currentVersion }}` 已与上游最新版本同步，以下为本次版本更新内容。
        </p>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="rounded-lg border border-indigo-200/70 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
          <div class="font-semibold">{{ release.name || release.tag_name }}</div>
          <div v-if="release.published_at" class="mt-1 text-xs opacity-80">发布时间：{{ new Date(release.published_at).toLocaleString() }}</div>
        </div>

        <div class="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/70 p-4 text-sm leading-6 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 whitespace-pre-wrap">
          {{ release.body || '当前版本未提供详细更新说明。' }}
        </div>

        <a
          v-if="release.html_url"
          :href="release.html_url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          查看上游发布页
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
