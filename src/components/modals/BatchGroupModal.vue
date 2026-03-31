<script setup>
import { ref, watch } from 'vue';
import Modal from '../forms/Modal.vue';
import GroupSelector from '../ui/GroupSelector.vue'; // New import

const props = defineProps({
  show: Boolean,
  groups: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:show', 'confirm']);

const groupName = ref('');

// Reset input when modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    groupName.value = '';
  }
});

const handleConfirm = () => {
  emit('confirm', groupName.value);
  emit('update:show', false);
};
</script>

<template>
  <Modal
    :show="show"
    size="lg"
    @update:show="emit('update:show', $event)"
    @confirm="handleConfirm"
  >
    <template #title>
      <div class="flex items-center gap-3">
        <div class="p-2 misub-radius-lg bg-indigo-500/10">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-gray-800 dark:text-white">
          批量移动分组
        </h3>
      </div>
    </template>
    
    <template #body>
      <div class="space-y-4 py-2">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          请输入要移动到的分组名称。留空将移动到"未分组"。
        </p>
        
        <div class="relative">
          <div class="flex flex-col">
            <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
              分组名称
            </label>
            <GroupSelector
              v-model="groupName"
              :groups="groups"
              placeholder="选择或输入新分组..."
            />
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>
