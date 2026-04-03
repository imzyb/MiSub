<script setup>
import Modal from '../forms/Modal.vue';
import { computed, ref, watch } from 'vue';
import VpsMonitorCard from '../settings/sections/ServiceSettings/VpsMonitorCard.vue';
import VpsNetworkTargets from '../vps/VpsNetworkTargets.vue';
import { fetchVpsGlobalNetworkTargets } from '../../lib/api.js';
import { useToastStore } from '../../stores/toast.js';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  settings: {
    type: Object,
    required: true
  },
  saving: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:show', 'save']);
const { showToast } = useToastStore();

const globalTargets = ref([]);
const isLoadingTargets = ref(false);
const targetsError = ref('');

const canEditTargets = computed(() => props.settings?.vpsMonitor?.enabled !== false);

const loadGlobalTargets = async () => {
  if (!props.show) return;
  isLoadingTargets.value = true;
  targetsError.value = '';
  const result = await fetchVpsGlobalNetworkTargets();
  if (result.success) {
    globalTargets.value = result.data?.data || [];
  } else {
    globalTargets.value = [];
    targetsError.value = result.error || '加载全局监测目标失败';
    showToast(targetsError.value, 'error');
  }
  isLoadingTargets.value = false;
};

watch(() => props.show, (val) => {
  if (val) loadGlobalTargets();
});

const handleClose = () => {
  emit('update:show', false);
};

const handleSave = () => {
  emit('save');
};
</script>

<template>
  <Modal :show="show" @update:show="handleClose" @confirm="handleSave" confirm-text="保存" cancel-text="关闭" size="4xl" :confirm-disabled="saving">
    <template #title>
      <div class="flex items-center gap-2">
        <span class="text-lg font-bold text-gray-900 dark:text-white">VPS 探针设置</span>
      </div>
    </template>
    <template #body>
      <div class="space-y-6">
        <VpsMonitorCard :settings="settings" />

        <div class="bg-white/80 dark:bg-gray-900/60 border border-gray-100/80 dark:border-white/10 misub-radius-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">全局网络监测目标</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400">适用于勾选“应用全局监测目标”的节点</p>
            </div>
            <span class="text-xs text-gray-400" v-if="isLoadingTargets">加载中...</span>
          </div>
          <div class="mt-4">
            <div v-if="targetsError" aria-live="assertive" class="mb-3 flex items-center justify-between gap-3 rounded-lg border border-rose-200/70 bg-rose-50/80 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <span>{{ targetsError }}</span>
              <button type="button" class="rounded-md border border-rose-300/70 px-2 py-1 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:hover:bg-rose-500/10" @click="loadGlobalTargets">重试</button>
            </div>
            <VpsNetworkTargets
              v-if="canEditTargets"
              node-id="global"
              :targets="globalTargets"
              :allow-check="false"
              :limit="settings?.vpsMonitor?.networkTargetsLimit || 3"
              @refresh="loadGlobalTargets"
            />
            <div v-else class="rounded-lg border border-dashed border-amber-300/70 bg-amber-50/70 px-4 py-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              当前已禁用 VPS 探针。请先开启探针功能，再管理全局网络监测目标。
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>
