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
  }
});

const emit = defineEmits(['copy']);
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <!-- 移动端 Mini List-Card 视图 -->
    <div class="block lg:hidden">
      <div 
        v-for="(node, index) in nodes" 
        :key="`${node.url}_${index}`"
        class="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
        style="height: 64px;"
      >
        <!-- 左侧：图标与信息 -->
        <div class="flex items-center gap-3 flex-1 min-w-0 pr-2">
          <!-- 中间：名称与标签 -->
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-gray-900 dark:text-white truncate">
                {{ parseNodeInfo(node).name }}
              </span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span
                class="text-[10px] bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded uppercase font-bold"
                :class="getProtocolStyle(parseNodeInfo(node).protocol)"
              >
                {{ parseNodeInfo(node).protocol }}
              </span>
              <span class="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                {{ parseNodeInfo(node).server }}
              </span>
            </div>
          </div>
        </div>

        <!-- 右侧：操作按钮 -->
        <button
          @click="emit('copy', node, node.url)"
          class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-gray-50 dark:bg-gray-700/50 text-gray-400 active:bg-indigo-50 active:text-indigo-600"
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

    <!-- 桌面端常规卡片视图 -->
    <div class="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-1">
      <div
        v-for="(node, index) in nodes"
        :key="`${node.url}_${index}`"
        class="bg-white dark:bg-gray-700 misub-radius-md border border-gray-200 dark:border-gray-600 p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <!-- 节点名称和协议标签 -->
            <div class="flex items-center gap-2 mb-2">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ parseNodeInfo(node).name }}
              </h4>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="getProtocolStyle(parseNodeInfo(node).protocol)"
              >
                {{ parseNodeInfo(node).protocol.toUpperCase() }}
              </span>
            </div>

            <!-- 地区标签 -->
            <div class="mb-2">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {{ parseNodeInfo(node).region }}
              </span>
            </div>

            <!-- 服务器信息 -->
            <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div class="font-mono truncate">{{ parseNodeInfo(node).server }}</div>
              <div class="font-mono">端口: {{ parseNodeInfo(node).port }}</div>
            </div>
          </div>

          <!-- 复制按钮 -->
          <button
            @click="emit('copy', node, node.url)"
            class="flex-shrink-0 p-2 misub-radius-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"
            :class="{ 'bg-green-100 dark:bg-green-900': copiedNodeId === node.url }"
          >
            <svg
              v-if="copiedNodeId !== node.url"
              class="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <svg
              v-else
              class="w-4 h-4 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
