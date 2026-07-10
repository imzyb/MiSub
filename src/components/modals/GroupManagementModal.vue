<script setup>
import { ref, computed, watch } from 'vue';
import Modal from '../forms/Modal.vue';
import draggable from 'vuedraggable';

const props = defineProps({
  show: Boolean,
  groups: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'rename', 'delete', 'reorder', 'update:show']);

// 本地可编辑的分组列表
const localGroups = ref([]);
const editingGroupIndex = ref(null);
const editingGroupName = ref('');

// 监听 props.groups 变化，同步到本地
const syncGroups = () => {
  localGroups.value = props.groups.map(g => ({ name: g, editing: false }));
};

// 监听 show 变化，模态框打开时同步分组
watch(() => props.show, (newVal) => {
  if (newVal) {
    syncGroups();
  }
});

const handleClose = () => {
  editingGroupIndex.value = null;
  editingGroupName.value = '';
  emit('update:show', false);
  emit('close');
};

const startEdit = (index) => {
  editingGroupIndex.value = index;
  editingGroupName.value = localGroups.value[index].name;
};

const cancelEdit = () => {
  editingGroupIndex.value = null;
  editingGroupName.value = '';
};

const confirmEdit = () => {
  const newName = editingGroupName.value.trim();
  if (!newName) {
    cancelEdit();
    return;
  }
  
  const oldName = localGroups.value[editingGroupIndex.value].name;
  if (newName !== oldName) {
    emit('rename', oldName, newName);
    localGroups.value[editingGroupIndex.value].name = newName;
  }
  
  cancelEdit();
};

const handleDelete = (groupName) => {
  if (confirm(`确定删除分组 "${groupName}" 吗？分组内的节点将移至"默认"分组。`)) {
    emit('delete', groupName);
    localGroups.value = localGroups.value.filter(g => g.name !== groupName);
  }
};

const handleDragEnd = () => {
  const newOrder = localGroups.value.map(g => g.name);
  emit('reorder', newOrder);
};

const isDraggable = computed(() => localGroups.value.length > 1);
</script>

<template>
  <Modal :show="show" @close="handleClose" max-width="max-w-2xl">
    <template #title>
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span>分组管理</span>
      </div>
    </template>

    <template #body>
      <div class="space-y-3">
        <div v-if="localGroups.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p>暂无分组</p>
        </div>

        <draggable
          v-else
          v-model="localGroups"
          item-key="name"
          @end="handleDragEnd"
          :disabled="!isDraggable"
          handle=".drag-handle"
          animation="200"
          class="space-y-2"
        >
          <template #item="{ element, index }">
            <div
              class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors"
              :class="editingGroupIndex === index ? 'ring-2 ring-indigo-500' : 'hover:border-gray-300 dark:hover:border-gray-600'"
            >
              <!-- 拖拽手柄 -->
              <button
                v-if="isDraggable"
                class="drag-handle cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="拖拽排序"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              <!-- 分组名称或编辑输入框 -->
              <div class="flex-1">
                <input
                  v-if="editingGroupIndex === index"
                  v-model="editingGroupName"
                  type="text"
                  class="w-full px-3 py-1.5 text-sm border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  @keyup.enter="confirmEdit"
                  @keyup.esc="cancelEdit"
                  ref="editInput"
                  autofocus
                />
                <div v-else class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ element.name }}</span>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="flex items-center gap-1">
                <template v-if="editingGroupIndex === index">
                  <button
                    @click="confirmEdit"
                    class="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                    title="确认"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  <button
                    @click="cancelEdit"
                    class="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    title="取消"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </template>
                <template v-else>
                  <button
                    @click="startEdit(index)"
                    class="p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-md transition-colors"
                    title="重命名"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    @click="handleDelete(element.name)"
                    class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title="删除"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </template>
              </div>
            </div>
          </template>
        </draggable>

        <div v-if="isDraggable" class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p class="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <span>拖拽分组左侧的图标可调整显示顺序</span>
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <button
        @click="handleClose"
        class="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        关闭
      </button>
    </template>
  </Modal>
</template>
