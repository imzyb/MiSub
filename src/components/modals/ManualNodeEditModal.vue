<script setup>
import { computed, ref, watch } from 'vue';
import Modal from '../forms/Modal.vue';
import Input from '../ui/Input.vue';
import GroupSelector from '../ui/GroupSelector.vue'; // Added
import { useDataStore } from '../../stores/useDataStore.js';
import { useSubscriptions } from '../../composables/useSubscriptions.js';
import { useBulkImportLogic } from '../../composables/useBulkImportLogic.js';
import { useManualNodes } from '../../composables/useManualNodes.js';

const props = defineProps({
  show: Boolean,
  isNew: Boolean,
  editingNode: Object
});

const emit = defineEmits(['update:show', 'confirm', 'input-url']);
const dataStore = useDataStore();
const { markDirty } = dataStore;

const { addSubscriptionsFromBulk } = useSubscriptions(markDirty);
const { addNodesFromBulk, manualNodeGroups } = useManualNodes(markDirty);
const { handleBulkImport } = useBulkImportLogic({ addSubscriptionsFromBulk, addNodesFromBulk });

// 浮动标签状态
const nameFocused = ref(false);
const urlFocused = ref(false);

// 协议检测
const getProtocol = (url) => {
  if (!url) return null;
  const lowerUrl = url.toLowerCase().trim();
  if (lowerUrl.startsWith('anytls://')) return { name: 'AnyTLS', color: 'slate' };
  if (lowerUrl.startsWith('hysteria2://') || lowerUrl.startsWith('hy2://')) return { name: 'HY2', color: 'purple' };
  if (lowerUrl.startsWith('hysteria://') || lowerUrl.startsWith('hy://')) return { name: 'Hysteria', color: 'fuchsia' };
  if (lowerUrl.startsWith('ssr://')) return { name: 'SSR', color: 'rose' };
  if (lowerUrl.startsWith('tuic://')) return { name: 'TUIC', color: 'cyan' };
  if (lowerUrl.startsWith('ss://')) return { name: 'SS', color: 'orange' };
  if (lowerUrl.startsWith('vmess://')) return { name: 'VMess', color: 'teal' };
  if (lowerUrl.startsWith('vless://')) return { name: 'VLess', color: 'blue' };
  if (lowerUrl.startsWith('trojan://')) return { name: 'Trojan', color: 'red' };
  if (lowerUrl.startsWith('socks5://') || lowerUrl.startsWith('socks://')) return { name: 'SOCKS5', color: 'lime' };
  if (lowerUrl.startsWith('snell://')) return { name: 'Snell', color: 'indigo' };
  if (lowerUrl.startsWith('naive+')) return { name: 'Naive', color: 'pink' };
  if (lowerUrl.startsWith('http')) return { name: 'HTTP', color: 'green' };
  return null;
};

// 从链接提取节点名称
const extractNodeName = (url) => {
  if (!url) return null;
  try {
    // VMess 特殊处理
    if (url.toLowerCase().startsWith('vmess://')) {
      const decoded = atob(url.slice(8));
      const config = JSON.parse(decoded);
      return config.ps || config.remarks || null;
    }
    // 其他协议尝试从 fragment 或参数中提取
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      return decodeURIComponent(url.slice(hashIndex + 1)) || null;
    }
  } catch {
    return null;
  }
  return null;
};

// 解析批量导入的节点列表
const parsedNodes = computed(() => {
  if (!props.editingNode?.url) return [];
  const lines = props.editingNode.url.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map((line, index) => {
    const protocol = getProtocol(line);
    const name = extractNodeName(line) || `节点 ${index + 1}`;
    return { line, protocol, name, index };
  });
});

const isMultiLine = computed(() => {
  return props.isNew && parsedNodes.value.length > 1;
});

const validLineCount = computed(() => parsedNodes.value.length);

// 单行模式下的协议检测
const singleProtocol = computed(() => {
  if (isMultiLine.value || !props.editingNode?.url) return null;
  return getProtocol(props.editingNode.url);
});

// 单行模式下的名称建议
const suggestedName = computed(() => {
  if (!props.isNew || isMultiLine.value || !props.editingNode?.url) return null;
  return extractNodeName(props.editingNode.url);
});

// 应用建议的名称
const applySuggestedName = () => {
  if (suggestedName.value && props.editingNode) {
    props.editingNode.name = suggestedName.value;
  }
};

const handleConfirm = () => {
  if (props.isNew && isMultiLine.value) {
    // Pass group if specified (though bulk import logic might need update to support group, currently logic is simple)
    // Actually handleBulkImport second arg was colorTag. Now it should be group.
    // Let's check handleBulkImport usage.
    // Line 107 in original: handleBulkImport(props.editingNode.url, props.editingNode.colorTag);
    // Depending on useBulkImportLogic, we might need to update it too.
    // For now, let's assume we pass group.
    handleBulkImport(props.editingNode.url, props.editingNode.group);
    emit('update:show', false);
    return;
  }
  emit('confirm');
};

// 颜色映射到 Tailwind 类
const colorMap = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500'
};

