<script setup>
import { ref, watch, computed } from 'vue';
import Modal from './Modal.vue';
import { fetchSettings, saveSettings, migrateToD1, testSubscription } from '../lib/api.js';
import { useToastStore } from '../stores/toast.js';

const props = defineProps({
  show: Boolean,
  exportBackup: Function,
  importBackup: Function,
});

const emit = defineEmits(['update:show']);

const { showToast } = useToastStore();
const isLoading = ref(false);
const isSaving = ref(false);
const isMigrating = ref(false);
const settings = ref({});

// 新增：前缀配置的响应式对象
const prefixConfig = ref({
  enableManualNodes: true,
  enableSubscriptions: true,
  manualNodePrefix: '手动节点'
});

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
    
    // 加载前缀配置，支持向后兼容
    if (settings.value.prefixConfig) {
      prefixConfig.value = {
        enableManualNodes: settings.value.prefixConfig.enableManualNodes ?? true,
        enableSubscriptions: settings.value.prefixConfig.enableSubscriptions ?? true,
        manualNodePrefix: settings.value.prefixConfig.manualNodePrefix ?? '手动节点'
      };
    } else {
      // 如果没有新的配置，使用老的 prependSubName 作为默认值
      const fallbackEnabled = settings.value.prependSubName ?? true;
      prefixConfig.value = {
        enableManualNodes: fallbackEnabled,
        enableSubscriptions: fallbackEnabled,
        manualNodePrefix: '手动节点'
      };
    }
  } catch (error) {
    showToast('加载设置失败', 'error');
  } finally {
    isLoading.value = false;
  }
};

// 新增：订阅调试相关状态
const debugUrl = ref('');
const debugUserAgent = ref('clash-meta/1.17.0');
const isDebugging = ref(false);
const debugResult = ref(null);

