<script setup>
const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  copiedNodeId: {
    type: String,
    default: ''
  },
  parseNodeInfo: {
    type: Function,
    required: true
  },
  getProtocolStyle: {
    type: Function,
    required: true
  },
  // [New] Selection Mode Props
  selectionMode: {
    type: Boolean,
    default: false
  },
  selectedUrls: {
    type: Set,
    default: () => new Set()
  }
});

const emit = defineEmits(['copy', 'toggle-select']);

const handleCardClick = (node) => {
  if (props.selectionMode) {
    emit('toggle-select', node.url);
  }
};
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto">
    <!-- 移动端 Mini List-Card 视图 -->
    <div class="block space-y-3 lg:hidden">
      <div 
        v-for="(node, index) in nodes" 
        :key="`${node.url}_${index}`"
        @click="handleCardClick(node)"
        class="flex items-center justify-between rounded-xl border border-gray-200/70 bg-white p-4 shadow-sm transition-colors dark:border-white/10 dark:bg-white/5"
        :class="{ 
          'bg-indigo-50/50 dark:bg-indigo-900/20': selectionMode && selectedUrls.has(node.url),
          'cursor-pointer active:bg-gray-50 dark:active:bg-gray-700': selectionMode
        }"
      >
        <!-- 左侧：图标与信息 -->
        <div class="flex items-center gap-3 flex-1 min-w-0 pr-2">
          <!-- Selection Checkbox (Visible only in selection mode) -->
          <div v-if="selectionMode" class="flex-shrink-0">
            <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
              :class="selectedUrls.has(node.url) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'">
              <svg v-if="selectedUrls.has(node.url)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {{ parseNodeInfo(node).name }}
              </span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span
                class="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold"
                :class="getProtocolStyle(parseNodeInfo(node).protocol)"
              >
                {{ parseNodeInfo(node).protocol }}
              </span>
               <span class="truncate text-[10px] text-gray-400 dark:text-gray-500">
                 {{ parseNodeInfo(node).server }}:{{ parseNodeInfo(node).port }}
               </span>
            </div>
          </div>
        </div>

        <!-- 右侧：操作按钮 (Hide in selection mode to avoid confusion) -->
        <button
          v-if="!selectionMode"
          @click.stop="emit('copy', node, node.url)"
          class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 transition-colors active:bg-indigo-50 active:text-indigo-600 dark:bg-gray-700/50"
          :class="{ 'text-green-600 bg-green-50': copiedNodeId === node.url }"
        >
          <svg v-if="copiedNodeId !== node.url" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V5a2 2 0 012-2h4.586"></path>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 桌面端 Bento Grid 卡片视图 -->
    <div class="hidden gap-4 p-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="(node, index) in nodes"
        :key="`${node.url}_${index}`"
        @click="handleCardClick(node)"
        class="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 group transition-all duration-300"
        :class="[
          selectionMode ? 'cursor-pointer' : '',
          selectionMode && selectedUrls.has(node.url) 
            ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50/30 dark:bg-indigo-900/10' 
            : 'hover:shadow-xl hover:translate-y-[-2px] hover:border-indigo-200 dark:hover:border-indigo-500/50'
        ]"
      >
        <!-- Selection Badge -->
        <div v-if="selectionMode" class="absolute top-4 right-4 animate-scale-in">
          <div class="w-6 h-6 rounded-full flex items-center justify-center transition-all"
            :class="selectedUrls.has(node.url) ? 'bg-indigo-600' : 'bg-gray-100 dark:bg-gray-700'">
            <svg v-if="selectedUrls.has(node.url)" class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div class="flex flex-col h-full">
          <!-- 节点名称和协议标签 -->
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="min-w-0 flex-1">
              <h4 class="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                {{ parseNodeInfo(node).name }}
              </h4>
              <div class="flex flex-wrap gap-2 mt-2">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase"
                  :class="getProtocolStyle(parseNodeInfo(node).protocol)"
                >
                  {{ parseNodeInfo(node).protocol }}
                </span>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {{ parseNodeInfo(node).region || '未知地区' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 服务器信息 (Bento Style) -->
          <div class="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50">
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <div class="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5 font-medium uppercase tracking-tighter">Endpoint</div>
                <div class="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">
                  {{ parseNodeInfo(node).server }}:{{ parseNodeInfo(node).port }}
                </div>
              </div>
              
              <!-- 复制按钮 (Floating when hovered, only in non-selection mode) -->
              <button
                v-if="!selectionMode"
                @click.stop="emit('copy', node, node.url)"
                class="opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-indigo-600 hover:text-white transition-all transform scale-90 group-hover:scale-100"
                :class="{ 'opacity-100 bg-green-500 text-white': copiedNodeId === node.url }"
              >
                <svg v-if="copiedNodeId !== node.url" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
</style>
