<script setup>
import { ref, watch } from 'vue';
import { useToastStore } from '../stores/toast.js';
import Modal from './Modal.vue';
import yaml from 'js-yaml'; // js-yaml is already in package.json
import { extractNodeName } from '../lib/utils.js';

const props = defineProps({
  show: Boolean,
  addNodesFromBulk: Function, // New prop
});

const emit = defineEmits(['update:show']);

const subscriptionUrl = ref('');
const isLoading = ref(false);
const errorMessage = ref('');

const toastStore = useToastStore();

watch(() => props.show, (newVal) => {
  if (!newVal) { // If modal is being hidden
    subscriptionUrl.value = '';
    errorMessage.value = '';
    isLoading.value = false;
  }
});

const isValidUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseNodes = (content) => {
  const nodes = [];
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  // Try Base64 decode first
  try {
    const decodedContent = atob(content);
    const decodedLines = decodedContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (decodedLines.some(line => line.includes('://'))) { // Heuristic: if decoded content looks like URLs
      for (const line of decodedLines) {
        if (line.includes('://')) {
          nodes.push({ id: crypto.randomUUID(), name: extractNodeName(line) || `Imported Node ${nodes.length + 1}`, url: line, enabled: true });
        }
      }
      if (nodes.length > 0) return nodes;
    }
  } catch (e) {
    // Not base64 or not a list of URLs after base64 decode
  }

  // Try YAML parsing (e.g., Clash config)
  try {
    const parsedYaml = yaml.load(content);
    if (parsedYaml && typeof parsedYaml === 'object' && parsedYaml.proxies && Array.isArray(parsedYaml.proxies)) {
      for (const proxy of parsedYaml.proxies) {
        if (typeof proxy === 'object' && proxy.name && proxy.type) {
          // Attempt to construct a URL from common proxy types
          let url = '';
          switch (proxy.type.toLowerCase()) {
            case 'vmess':
            case 'vless':
            case 'trojan':
            case 'ss':
            case 'ssr':
            case 'tuic':
            case 'hysteria':
            case 'hysteria2':
              // This is a simplified approach. Real conversion from Clash config to full URL is complex.
              // For now, we'll just add a placeholder or skip if a direct URL isn't available.
              // A more robust solution would involve a dedicated parser for each protocol.
              if (proxy.server && proxy.port) {
                url = `${proxy.type.toLowerCase()}://${proxy.server}:${proxy.port}`;
              }
              break;
            default:
              break;
          }
          if (url) {
            nodes.push({ id: crypto.randomUUID(), name: proxy.name, url: url, enabled: true });
          }
        }
      }
      if (nodes.length > 0) return nodes;
    }
  } catch (e) {
    // Not valid YAML or not a Clash-like config
  }

  // Fallback to plain text (one URL per line)
  for (const line of lines) {
    if (line.includes('://')) { // Basic check for protocol
      nodes.push({ id: crypto.randomUUID(), name: extractNodeName(line) || `Imported Node ${nodes.length + 1}`, url: line, enabled: true });
    }
  }

  return nodes;
};

const importSubscription = async () => {
  errorMessage.value = '';
  if (!isValidUrl(subscriptionUrl.value)) {
    errorMessage.value = '请输入有效的 HTTP 或 HTTPS 订阅链接。';
    return;
  }

  isLoading.value = true;
  try {
    const response = await fetch('/api/fetch_external_url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: subscriptionUrl.value })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    const content = await response.text();
    const newNodes = parseNodes(content);

    if (newNodes.length > 0) {
      props.addNodesFromBulk(newNodes);
      toastStore.showToast(`成功添加了 ${newNodes.length} 个节点。`, 'success');
      emit('close');
    } else {
      errorMessage.value = '未能从订阅链接中解析出任何节点。请检查链接内容。';
    }
  } catch (error) {
    console.error('导入订阅失败:', error);
    errorMessage.value = `导入失败: ${error.message}`;
    toastStore.showToast(`导入失败: ${error.message}`, 'error');
  } finally {
    isLoading.value = false;
  }
};


</script>

<template>
  <Modal
    :show="show"
    @update:show="emit('update:show', $event)"
    @confirm="importSubscription"
    confirm-text="导入"
    :confirm-disabled="isLoading"
  >
    <template #title>导入订阅</template>
    <template #body>
      <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
        请输入订阅链接，系统将尝试解析其中的节点信息。支持 Base64、纯文本节点列表和部分 YAML 格式。
      </p>
      <input
        type="text"
        v-model="subscriptionUrl"
        placeholder="https://example.com/your-subscription-link"
        class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        @keyup.enter="importSubscription"
      />
      <p v-if="errorMessage" class="text-red-500 text-sm mt-2">{{ errorMessage }}</p>
    </template>
  </Modal>
</template>
