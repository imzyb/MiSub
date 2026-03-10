<script setup>
import { computed } from 'vue';
import Modal from '../forms/Modal.vue';
import { useToastStore } from '@/stores/toast';

const props = defineProps({
  show: Boolean,
  profile: Object,
  token: String,
});

const emit = defineEmits(['update:show']);
const { showToast } = useToastStore();

const close = () => {
  emit('update:show', false);
};

const identifier = computed(() => {
  if (!props.profile) return '';
  return props.profile.customId || props.profile.id;
});

const baseUrl = computed(() => {
  if (!props.token || props.token === 'auto' || !props.token.trim()) return '';
  return `${window.location.origin}/${props.token}/${identifier.value}`;
});

const clients = computed(() => [
  { name: '默认 (自动探测)', type: 'default', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', format: '' },
  { name: 'Clash', type: 'clash', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', format: '?clash' },
  { name: 'Sing-Box', type: 'singbox', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', format: '?singbox' },
  { name: 'Surge', type: 'surge', icon: 'M13 10V3L4 14h7v7l9-11h-7z', format: '?surge' },
  { name: 'Loon', type: 'loon', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8', format: '?loon' },
  { name: 'V2Ray / Base64', type: 'base64', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', format: '?base64' },
  { name: 'Quantumult X', type: 'quanx', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', format: '?quanx' },
]);

const copyToClipboard = async (format) => {
  if (!baseUrl.value) {
    showToast('请在设置中配置一个固定的"订阅组分享Token"', 'error');
    return;
  }
  
  const link = `${baseUrl.value}${format}`;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
      showToast('链接已复制到剪贴板！', 'success');
      close();
    } else {
      fallbackCopy(link);
    }
  } catch (err) {
    fallbackCopy(link);
  }
};

const fallbackCopy = (link) => {
  const textArea = document.createElement("textarea");
  textArea.value = link;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast('链接已复制到剪贴板！', 'success');
      close();
    } else {
      showToast('复制失败，请手动复制', 'error');
    }
  } catch (err) {
    showToast('复制失败，请手动复制', 'error');
  }
  document.body.removeChild(textArea);
};
</script>

<template>
  <Modal :show="show" @update:show="close" :show-cancel="false" :show-confirm="false">
    <template #title>
      <h3 class="text-xl font-bold text-gray-900 dark:text-white">复制订阅链接</h3>
    </template>
    
    <template #body>
      <div class="mt-2" v-if="!baseUrl">
         <p class="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
           检测到您未在设置中配置“订阅组分享Token”，无法生成链接。请前往设置页面配置。
         </p>
      </div>
      <div v-else class="space-y-3 mt-4">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          如果您使用的客户端有特殊格式要求，请点选对应的专用链接进行复制。
        </p>

        <div 
          v-for="client in clients" 
          :key="client.type"
          @click="copyToClipboard(client.format)"
          class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer transition-all duration-200 group"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-white dark:group-hover:bg-gray-900 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" :d="client.icon" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-700 dark:group-hover:text-primary-300">{{ client.name }}</p>
            </div>
          </div>
          
          <button class="px-3 py-1 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            复制
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>
