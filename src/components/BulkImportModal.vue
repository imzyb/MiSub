<script setup>
import { ref } from 'vue';
import Modal from './Modal.vue';

const props = defineProps({
  show: Boolean,
});

const emit = defineEmits(['update:show', 'import']);

const importText = ref('');

const handleConfirm = () => {
    emit('import', importText.value);
    emit('update:show', false);
    importText.value = '';
};
</script>

<template>
  <Modal :show="show" @update:show="emit('update:show', $event)" @confirm="handleConfirm">
    <template #title><h3 class="text-lg font-bold text-gray-900 dark:text-white">批量导入</h3></template>
    <template #body>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">每行一个订阅链接或分享节点。将自动识别节点名称。</p>
      <textarea 
        v-model="importText"
        rows="8"
        class="w-full text-sm border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono dark:text-white"
        placeholder="http://...&#10;https://...&#10;vmess://...&#10;vless://...&#10;trojan://..."
      ></textarea>
    </template>
  </Modal>
</template>