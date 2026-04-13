<script setup>
import { computed } from 'vue';
import { useVirtualScroll } from '@/composables/useVirtualScroll.js';

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

const nodesRef = computed(() => props.nodes);
const containerHeight = 500;
const itemHeight = 52;

const { containerRef, visibleItems, totalHeight, offsetY } = useVirtualScroll({
  items: nodesRef,
  itemHeight,
  containerHeight,
  overscan: 10
});

const handleRowClick = (node) => {
  if (props.selectionMode) {
    emit('toggle-select', node.url);
  }
};
</script>

<template>
  <div class="hidden lg:flex flex-1 overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
    <div ref="containerRef" class="h-full overflow-y-auto w-full">
      <div class="w-full px-4 py-3">
        <div class="w-full overflow-hidden rounded-xl border border-gray-200/70 dark:border-white/10">
          <!-- 表头 -->
          <div class="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/50 backdrop-blur-md dark:border-white/5 dark:bg-gray-800/80">
            <div class="grid min-h-[3.5rem] grid-cols-12 gap-2 px-6 py-3 items-center text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              <div v-if="selectionMode" class="col-span-1 flex justify-center text-indigo-500">Pick</div>
              <div :class="selectionMode ? 'col-span-3' : 'col-span-4'">Node Name</div>
              <div class="col-span-3 hidden sm:block">Server Address</div>
              <div class="col-span-2 hidden md:block text-center">Port</div>
              <div class="col-span-1 hidden sm:block text-center">Type</div>
              <div class="col-span-1 hidden sm:block text-center">Region</div>
              <div class="col-span-1 text-center">Action</div>
            </div>
          </div>

          <!-- 数据行 - 虚拟滚动 -->
          <div class="bg-white dark:bg-gray-800" :style="{ height: totalHeight + 'px', position: 'relative' }">
            <div :style="{ transform: `translateY(${offsetY}px)` }">
              <div
                v-for="node in visibleItems.items"
                :key="`${node.url}_${node._virtualIndex}`"
                @click="handleRowClick(node)"
                class="group border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-indigo-500/5 transition-all"
                :class="{ 'bg-indigo-50/30 dark:bg-indigo-500/10': selectionMode && selectedUrls.has(node.url), 'cursor-pointer': selectionMode }"
              >
                <div class="grid min-h-[3.5rem] grid-cols-12 gap-2 px-6 py-3 items-center">
                  <!-- Checkbox (Selection Mode Only) -->
                  <div v-if="selectionMode" class="col-span-1 flex justify-center">
                    <div class="w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-300"
                      :class="selectedUrls.has(node.url) ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/30 scale-110' : 'border-gray-200 dark:border-gray-700 group-hover:border-indigo-400'">
                      <svg v-if="selectedUrls.has(node.url)" class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>

                  <!-- 节点名称 -->
                  <div :class="selectionMode ? 'col-span-3' : 'col-span-4'">
                    <span class="text-sm font-bold text-gray-900 dark:text-white block overflow-hidden group-hover:text-indigo-600 transition-colors" :title="parseNodeInfo(node).name" style="text-overflow: ellipsis; white-space: nowrap;">
                      {{ parseNodeInfo(node).name }}
                    </span>
                  </div>

                  <!-- 服务器 (桌面端) -->
                  <div class="col-span-3 hidden sm:block">
                    <span class="text-[11px] text-gray-500 dark:text-gray-400 font-mono block overflow-hidden opacity-70 group-hover:opacity-100 transition-opacity" :title="parseNodeInfo(node).server" style="text-overflow: ellipsis; white-space: nowrap;">
                      {{ parseNodeInfo(node).server }}
                    </span>
                  </div>

                  <!-- 端口 (桌面端) -->
                  <div class="col-span-2 hidden md:block text-center">
                    <span class="text-xs font-bold text-gray-500 dark:text-gray-400 font-mono block opacity-70" style="min-width: 50px;">
                      {{ parseNodeInfo(node).port }}
                    </span>
                  </div>

                  <!-- 类型 (桌面端) -->
                  <div class="col-span-1 hidden sm:block flex justify-center">
                    <span
                      class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm"
                      :class="getProtocolStyle(parseNodeInfo(node).protocol)"
                      style="min-width: 64px;"
                    >
                      {{ parseNodeInfo(node).protocol }}
                    </span>
                  </div>

                  <!-- 地区 (桌面端) -->
                  <div class="col-span-1 hidden sm:block flex justify-center">
                    <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400" style="min-width: 60px;">
                      {{ parseNodeInfo(node).region }}
                    </span>
                  </div>

                  <!-- 操作 (所有设备) -->
                  <div class="col-span-1 flex justify-center">
                    <button
                      v-if="!selectionMode"
                      @click.stop="emit('copy', node, node.url)"
                      class="inline-flex items-center justify-center w-8 h-8 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-150"
                      :class="{ 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20': copiedNodeId === node.url }"
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

          <!-- 空状态 -->
          <div v-if="nodes.length === 0" class="py-12 text-center text-gray-500 dark:text-gray-400">
            暂无节点数据
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
