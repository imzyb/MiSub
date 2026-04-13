<script setup>
import { ref } from 'vue';
import Modal from '../forms/Modal.vue';
import GroupSelector from '../ui/GroupSelector.vue'; // Added
import { useManualNodes } from '../../composables/useManualNodes.js';
import { useDataStore } from '../../stores/useDataStore.js';

const { manualNodeGroups } = useManualNodes(useDataStore().markDirty);

const props = defineProps({
  show: Boolean,
});

const emit = defineEmits(['update:show', 'import']);

const importText = ref('');
const selectedGroup = ref('');
const urlFocused = ref(false);

const handleConfirm = () => {
    emit('import', importText.value, selectedGroup.value); // group passed as second arg
    importText.value = '';
    selectedGroup.value = '';
    setTimeout(() => {
        emit('update:show', false);
    }, 1000);
};
</script>

<template>
  <Modal :show="show" @update:show="emit('update:show', $event)" @confirm="handleConfirm" size="2xl">
    <template #title>
      <div class="flex items-center gap-3">
        <div class="p-2 misub-radius-lg bg-indigo-500/10">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-bold text-gray-800 dark:text-white">
            批量导入
          </h3>
          <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">支持一次导入订阅链接或分享节点，并可统一分配到指定分组。</p>
        </div>
      </div>
    </template>
    
    <template #body>
      <div class="space-y-6">
      
        <!-- Group Selector -->
        <div class="relative">
          <div class="flex flex-col gap-1.5">
            <label for="import-group" class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
              自动分配分组 (可选)
            </label>
            <GroupSelector
              v-model="selectedGroup"
              :groups="manualNodeGroups"
              placeholder="选择或输入分组..."
            />
          </div>
        </div>

        <div class="relative group">
          <div 
            class="relative border misub-radius-lg transition-all duration-300 overflow-hidden bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-white/10"
            :class="[
              urlFocused 
                ? 'ring-2 ring-primary-500/50 border-primary-500 dark:border-primary-500' 
                : 'hover:border-gray-300 dark:hover:border-white/20'
            ]"
          >
            <div class="flex h-full">
               <div class="py-3 pl-3 flex items-start text-gray-400 group-focus-within:text-primary-500 transition-colors pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <textarea 
                v-model="importText"
                rows="8"
                @focus="urlFocused = true"
                @blur="urlFocused = false"
                class="flex-1 w-full bg-transparent border-0 focus:ring-0 dark:text-white placeholder-gray-400 text-sm font-mono resize-none py-3 px-3 min-h-[160px]"
                placeholder="http://...&#10;https://...&#10;vmess://...&#10;vless://...&#10;trojan://..."
              ></textarea>
            </div>
            <!-- Focus Glow -->
            <div class="absolute inset-0 misub-radius-lg pointer-events-none transition-opacity duration-300 opacity-0 group-focus-within:opacity-100 ring-1 ring-primary-500/20"></div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">每行一个链接。系统会自动识别协议类型，并尽量提取节点名称。</p>
        </div>
      </div>
    </template>
  </Modal>
</template>
