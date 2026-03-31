/**
 * 节点预览主容器组件
 * @author MiSub Team
 */

<script setup>
import { ref, computed, onMounted } from 'vue';

// 子组件
import NodePreviewHeader from './NodePreviewHeader.vue';
import NodeFilterControls from './NodeFilterControls.vue';
import NodeListView from './NodeListView.vue';
import NodeCardView from './NodeCardView.vue';
import NodePagination from './NodePagination.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import EmptyState from './EmptyState.vue';

// Composables
import { useNodePreview } from '@/composables/useNodePreview.js';

const props = defineProps({
  show: Boolean,
  subscriptionId: String,
  subscriptionName: String,
  subscriptionUrl: String,
  profileId: String,
  profileName: String,
});

const emit = defineEmits(['update:show']);

// 使用节点预览的composable
const {
  loading,
  error,
  allNodes,
  filteredNodes,
  protocolStats,
  regionStats,
  availableProtocols,
  availableRegions,
  currentPage,
  pageSize,
  totalPages,
  paginatedNodes,
  protocolFilter,
  regionFilter,
  searchQuery,
  viewMode,
  effectiveViewMode,
  title,
  loadNodes,
  resetFilters,
  copyNodeUrl,
  copiedNodeId,
  nextPage,
  prevPage,
  goToPage,
  updateViewMode
} = useNodePreview(props);

// 处理关闭
const handleClose = () => {
  emit('update:show', false);
};

// 自动加载数据
onMounted(() => {
  if (props.show) {
    loadNodes();
  }
});
</script>

<template>
  <!-- 主模态框 -->
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    :class="{ 'bg-black bg-opacity-50': show }"
    @click.self="handleClose"
  >
    <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
      <div class="relative transform overflow-hidden misub-radius-md bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-6xl">

        <!-- 头部 -->
        <NodePreviewHeader
          :title="title"
          :total-nodes="allNodes.length"
          :filtered-nodes="filteredNodes.length"
          @close="handleClose"
        />

        <!-- 主体内容 -->
        <div class="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:p-6 sm:pt-4">

          <!-- 过滤控件 -->
          <NodeFilterControls
            :loading="loading"
            :protocol-filter="protocolFilter"
            :region-filter="regionFilter"
            :search-query="searchQuery"
            :view-mode="viewMode"
            :effective-view-mode="effectiveViewMode"
            :available-protocols="availableProtocols"
            :available-regions="availableRegions"
            :protocol-stats="protocolStats"
            :region-stats="regionStats"
            @update:protocol-filter="val => protocolFilter = val"
            @update:region-filter="val => regionFilter = val"
            @update:search-query="val => searchQuery = val"
            @update:view-mode="updateViewMode"
            @reset="resetFilters"
            @refresh="loadNodes"
          />

          <!-- 加载状态 -->
          <LoadingSpinner v-if="loading" />

          <!-- 错误状态 -->
          <div v-else-if="error" class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="text-red-500 text-lg font-medium mb-2">加载失败</div>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ error }}</p>
              <button
                @click="loadNodes"
                class="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm misub-radius-md transition-colors"
              >
                重试
              </button>
            </div>
          </div>

          <!-- 无数据状态 -->
          <EmptyState
            v-else-if="paginatedNodes.length === 0 && !loading"
            :filtered-count="filteredNodes.length"
            :total-count="allNodes.length"
            @reset="resetFilters"
            @refresh="loadNodes"
          />

          <!-- 节点列表/卡片视图 -->
          <div v-else class="h-full flex flex-col">
            <!-- 简洁列表视图 (仅大屏桌面端) -->
            <NodeListView
              v-if="effectiveViewMode === 'list'"
              :nodes="paginatedNodes"
              :copied-node-id="copiedNodeId"
              @copy="copyNodeUrl"
            />

            <!-- 卡片视图 (移动端和平板端) -->
            <NodeCardView
              v-else
              :nodes="paginatedNodes"
              :copied-node-id="copiedNodeId"
              @copy="copyNodeUrl"
            />

            <!-- 分页控件 -->
            <NodePagination
              v-if="totalPages > 1"
              :current-page="currentPage"
              :total-pages="totalPages"
              :total-items="filteredNodes.length"
              :page-size="pageSize"
              @next="nextPage"
              @prev="prevPage"
              @go-to-page="goToPage"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
