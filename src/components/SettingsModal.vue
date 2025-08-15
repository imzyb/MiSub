<script setup>
import { ref, watch, computed } from 'vue';
import Modal from './Modal.vue';
import { fetchSettings, saveSettings, migrateToD1 } from '../lib/api.js';
import { useToastStore } from '../stores/toast.js';

const props = defineProps({
  show: Boolean
});

const emit = defineEmits(['update:show']);

const { showToast } = useToastStore();
const isLoading = ref(false);
const isSaving = ref(false);
const isMigrating = ref(false);
const settings = ref({});

const hasWhitespace = computed(() => {
  const fieldsToCkeck = [
    'FileName',
    'mytoken',
    'profileToken',
    'subConverter',
    'subConfig',
    'BotToken',
    'ChatID',
  ];

  for (const key of fieldsToCkeck) {
    const value = settings.value[key];
    if (value && /\s/.test(value)) {
      return true;
    }
  }
  return false;
});

// 验证存储类型设置
const isStorageTypeValid = computed(() => {
  const validTypes = ['kv', 'd1'];
  return validTypes.includes(settings.value.storageType);
});

const loadSettings = async () => {
  isLoading.value = true;
  try {
    settings.value = await fetchSettings();
  } catch (error) {
    showToast('加载设置失败', 'error');
  } finally {
    isLoading.value = false;
  }
};

const handleSave = async () => {
  if (hasWhitespace.value) {
    showToast('输入项中不能包含空格，请检查后再试。', 'error');
    return;
  }

  if (!isStorageTypeValid.value) {
    showToast('存储类型设置无效，请选择有效的存储类型。', 'error');
    return;
  }

  isSaving.value = true;
  try {
    // 确保存储类型有默认值
    if (!settings.value.storageType) {
      settings.value.storageType = 'kv';
    }

    const result = await saveSettings(settings.value);
    if (result.success) {
      // 弹出成功提示
      showToast('设置已保存，页面将自动刷新...', 'success');

      // 【核心新增】在短暂延迟后刷新页面，让用户能看到提示
      setTimeout(() => {
        window.location.reload();
      }, 1500); // 延迟1.5秒
    } else {
      throw new Error(result.message || '保存失败');
    }
  } catch (error) {
    showToast(error.message, 'error');
    isSaving.value = false; // 只有失败时才需要重置保存状态
  }
};

// 数据迁移处理函数
const handleMigrateToD1 = async () => {
  if (!confirm('确定要将数据从 KV 迁移到 D1 数据库吗？此操作不可逆。')) {
    return;
  }

  isMigrating.value = true;
  try {
    const result = await migrateToD1();
    if (result.success) {
      showToast('数据迁移成功！建议将存储类型切换为 D1 数据库。', 'success');
      // 自动切换存储类型为 D1
      settings.value.storageType = 'd1';
    } else {
      throw new Error(result.message || '迁移失败');
    }
  } catch (error) {
    showToast(`迁移失败: ${error.message}`, 'error');
  } finally {
    isMigrating.value = false;
  }
};

// 监听 show 属性，当模态框从隐藏变为显示时，加载设置
watch(() => props.show, (newValue) => {
  if (newValue) {
    loadSettings();
  }
});
</script>

<template>
  <Modal 
    :show="show" 
    @update:show="emit('update:show', $event)" 
    @confirm="handleSave"
    :is-saving="isSaving"
    :confirm-disabled="hasWhitespace || !isStorageTypeValid"
    :confirm-button-title="hasWhitespace ? '输入内容包含空格，无法保存' : (!isStorageTypeValid ? '存储类型设置无效' : '')"
  >
    <template #title><h3 class="text-lg font-bold text-gray-800 dark:text-white">设置</h3></template>
    <template #body>
      <div v-if="isLoading" class="text-center p-8">
        <p class="text-gray-500">正在加载设置...</p>
      </div>
      <div v-else class="space-y-4">
        <div>
          <label for="fileName" class="block text-sm font-medium text-gray-700 dark:text-gray-300">自定义订阅文件名</label>
          <input 
            type="text" id="fileName" v-model="settings.FileName" 
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          >
        </div>
        <div>
          <label for="myToken" class="block text-sm font-medium text-gray-700 dark:text-gray-300">自定义订阅Token</label>
          <input 
            type="text" id="myToken" v-model="settings.mytoken"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          >
        </div>
        <div>
          <label for="profileToken" class="block text-sm font-medium text-gray-700 dark:text-gray-300">订阅组分享Token</label>
          <input 
            type="text" id="profileToken" v-model="settings.profileToken"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
            placeholder="用于生成订阅组链接专用Token"
          >
          <p class="text-xs text-gray-400 mt-1">此Token专门用于生成订阅组链接，增强安全性。</p>
        </div>
        <div>
          <label for="subConverter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">SubConverter后端地址</label>
          <input 
            type="text" id="subConverter" v-model="settings.subConverter" 
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          >
        </div>
        <div>
          <label for="subConfig" class="block text-sm font-medium text-gray-700 dark:text-gray-300">SubConverter配置文件</label>
          <input 
            type="text" id="subConfig" v-model="settings.subConfig"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          >
        </div>
         <div>
          <label for="tgBotToken" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Telegram Bot Token</label>
          <input 
            type="text" id="tgBotToken" v-model="settings.BotToken"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          >
        </div>
        <div>
          <label for="tgChatID" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Telegram Chat ID</label>
          <input 
            type="text" id="tgChatID" v-model="settings.ChatID"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">节点名前缀</label>
          <div class="mt-2 flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p class="text-sm text-gray-600 dark:text-gray-300">自动将订阅名添加为节点名的前缀</p>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.prependSubName" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">数据存储类型</label>
          <div class="space-y-3">
            <div class="flex items-center">
              <input
                id="storage-kv"
                type="radio"
                value="kv"
                v-model="settings.storageType"
                class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
              >
              <label for="storage-kv" class="ml-3 block text-sm text-gray-700 dark:text-gray-300">
                KV 存储（默认）
              </label>
            </div>
            <div class="flex items-center">
              <input
                id="storage-d1"
                type="radio"
                value="d1"
                v-model="settings.storageType"
                class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
              >
              <label for="storage-d1" class="ml-3 block text-sm text-gray-700 dark:text-gray-300">
                D1 数据库（推荐，无写入限制）
              </label>
            </div>
            <div class="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p class="text-xs text-blue-600 dark:text-blue-400">
                💡 提示：D1 数据库可以解决 KV 写入限制问题，适合频繁更新的场景。切换存储类型后建议重启应用。
              </p>
            </div>
            <!-- 数据迁移按钮 -->
            <div v-if="settings.storageType === 'kv'" class="mt-3">
              <button
                @click="handleMigrateToD1"
                :disabled="isMigrating"
                class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors duration-200"
              >
                <span v-if="isMigrating">正在迁移数据...</span>
                <span v-else>🚀 迁移数据到 D1 数据库</span>
              </button>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                将现有 KV 数据迁移到 D1 数据库，解决写入限制问题
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>