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

const handleConfirm = async () => {
    if (!settingsPanelRef.value) return;

    const didSave = await settingsPanelRef.value.handleSave();
    if (didSave) {
      emit('update:show', false);
    }
};
</script>

<template>
  <Modal 
    :show="show" 
    @update:show="emit('update:show', $event)" 
    @confirm="handleConfirm"
    :close-on-confirm="false"
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
