<script setup>
import { computed } from 'vue';
import draggable from 'vuedraggable';
import ManualNodeCard from '../ManualNodeCard.vue';
import ManualNodeList from '../ManualNodeList.vue';
import PanelPagination from '@/components/shared/PanelPagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const props = defineProps({
  manualNodes: { type: Array, default: () => [] },
  paginatedNodes: { type: Array, default: () => [] },
  filteredNodes: { type: Array, default: () => [] },
  localSearchTerm: { type: String, default: '' },
  isSorting: { type: Boolean, default: false },
  viewMode: { type: String, default: 'card' },
  isSelectionMode: { type: Boolean, default: false },
  selectedNodeIds: { type: Object, required: true },
  searchPage: { type: Number, default: 1 },
  searchTotalPages: { type: Number, default: 1 },
  basePage: { type: Number, default: 1 },
  baseTotalPages: { type: Number, default: 1 },
  draggableManualNodes: { type: Array, default: () => [] },
  itemsPerPage: { type: Number, default: 24 }, // Added
  pingResults: { type: Object, default: () => ({}) },
  pingingNodes: { type: Object, default: () => new Set() }
});

const emit = defineEmits([
  'update:draggableManualNodes',
  'toggle-select',
  'edit',
  'delete',
  'sort-end',
  'change-page',
  'update:itemsPerPage', // Added
  'set-group-filter', // Added
  'ping'
]);

const draggableModel = computed({
  get: () => props.draggableManualNodes,
  set: (val) => emit('update:draggableManualNodes', val)
});

const displayPage = computed(() => (props.localSearchTerm ? props.searchPage : props.basePage));
const displayTotalPages = computed(() => (props.localSearchTerm ? props.searchTotalPages : props.baseTotalPages));

const handleChangePage = (page) => {
  let p = parseInt(page, 10);
  if (isNaN(p)) return;
  // Let parent handle boundaries if needed, but safe to clamp here for UI feedback
  if (p < 1) p = 1;
  if (p > displayTotalPages.value) p = displayTotalPages.value;
  emit('change-page', p);
};
</script>

<template>
  <div v-if="manualNodes.length > 0" :class="{ 'pb-48': isSelectionMode }">
    <!-- 如果有搜索词，显示搜索提示 -->
    <div v-if="localSearchTerm && filteredNodes.length === 0" class="text-center py-8 text-gray-500">
      <p>没有找到包含 "{{ localSearchTerm }}" 的节点</p>
    </div>
    
    <div v-if="isSorting">
      <!-- 排序模式保持原有扁平列表，方便跨组排序 -->
      <div v-if="viewMode === 'card'">
        <draggable 
          tag="div" 
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4" 
          v-model="draggableModel" 
          item-key="id" 
          animation="300" 
          @end="emit('sort-end')"
        >
          <template #item="{ element: node }">
            <div class="cursor-move">
              <ManualNodeCard 
                :node="node" 
                :is-selection-mode="isSelectionMode"
                :is-selected="selectedNodeIds.has(node.id)"
                :ping-result="pingResults[node.id]"
                :is-pinging="pingingNodes.has(node.id)"
                @toggle-select="emit('toggle-select', node.id)"
                @edit="emit('edit', node.id)" 
                @delete="emit('delete', node.id)"
                @filter-group="emit('set-group-filter', $event)"
                @ping="emit('ping', node.id)" />
            </div>
          </template>
        </draggable>
      </div>
      <div v-else class="space-y-3">
        <draggable 
          tag="div" 
          class="space-y-2" 
          v-model="draggableModel" 
          item-key="id" 
          animation="300" 
          @end="emit('sort-end')"
        >
          <template #item="{ element: node, index }">
            <div class="cursor-move">
              <ManualNodeList
                :node="node"
                :index="index + 1"
                class="list-item-animation"
                :style="{ '--delay-index': Math.min(index, 20) }"
                :ping-result="pingResults[node.id]"
                :is-pinging="pingingNodes.has(node.id)"
                @edit="emit('edit', node.id)"
                @delete="emit('delete', node.id)"
                @filter-group="emit('set-group-filter', $event)"
                @ping="emit('ping', node.id)"
              />
            </div>
          </template>
        </draggable>
      </div>
    </div>

    <div v-else>
      <!-- Flat List Display (No Groups) -->
      <div v-if="viewMode === 'card'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
        <div 
          v-for="(node, index) in paginatedNodes" 
          :key="node.id"
          class="list-item-animation"
          :style="{ '--delay-index': Math.min(index, 20) }"
        >
          <ManualNodeCard 
            :node="node" 
            :is-selection-mode="isSelectionMode"
            :is-selected="selectedNodeIds.has(node.id)"
            :ping-result="pingResults[node.id]"
            :is-pinging="pingingNodes.has(node.id)"
            @toggle-select="emit('toggle-select', node.id)"
            @edit="emit('edit', node.id)" 
            @delete="emit('delete', node.id)" 
            @filter-group="emit('set-group-filter', $event)" 
            @ping="emit('ping', node.id)"
          />
        </div>
      </div>
      <div v-else class="space-y-3">
        <ManualNodeList
          v-for="(node, index) in paginatedNodes"
          :key="node.id"
          :node="node"
          :index="paginatedNodes.indexOf(node) + 1" 
          class="list-item-animation"
          :style="{ '--delay-index': Math.min(index, 20) }"
          :is-selection-mode="isSelectionMode"
          :is-selected="selectedNodeIds.has(node.id)"
          :ping-result="pingResults[node.id]"
          :is-pinging="pingingNodes.has(node.id)"
          @toggle-select="emit('toggle-select', node.id)"
          @edit="emit('edit', node.id)"
          @delete="emit('delete', node.id)"
          @filter-group="emit('set-group-filter', $event)"
          @ping="emit('ping', node.id)"
        />
      </div>
    </div>
    
    <PanelPagination
      variant="panel"
      :current-page="displayPage"
      :total-pages="displayTotalPages"
      :total-items="filteredNodes.length"
      :items-per-page="itemsPerPage"
      :show-items-per-page="true"
      :show-total-items="true"
      @change-page="handleChangePage"
      @update:items-per-page="emit('update:itemsPerPage', $event)"
    />
  </div>
  <div v-else class="py-6 border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/50 misub-radius-lg">
    <EmptyState 
      title="没有手动节点" 
      description="添加分享链接或单个节点。" 
      icon="node" 
      :total-count="0" 
    />
  </div>
</template>

<style scoped>
.cursor-move {
  cursor: move;
}
</style>
