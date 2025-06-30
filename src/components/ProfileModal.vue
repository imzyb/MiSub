<script setup>
import { ref, watch } from 'vue';
import Modal from './Modal.vue';

const props = defineProps({
  show: Boolean,
  profile: Object,
  isNew: Boolean,
  allSubscriptions: Array,
  allManualNodes: Array,
});

const emit = defineEmits(['update:show', 'save']);

const localProfile = ref({});

watch(() => props.profile, (newProfile) => {
  if (newProfile) {
    localProfile.value = JSON.parse(JSON.stringify(newProfile));
  } else {
    localProfile.value = { name: '', enabled: true, subscriptions: [], manualNodes: [], customId: '' };
  }
}, { deep: true, immediate: true });

const handleConfirm = () => {
  emit('save', localProfile.value);
};

const toggleSelection = (listName, id) => {
    const list = localProfile.value[listName];
    const index = list.indexOf(id);
    if (index > -1) {
        list.splice(index, 1);
    } else {
        list.push(id);
    }
};

const handleSelectAll = (listName, sourceArray) => {
    localProfile.value[listName] = sourceArray.map(item => item.id);
};
const handleDeselectAll = (listName) => {
    localProfile.value[listName] = [];
};

</script>

<template>
  <Modal :show="show" @update:show="emit('update:show', $event)" @confirm="handleConfirm" size="2xl">
    <template #title>
      <h3 class="text-lg font-bold text-gray-800 dark:text-white">
        {{ isNew ? '新增订阅组' : '编辑订阅组' }}
      </h3>
    </template>
    <template #body>
      <div v-if="localProfile" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="profile-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                订阅组名称
              </label>
              <input
                type="text"
                id="profile-name"
                v-model="localProfile.name"
                placeholder="例如：家庭共享"
                class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
              >
            </div>
            <div>
              <label for="profile-custom-id" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                自定义 ID (可选)
              </label>
              <input
                type="text"
                id="profile-custom-id"
                v-model="localProfile.customId"
                placeholder="如: home, game (限字母、数字、-、_)"
                class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
              >
               <p class="text-xs text-gray-400 mt-1">设置后，订阅链接会更短，如 /token/home</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div v-if="allSubscriptions.length > 0" class="space-y-2">
              <div class="flex justify-between items-center">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">选择机场订阅</h4>
                <div class="space-x-2">
                    <button @click="handleSelectAll('subscriptions', allSubscriptions)" class="text-xs text-indigo-600 hover:underline">全选</button>
                    <button @click="handleDeselectAll('subscriptions')" class="text-xs text-indigo-600 hover:underline">全不选</button>
                </div>
              </div>
              <div class="max-h-32 overflow-y-auto space-y-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border dark:border-gray-700">
                <div v-for="sub in allSubscriptions" :key="sub.id">
                  <label class="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="localProfile.subscriptions?.includes(sub.id)"
                      @change="toggleSelection('subscriptions', sub.id)"
                      class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span class="text-sm text-gray-800 dark:text-gray-200 truncate" :title="sub.name">{{ sub.name || '未命名订阅' }}</span>
                  </label>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-sm text-gray-500 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg flex items-center justify-center h-full">
              没有可用的机场订阅
            </div>

            <div v-if="allManualNodes.length > 0" class="space-y-2">
              <div class="flex justify-between items-center">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">选择手动节点</h4>
                 <div class="space-x-2">
                    <button @click="handleSelectAll('manualNodes', allManualNodes)" class="text-xs text-indigo-600 hover:underline">全选</button>
                    <button @click="handleDeselectAll('manualNodes')" class="text-xs text-indigo-600 hover:underline">全不选</button>
                </div>
              </div>
               <div class="max-h-64 overflow-y-auto space-y-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border dark:border-gray-700">
                <div v-for="node in allManualNodes" :key="node.id">
                  <label class="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="localProfile.manualNodes?.includes(node.id)"
                      @change="toggleSelection('manualNodes', node.id)"
                      class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span class="text-sm text-gray-800 dark:text-gray-200 truncate" :title="node.name">{{ node.name || '未命名节点' }}</span>
                  </label>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-sm text-gray-500 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg flex items-center justify-center h-full">
               没有可用的手动节点
            </div>
        </div>

      </div>
    </template>
  </Modal>
</template>