<script setup>
import { ref, watch } from 'vue';
import Modal from '../forms/Modal.vue';
import SettingsPanel from './SettingsPanel.vue';

const props = defineProps({
  show: Boolean,
  exportBackup: Function,
  importBackup: Function,
});

const emit = defineEmits(['update:show']);

const settingsPanelRef = ref(null);

const handleConfirm = () => {
    if (settingsPanelRef.value) {
        settingsPanelRef.value.handleSave();
    }
    // Note: Modal automatically emits update:show false, causing close.
    // Since handleSave triggers a reload after success, this behavior is acceptable.
    // If we wanted to keep it open during save, we would need to modify Modal.vue to prevent close.
};
</script>

<template>
  <Modal 
    :show="show" 
    @update:show="emit('update:show', $event)" 
    @confirm="handleConfirm"
    size="6xl"
  >
    <template #title>
      <div class="bg-white/80 dark:bg-gray-900/60 border border-gray-100/80 dark:border-white/10 misub-radius-lg px-4 py-2">
        <h3 class="text-lg font-bold text-gray-800 dark:text-white">设置</h3>
      </div>
    </template>
    <template #body>
       <SettingsPanel ref="settingsPanelRef" :export-backup="props.exportBackup" :import-backup="props.importBackup" />
    </template>
  </Modal>
</template>
