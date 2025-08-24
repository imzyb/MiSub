<script setup>
import { ref, watch } from 'vue';
import draggable from 'vuedraggable';
import Modal from './Modal.vue';

const props = defineProps({
  show: Boolean,
  items: Array, // [{id, name, type}] type in {'sub','node'}
  defaultItems: Array,
});
const emit = defineEmits(['update:show','confirm']);

const localItems = ref([]);
watch(() => props.show, (v) => { if (v) localItems.value = (props.items || []).map(i => ({...i})); });

const handleConfirm = () => {
  emit('confirm', localItems.value.map(i => i.id));
  emit('update:show', false);
};

const handleReset = () => {
  localItems.value = (props.defaultItems || []).map(i => ({ ...i }));
};
</script>

<template>
  <Modal :show="show" @update:show="emit('update:show', $event)" @confirm="handleConfirm" :size="'2xl'">
    <template #title>
      <div class="flex items-center justify-between w-full">
        <h3 class="text-lg font-bold text-gray-800 dark:text-white">统一排序（订阅 + 手动节点）</h3>
        <button type="button" @click="handleReset" class="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">重置</button>
      </div>
    </template>
    <template #body>
      <div class="text-xs text-gray-500 dark:text-gray-400 mb-3">拖拽以改变顺序（支持跨类别）。</div>
      <draggable v-model="localItems" item-key="id" class="space-y-2" animation="250">
        <template #item="{element}">
          <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 ring-1 ring-black/5 dark:ring-white/10">
            <div class="flex items-center gap-3">
              <span class="text-[10px] px-2 py-0.5 rounded-full"
                    :class="element.type==='sub' ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-teal-500/20 text-teal-700 dark:text-teal-300'">
                {{ element.type==='sub' ? '订阅' : '手动' }}
              </span>
              <span class="text-sm text-gray-700 dark:text-gray-200 truncate max-w-[60vw]">{{ element.name || (element.type==='sub' ? '未命名订阅' : '未命名节点') }}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4h6v2H7V4zm0 5h6v2H7V9zm0 5h6v2H7v-2z"/></svg>
          </div>
        </template>
      </draggable>
    </template>
  </Modal>
</template>


