<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { useToastStore } from '../../stores/toast.js';
import { useUIStore } from '../../stores/ui.js';

const props = defineProps({
  config: Object,
  profiles: Array,
});

const emit = defineEmits(['qrcode']);

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
  <div>
    <div class="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md p-6 misub-radius-lg border border-gray-100/80 dark:border-white/10 shadow-sm transition-all duration-300">
      <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 list-item-animation" style="--delay-index: 0">生成订阅链接</h3>

      <div class="mb-4 list-item-animation" style="--delay-index: 1">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">1. 选择订阅内容</label>
        <select v-model="selectedId" class="w-full px-3 py-2.5 bg-white/80 dark:bg-gray-800/70 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:outline-hidden focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 text-sm text-gray-900 dark:text-white input-enhanced">
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
              :aria-pressed="selectedFormat === format"
              class="px-3 py-2 text-xs font-medium misub-radius-lg border transition-colors flex justify-center items-center list-item-animation"
              :style="{ '--delay-index': index }"
              :class="[
                selectedFormat === format
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm shadow-primary-500/30'
                  : 'bg-white/70 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-200/70 dark:border-white/10 hover:bg-white dark:hover:bg-gray-800'
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
          class="w-full text-sm text-gray-600 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-800/60 misub-radius-lg pl-3 pr-20 py-2.5 border border-gray-200/70 dark:border-white/10 focus:outline-hidden focus:ring-2 font-mono input-enhanced"
          :class="{
            'focus:ring-primary-500': isLinkValid,
            'focus:ring-red-500 cursor-not-allowed': !isLinkValid,
            'text-red-500 dark:text-red-500': !isLinkValid
          }"
        />
        <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button @click="$emit('qrcode', subLink, '订阅链接')" :disabled="!isLinkValid" class="flex h-9 w-9 items-center justify-center misub-radius-md text-gray-400 transition-colors duration-200" :class="isLinkValid ? 'hover:text-primary-600 hover:bg-white/80 dark:hover:bg-gray-800' : 'cursor-not-allowed'" title="显示二维码">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
               <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
               <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
             </svg>
          </button>
          <button @click="copyToClipboard" :disabled="!isLinkValid" class="flex h-9 w-9 items-center justify-center misub-radius-md text-gray-400 transition-colors duration-200" :class="isLinkValid ? 'hover:text-primary-600 hover:bg-white/80 dark:hover:bg-gray-800' : 'cursor-not-allowed'" title="复制链接">
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
      </div>

       <p v-if="!isLinkValid || requiredToken.value.value === 'auto'" class="text-xs text-yellow-600 dark:text-yellow-500 mt-2 list-item-animation" style="--delay-index: 4">
           提示：
           <span v-if="!isLinkValid">请在              <router-link to="/settings" class="font-bold underline hover:text-yellow-400">设置</router-link> 
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