// 新增：订阅调试函数
const handleDebugSubscription = async () => {
  if (!debugUrl.value) {
    showToast('请输入订阅URL', 'error');
    return;
  }
  
  if (!/^https?:\/\//.test(debugUrl.value)) {
    showToast('请输入有效的 http:// 或 https:// URL', 'error');
    return;
  }
  
  isDebugging.value = true;
  debugResult.value = null;
  
  try {
    const result = await testSubscription(debugUrl.value, debugUserAgent.value);
    debugResult.value = result;
    
    if (result.success) {
      showToast('调试完成，请查看结果', 'success');
    } else {
      showToast('调试失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (error) {
    showToast('调试请求失败: ' + error.message, 'error');
    debugResult.value = { error: error.message };
  } finally {
    isDebugging.value = false;
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

    // 合并前缀配置到设置中
    const settingsToSave = {
      ...settings.value,
      prefixConfig: {
        enableManualNodes: prefixConfig.value.enableManualNodes,
        enableSubscriptions: prefixConfig.value.enableSubscriptions,
        manualNodePrefix: prefixConfig.value.manualNodePrefix
      }
    };

    const result = await saveSettings(settingsToSave);
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
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">节点名前缀设置</label>
          <div class="space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <!-- 全局开关(保持向后兼容) -->
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">全局前缀开关</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">控制所有前缀功能的总开关</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="settings.prependSubName" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-indigo-600 dark:peer-checked:bg-green-600"></div>
              </label>
            </div>
            
            <!-- 细粒度控制 -->
            <div v-if="settings.prependSubName" class="mt-4 space-y-3 border-t border-gray-200 dark:border-gray-600 pt-3">
              <!-- 手动节点前缀 -->
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">手动节点前缀</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">为手动添加的节点添加前缀</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="prefixConfig.enableManualNodes" class="sr-only peer">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-indigo-600 dark:peer-checked:bg-green-600"></div>
                </label>
              </div>
              
              <!-- 手动节点前缀文本 -->
              <div v-if="prefixConfig.enableManualNodes" class="ml-4">
                <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">手动节点前缀文本</label>
                <input 
                  type="text" 
                  v-model="prefixConfig.manualNodePrefix" 
                  placeholder="手动节点"
                  class="block w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                >
              </div>
              
              <!-- 机场订阅前缀 -->
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">机场订阅前缀</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">为机场订阅节点添加订阅名前缀</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="prefixConfig.enableSubscriptions" class="sr-only peer">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-indigo-600 dark:peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>
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
        <!-- 数据管理 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">数据管理</label>
          <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              将会话数据（订阅、节点、订阅组）导出为 JSON 文件进行备份，或从备份文件中恢复。
            </p>
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="props.exportBackup"
                class="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors duration-200"
              >
                导出备份
              </button>
              <button
                @click="props.importBackup"
                class="w-full px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors duration-200"
              >
                导入备份
              </button>
            </div>
          </div>
        </div>
        <!-- 订阅调试工具 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">🔍 订阅调试工具</label>
          <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              用于调试订阅链接的内容，帮助诊断节点丢失等问题。
            </p>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">订阅URL</label>
                <input 
                  v-model="debugUrl"
                  placeholder="https://example.com/subscription"
                  class="block w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">User-Agent</label>
                <select 
                  v-model="debugUserAgent"
                  class="block w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                >
                  <option value="clash-meta/1.17.0">Clash-Meta</option>
                  <option value="v2rayN/6.45">v2rayN</option>
                  <option value="NekoBox/1.6.1">NekoBox</option>
                  <option value="Shadowrocket/1999">Shadowrocket</option>
                  <option value="surge/4.0">Surge</option>
                  <option value="QuantumultX/1.0">Quantumult X</option>
                  <option value="Stash/1.0">Stash</option>
                  <option value="Mihomo/0.1">Mihomo</option>
                  <option value="clash-verge/1.0">Clash Verge</option>
                </select>
              </div>
              <button
                @click="handleDebugSubscription"
                :disabled="isDebugging || !debugUrl"
                class="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors duration-200"
              >
                <span v-if="isDebugging">正在调试...</span>
                <span v-else>开始调试</span>
              </button>
            </div>
            
            <!-- 调试结果显示 -->
            <div v-if="debugResult" class="mt-4 p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 max-h-96 overflow-y-auto">
              <div v-if="debugResult.error" class="text-red-600 dark:text-red-400 text-sm">
                <p class="font-medium">错误:</p>
                <p>{{ debugResult.error }}</p>
              </div>
              <div v-else-if="debugResult.success" class="text-sm space-y-3">
                <div>
                  <p class="font-medium text-gray-700 dark:text-gray-300">基本信息:</p>
                  <p class="text-gray-600 dark:text-gray-400">URL: {{ debugResult.url }}</p>
                  <p class="text-gray-600 dark:text-gray-400">User-Agent: {{ debugResult.userAgent }}</p>
                  <p class="text-gray-600 dark:text-gray-400">总节点数: {{ debugResult.totalNodes }}</p>
                  <p class="text-gray-600 dark:text-gray-400">SS节点数: {{ debugResult.ssNodesCount }}</p>
                </div>
                
                <div v-if="debugResult.ssNodes && debugResult.ssNodes.length > 0">
                  <p class="font-medium text-gray-700 dark:text-gray-300">SS节点分析:</p>
                  <div v-for="(node, index) in debugResult.ssNodes" :key="index" class="mt-2 p-2 bg-gray-100 dark:bg-gray-600 rounded">
                    <div v-if="node.error" class="text-red-600 dark:text-red-400">
                      <p class="font-medium">解析错误:</p>
                      <p>{{ node.error }}</p>
                    </div>
                    <div v-else>
                      <p class="font-medium text-gray-700 dark:text-gray-300">节点 {{ index + 1 }}:</p>
                      <p class="text-gray-600 dark:text-gray-400 text-xs truncate">原始: {{ node.original }}</p>
                      <p class="text-gray-600 dark:text-gray-400 text-xs" v-if="node.hasUrlEncoding">包含URL编码: 是</p>
                      <p class="text-gray-600 dark:text-gray-400 text-xs truncate" v-if="node.base64Part">Base64部分: {{ node.base64Part }}</p>
                      <p class="text-gray-600 dark:text-gray-400 text-xs truncate" v-if="node.credentials">凭证: {{ node.credentials }}</p>
                      <p class="text-gray-600 dark:text-gray-400 text-xs truncate" v-if="node.fixed && node.fixed !== node.original">修复后: {{ node.fixed }}</p>
                    </div>
                  </div>
                </div>
                
                <div v-if="debugResult.validNodes && debugResult.validNodes.length > 0">
                  <p class="font-medium text-gray-700 dark:text-gray-300">前20个有效节点:</p>
                  <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 text-xs space-y-1">
                    <li v-for="(node, index) in debugResult.validNodes" :key="index" class="truncate">{{ node }}</li>
                  </ul>
                </div>
                
                <div>
                  <p class="font-medium text-gray-700 dark:text-gray-300">原始内容预览 (前2000字符):</p>
                  <pre class="text-gray-600 dark:text-gray-400 text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded mt-1 max-h-32 overflow-y-auto">{{ debugResult.rawContent }}</pre>
                </div>
                
                <div>
                  <p class="font-medium text-gray-700 dark:text-gray-300">处理后内容预览 (前2000字符):</p>
                  <pre class="text-gray-600 dark:text-gray-400 text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded mt-1 max-h-32 overflow-y-auto">{{ debugResult.processedContent }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>
