<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { useUIStore } from '../stores/ui.js';

const props = defineProps({
  config: Object,
  profiles: Array,
});

const { showToast } = useToastStore();
const uiStore = useUIStore();

const copied = ref(false);
let copyTimeout = null;

const formats = ['通用格式', 'Base64', 'Clash', 'Sing-Box', 'Surge', 'Loon'];
const selectedFormat = ref('通用格式');
const selectedId = ref('default'); 

const requiredToken = computed(() => {
  return selectedId.value === 'default' 
    ? { type: 'mytoken', value: props.config?.mytoken, name: '主 Token' }
    : { type: 'profileToken', value: props.config?.profileToken, name: '分享 Token' };
});

const isLinkValid = computed(() => {
  return requiredToken.value.value && requiredToken.value.value !== 'auto';
});

const subLink = computed(() => {
  if (!isLinkValid.value) {
    return `请先在“设置”中配置固定的 ${requiredToken.value.name}`;
  }
  
  const origin = window.location.origin;
  const token = requiredToken.value.value;
  let baseUrl = selectedId.value === 'default'
    ? `${origin}/${token}`
    : `${origin}/${token}/${selectedId.value}`;

  if (selectedFormat.value === '通用格式') {
    return baseUrl;
  }
  
  const targetMapping = { 'Sing-Box': 'singbox', 'QuanX': 'quanx' };
  const formatKey = (targetMapping[selectedFormat.value] || selectedFormat.value.toLowerCase());
  return `${baseUrl}?${formatKey}`;
});

const copyToClipboard = () => {
    if (!isLinkValid.value) {
        showToast('链接无效，请先完成配置', 'error');
        return;
    }
    navigator.clipboard.writeText(subLink.value);
    showToast('已复制到剪贴板', 'success');
    copied.value = true;
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => { copied.value = false; }, 2000);
};

onUnmounted(() => {
  clearTimeout(copyTimeout);
});
</script>

<template>
  <div class="sticky top-24">
    <div class="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md card-shadow hover:card-shadow-hover p-6 rounded-2xl transition-all duration-300">
      <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 list-item-animation" style="--delay-index: 0">生成订阅链接</h3>

      <div class="mb-4 list-item-animation" style="--delay-index: 1">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">1. 选择订阅内容</label>
        <select v-model="selectedId" class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white input-enhanced">
            <option value="default">默认订阅 (全部启用节点)</option>
            <option v-for="profile in profiles" :key="profile.id" :value="profile.customId || profile.id">
                {{ profile.name }}
            </option>
        </select>
      </div>

      <div class="mb-5 list-item-animation" style="--delay-index: 2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. 选择格式</label>
        <div class="grid grid-cols-3 gap-2">
            <button
              v-for="(format, index) in formats"
              :key="format"
              @click="selectedFormat = format"
              class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex justify-center items-center list-item-animation"
              :style="{ '--delay-index': index }"
              :class="[
                selectedFormat === format
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-200/80 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-300/80 dark:hover:bg-gray-600/50'
              ]"
            >
              {{ format }}
            </button>
        </div>
      </div>

      <div class="relative list-item-animation" style="--delay-index: 3">
        <input
          type="text"
          :value="subLink"
          readonly
          :disabled="!isLinkValid"
          class="w-full text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded-lg pl-3 pr-10 py-2.5 focus:outline-hidden focus:ring-2 font-mono input-enhanced"
          :class="{
            'focus:ring-indigo-500': isLinkValid,
            'focus:ring-red-500 cursor-not-allowed': !isLinkValid,
            'text-red-500 dark:text-red-500': !isLinkValid
          }"
        />
        <button @click="copyToClipboard" :disabled="!isLinkValid" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors duration-200" :class="isLinkValid ? 'hover:text-indigo-500' : 'cursor-not-allowed'">
            <Transition name="fade" mode="out-in">
                <svg v-if="copied" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </Transition>
        </button>
      </div>

       <p v-if="!isLinkValid || requiredToken.value.value === 'auto'" class="text-xs text-yellow-600 dark:text-yellow-500 mt-2 list-item-animation" style="--delay-index: 4">
           提示：
           <span v-if="!isLinkValid">请在 
             <button @click="uiStore.isSettingsModalVisible = true" class="font-bold underline hover:text-yellow-400">设置</button> 
             中配置一个固定的 {{ requiredToken.name }}。
           </span>
           <span v-else-if="requiredToken.type === 'mytoken' && requiredToken.value === 'auto'">
             当前为自动Token，链接可能会变化。为确保链接稳定，推荐在 "设置" 中配置一个固定Token。
           </span>
       </p>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
