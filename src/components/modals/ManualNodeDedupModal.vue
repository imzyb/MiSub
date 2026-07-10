<script setup>
import { computed } from 'vue';
import Modal from '../forms/Modal.vue';
import { useI18n } from '@/i18n/index.js';

const props = defineProps({
  show: Boolean,
  plan: Object
});

const emit = defineEmits(['update:show', 'confirm']);
const { t } = useI18n();

const previewList = computed(() => {
  const list = props.plan?.removeNodes || [];
  return list.slice(0, 20);
});
</script>

<template>
  <Modal
    :show="show"
    size="2xl"
    @update:show="emit('update:show', $event)"
    @confirm="emit('confirm')"
  >
    <template #title>
      <h3 class="text-lg font-bold text-gray-800 dark:text-white">{{ t('manualNodes.dedupConfirmTitle') }}</h3>
    </template>
    <template #body>
      <div class="space-y-4">
        <div class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('manualNodes.dedupWillRemovePrefix') }} <span class="font-semibold text-red-600 dark:text-red-400">{{ plan?.removeCount || 0 }}</span> {{ t('manualNodes.dedupWillRemoveMiddle') }}
          {{ t('manualNodes.dedupWillRemoveSuffix') }} <span class="font-semibold text-emerald-600 dark:text-emerald-400">{{ plan?.keepCount || 0 }}</span> {{ t('manualNodes.dedupKeptSuffix') }}
        </div>
        <div v-if="previewList.length > 0" class="border border-gray-200 dark:border-gray-700 misub-radius-md">
          <div class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            {{ t('manualNodes.dedupPreviewTitle') }}
          </div>
          <div class="max-h-64 overflow-auto divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="node in previewList" :key="node.id" class="px-3 py-2 text-sm">
              <div class="text-gray-800 dark:text-gray-100 truncate">{{ node.name || t('manualNodes.unnamedNode') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">{{ node.url }}</div>
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('manualNodes.noDuplicatesFound') }}</div>
      </div>
    </template>
  </Modal>
</template>
