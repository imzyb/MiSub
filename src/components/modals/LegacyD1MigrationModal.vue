<script setup>
import { ref, computed } from 'vue';
import Modal from '../forms/Modal.vue';
import { migrateLegacyD1 } from '../../lib/api.js';
import { useToastStore } from '../../stores/toast.js';

const props = defineProps({
  show: Boolean,
  details: {
    type: Object,
    default: () => ({ hasLegacySubscriptions: false, hasLegacyProfiles: false })
  }
});

const emit = defineEmits(['update:show', 'success']);
const { showToast } = useToastStore();

const isMigrating = ref(false);
const logs = ref([]);
const step = ref('check');

const addLog = (message, type = 'info') => {
  logs.value.unshift({ time: new Date().toLocaleTimeString(), message, type });
};

const confirmText = computed(() => {
  if (step.value === 'check') return '开始升级';
  if (step.value === 'migrating') return '升级中...';
  return '完成';
});

const handleClose = () => {
  emit('update:show', false);
  setTimeout(() => {
    step.value = 'check';
    logs.value = [];
    isMigrating.value = false;
  }, 300);
};

const handleConfirm = async () => {
  if (step.value === 'done' || step.value === 'error') {
    handleClose();
    return;
  }

  step.value = 'migrating';
  isMigrating.value = true;
  logs.value = [];
  addLog('检测到旧版 D1 main 行结构，开始升级为行级存储...');

  try {
    const result = await migrateLegacyD1();
    if (!result.success) {
      throw new Error(result.error || result.message || '迁移失败');
    }

    addLog(`✅ 订阅数据已迁移 ${result.details?.subscriptions || 0} 条`, 'success');
    addLog(`✅ 订阅组数据已迁移 ${result.details?.profiles || 0} 条`, 'success');
    addLog('🎉 旧 D1 结构升级完成，后续将使用行级存储读取。', 'success');
    step.value = 'done';
    showToast('旧 D1 结构已成功升级', 'success');
    emit('success');
  } catch (error) {
    step.value = 'error';
    addLog(`❌ 升级失败: ${error.message}`, 'error');
    showToast(`旧 D1 结构升级失败: ${error.message}`, 'error');
  } finally {
    isMigrating.value = false;
  }
};

const getLogClass = (type) => {
  if (type === 'success') return 'text-green-400';
  if (type === 'error') return 'text-red-400';
  return 'text-gray-300';
};
</script>

<template>
  <Modal
    :show="show"
    @update:show="handleClose"
    @confirm="handleConfirm"
    size="2xl"
    :confirm-disabled="isMigrating"
    :confirm-text="confirmText"
    cancel-text="关闭"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <span class="text-lg font-bold text-gray-900 dark:text-white">检测到旧 D1 数据结构</span>
      </div>
    </template>

    <template #body>
      <div class="h-[360px] flex flex-col">
        <div v-if="step === 'check'" class="flex-1 space-y-4">
          <div class="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            当前检测到旧版 D1 主行数据结构。为了避免读取遗漏并提升后续性能，建议立即升级为新的行级存储结构。
          </div>
          <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li v-if="details.hasLegacySubscriptions">• 检测到旧版订阅主行数据</li>
            <li v-if="details.hasLegacyProfiles">• 检测到旧版订阅组主行数据</li>
            <li>• 升级后不会改变你现有的数据内容，只会调整存储结构</li>
          </ul>
        </div>

        <div v-else class="flex-1 flex flex-col min-h-0">
          <div class="flex-1 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 p-4 font-mono text-xs shadow-inner">
            <div v-for="(log, idx) in logs" :key="idx" class="mb-1.5 break-all">
              <span class="mr-2 text-gray-500 opacity-50">[{{ log.time }}]</span>
              <span :class="getLogClass(log.type)">{{ log.message }}</span>
            </div>
          </div>
          <div v-if="step === 'done'" class="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
            升级完成，建议刷新后台以重新加载最新数据。
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>