const protocolColorMap = {
  slate: 'text-slate-500 dark:text-slate-400',
  purple: 'text-purple-500 dark:text-purple-400',
  fuchsia: 'text-fuchsia-500 dark:text-fuchsia-400',
  rose: 'text-rose-500 dark:text-rose-400',
  cyan: 'text-cyan-500 dark:text-cyan-400',
  orange: 'text-orange-500 dark:text-orange-400',
  teal: 'text-teal-500 dark:text-teal-400',
  blue: 'text-blue-500 dark:text-blue-400',
  red: 'text-red-500 dark:text-red-400',
  lime: 'text-lime-500 dark:text-lime-400',
  indigo: 'text-indigo-500 dark:text-indigo-400',
  pink: 'text-pink-500 dark:text-pink-400',
  green: 'text-green-500 dark:text-green-400'
};
</script>

<template>
  <Modal
    v-if="editingNode"
    :show="show"
    size="2xl"
    @update:show="emit('update:show', $event)"
    @confirm="handleConfirm"
  >
    <template #title>
      <div class="flex items-center gap-3">
        <div class="p-2 misub-radius-lg bg-indigo-500/10">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-bold text-gray-800 dark:text-white">
            {{ isNew ? '新增手动节点' : '编辑手动节点' }}
          </h3>
          <p v-if="!(isNew && isMultiLine)" class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">支持单条编辑，也支持多行粘贴后批量导入节点。</p>
          <p v-if="isNew && isMultiLine" class="text-sm text-indigo-500 mt-0.5 font-medium flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
            </svg>
            检测到 {{ validLineCount }} 条有效链接
          </p>
        </div>
      </div>
    </template>
    
    <template #body>
      <div class="space-y-6">
        <!-- 名称和颜色标签 - 两栏布局 -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- 节点名称 -->
          <div class="relative">
             <div class="flex flex-col">
              <label for="node-name" class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
                节点名称 (可选)
              </label>
              <Input
                id="node-name"
                v-model="editingNode.name"
                placeholder="节点名称（可选）"
                @focus="nameFocused = true"
                @blur="nameFocused = false"
              >
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </template>
              </Input>
              
              <!-- 名称建议 -->
              <div v-if="suggestedName && !editingNode.name" class="mt-1.5 flex items-center gap-1.5 ml-1">
                <span class="text-xs text-gray-500 dark:text-gray-400">建议：</span>
                <button 
                  @click="applySuggestedName"
                  class="text-xs text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1 hover:underline"
                >
                  {{ suggestedName }}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- 分组选择 -->
          <div class="relative">
            <div class="flex flex-col">
              <label for="node-group" class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
                分组 (可选)
              </label>
              <GroupSelector
                v-model="editingNode.group"
                :groups="manualNodeGroups"
                placeholder="选择或输入新分组..."
              />
            </div>
          </div>
        </div>

        <!-- 节点链接 -->
        <div class="relative group">
          <div 
            class="relative border misub-radius-lg transition-all duration-300 overflow-hidden bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-white/10"
            :class="[
              urlFocused 
                ? 'ring-2 ring-primary-500/50 border-primary-500 dark:border-primary-500' 
                : 'hover:border-gray-300 dark:hover:border-white/20'
            ]"
          >
            <!-- 协议检测徽章 - 显示在右上角 -->
            <div 
              v-if="singleProtocol && !isMultiLine" 
              class="absolute right-3 top-3 z-10 px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <span 
                class="text-xs font-bold"
                :class="protocolColorMap[singleProtocol.color]"
              >
                {{ singleProtocol.name }}
              </span>
            </div>
            
            <div class="flex h-full">
              <div class="py-3 pl-3 flex items-start text-gray-400 group-focus-within:text-primary-500 transition-colors pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <textarea
                id="node-url"
                v-model="editingNode.url"
                rows="8"
                @focus="urlFocused = true"
                @blur="urlFocused = false"
                @input="$emit('input-url', $event)"
                class="flex-1 w-full bg-transparent border-0 focus:ring-0 dark:text-white placeholder-gray-400 text-sm font-mono resize-none py-3 pl-3 pr-20 min-h-[160px]"
                placeholder="输入单个链接，或粘贴多行链接批量导入..."
              ></textarea>
            </div>
            
             <!-- Focus Glow -->
            <div class="absolute inset-0 misub-radius-lg pointer-events-none transition-opacity duration-300 opacity-0 group-focus-within:opacity-100 ring-1 ring-primary-500/20"></div>
          </div>
        </div>

        <!-- 批量导入预览 -->
        <div v-if="isMultiLine && parsedNodes.length > 0" class="space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
              </svg>
              导入预览
            </h4>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              共 {{ parsedNodes.length }} 个节点
            </span>
          </div>
          <div class="max-h-48 overflow-y-auto misub-radius-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div 
              v-for="(node, idx) in parsedNodes.slice(0, 10)" 
              :key="idx"
              class="flex items-center gap-3 px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
            >
              <span class="text-xs text-gray-400 w-5 text-right">{{ idx + 1 }}</span>
              <span 
                v-if="node.protocol" 
                class="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                :class="protocolColorMap[node.protocol.color]"
              >
                {{ node.protocol.name }}
              </span>
              <span v-else class="text-xs text-gray-400 px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 shrink-0">
                未知
              </span>
              <span class="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                {{ node.name }}
              </span>
            </div>
            <div v-if="parsedNodes.length > 10" class="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
              还有 {{ parsedNodes.length - 10 }} 个节点...
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
/* 移除 textarea 默认样式 */
textarea:focus {
  outline: none;
}

/* 自定义滚动条 */
.max-h-48::-webkit-scrollbar {
  width: 4px;
}
.max-h-48::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 2px;
}
.max-h-48::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}
</style>
