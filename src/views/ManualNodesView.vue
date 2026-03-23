<script setup>
import { ref, defineAsyncComponent } from 'vue';
import { useDataStore } from '../stores/useDataStore.js';
import { useManualNodes } from '../composables/useManualNodes.js';
import { useNodeForms } from '../composables/useNodeForms.js'; // Added
import { useToastStore } from '../stores/toast.js';
import { extractNodeName } from '../lib/utils.js';
import ManualNodePanel from '../components/nodes/ManualNodePanel.vue';
import Modal from '../components/forms/Modal.vue';
import ManualNodeEditModal from '../components/modals/ManualNodeEditModal.vue';
import ManualNodeDedupModal from '../components/modals/ManualNodeDedupModal.vue';
import SubscriptionImportModal from '../components/modals/SubscriptionImportModal.vue';
import BatchGroupModal from '../components/modals/BatchGroupModal.vue'; // Added

const dataStore = useDataStore();
const { showToast } = useToastStore();
const { markDirty } = dataStore;

// Component Logic Reuse
const isSortingNodes = ref(false);
const manualNodeViewMode = ref(localStorage.getItem('manualNodeViewMode') || 'card');
const showDeleteNodesModal = ref(false);
const showBatchDeleteModal = ref(false);
const batchDeleteIds = ref([]);
const showSubscriptionImportModal = ref(false);
const showDedupModal = ref(false);
const dedupPlan = ref(null);
const showBatchGroupModal = ref(false); // Added
const batchGroupIds = ref([]); // Added

const {
  manualNodes, manualNodesCurrentPage, manualNodesTotalPages, paginatedManualNodes, searchTerm,
  changeManualNodesPage, addNode, updateNode, deleteNode, deleteAllNodes,
  addNodesFromBulk, autoSortNodes, deduplicateNodes, buildDedupPlan, applyDedupPlan,
  reorderManualNodes,
  manualNodeGroups, renameGroup, deleteGroup,
  activeGroupFilter, setGroupFilter, batchUpdateGroup, batchDeleteNodes,
  manualNodesPerPage,
  pingResults, pingingNodes, pingNodeId, pingAllNodes
} = useManualNodes(markDirty);

const {
  showModal: showNodeModal,
  isNew: isNewNode,
  editingNode,
  openAdd: handleAddNode,
  openEdit: handleEditNode,
  handleUrlInput: handleNodeUrlInput,
  handleSave: handleSaveNode
} = useNodeForms({ addNode, updateNode });

// Actions
const setViewMode = (mode) => {
  manualNodeViewMode.value = mode;
  localStorage.setItem('manualNodeViewMode', mode);
};

const handleDeleteNodeWithCleanup = (nodeId) => {
  deleteNode(nodeId);
  // cleanupNodes 已在 deleteNode 内部通过 removeManualNodeFromProfiles 实现
};

const handleDeleteAllNodesWithCleanup = () => {
  deleteAllNodes();
  // cleanupAllNodes 已在 deleteAllNodes 内部通过 removeManualNodeFromProfiles 实现
  showDeleteNodesModal.value = false;
};

const handleAutoSortNodes = () => {
  autoSortNodes();
  showToast('已按地区排序，请手动保存', 'success');
};

const handleDeduplicateNodes = () => {
  const plan = buildDedupPlan();
  if (!plan || plan.removeCount === 0) {
    showToast('没有发现重复的节点。', 'info');
    return;
  }
  dedupPlan.value = plan;
  showDedupModal.value = true;
};

// Old Handlers Removed

const handleOpenBatchGroupModal = (ids) => {
  batchGroupIds.value = ids;
  showBatchGroupModal.value = true;
};

const handleBatchGroupConfirm = (groupName) => {
  batchUpdateGroup(batchGroupIds.value, groupName);
  batchGroupIds.value = [];
  // Ideally we should also clear selection in ManualNodePanel, but we don't have direct access.
  // We can emit an event or use a ref, but ManualNodePanel handles selection internally.
  // Actually, ManualNodePanel.vue creates its own `selectedNodeIds`.
  // If we want to clear selection, we need to force re-render or expose a method.
  // But for now, let's just do the update. User can clear selection manually.
  // OR we can improve ManualNodePanel to clear selection when `batch-update-group` is done?
  // But here we are calling `batchUpdateGroup` composable directly.
  // Let's modify ManualNodePanel later if needed.
};

const handleBatchDeleteRequest = (ids) => {
  if (ids && ids.length > 0) {
    batchDeleteIds.value = ids;
    showBatchDeleteModal.value = true;
  }
};

const confirmBatchDelete = () => {
  batchDeleteNodes(batchDeleteIds.value);
  batchDeleteIds.value = [];
  showBatchDeleteModal.value = false;
};

</script>

<template>
  <div class="max-w-(--breakpoint-xl) mx-auto">


    <ManualNodePanel :manual-nodes="manualNodes" :paginated-manual-nodes="paginatedManualNodes"
      :current-page="manualNodesCurrentPage" :total-pages="manualNodesTotalPages" :is-sorting="isSortingNodes"
      :search-term="searchTerm" :view-mode="manualNodeViewMode" :groups="manualNodeGroups"
      :active-group-filter="activeGroupFilter" :items-per-page="manualNodesPerPage"
      @update:items-per-page="val => manualNodesPerPage = val"
      @add="handleAddNode" @delete="handleDeleteNodeWithCleanup"
      @edit="(id) => handleEditNode(manualNodes.find(n => n.id === id))" @change-page="changeManualNodesPage"
      @update:search-term="newVal => searchTerm.value = newVal" @update:view-mode="setViewMode"
      @toggle-sort="isSortingNodes = !isSortingNodes" @mark-dirty="markDirty" @auto-sort="handleAutoSortNodes"
      @deduplicate="handleDeduplicateNodes" @import="showSubscriptionImportModal = true"
      @delete-all="showDeleteNodesModal = true" @reorder="reorderManualNodes" @rename-group="renameGroup"
      @set-group-filter="setGroupFilter"
      @batch-update-group="(ids, group) => batchUpdateGroup(ids, group)"
      @batch-delete-nodes="handleBatchDeleteRequest"
      @open-batch-group-modal="handleOpenBatchGroupModal"
      :ping-results="pingResults"
      :pinging-nodes="pingingNodes"
      @ping="pingNodeId"
      @ping-all="pingAllNodes"
    />

    <ManualNodeEditModal v-model:show="showNodeModal" :is-new="isNewNode" :editing-node="editingNode"
      @confirm="handleSaveNode" @input-url="handleNodeUrlInput" />
    <ManualNodeDedupModal v-model:show="showDedupModal" :plan="dedupPlan"
      @confirm="applyDedupPlan(dedupPlan); showDedupModal = false; dedupPlan = null" />
    
    <BatchGroupModal v-model:show="showBatchGroupModal" :groups="manualNodeGroups" @confirm="handleBatchGroupConfirm" />

    <Modal v-model:show="showDeleteNodesModal" @confirm="handleDeleteAllNodesWithCleanup">
      <template #title>
        <h3 class="text-lg font-bold text-red-500">确认清空节点</h3>
      </template>
      <template #body>
        <p class="text-sm text-gray-400">您确定要删除所有**手动节点**吗？</p>
      </template>
    </Modal>

    <Modal v-model:show="showBatchDeleteModal" @confirm="confirmBatchDelete">
      <template #title>
        <h3 class="text-lg font-bold text-red-500">确认批量删除</h3>
      </template>
      <template #body>
        <p class="text-sm text-gray-600 dark:text-gray-300">您确定要删除选中的 <span class="font-bold border-b border-red-500">{{
          batchDeleteIds.length }}</span> 个节点吗？此操作不可恢复。</p>
      </template>
    </Modal>

    <SubscriptionImportModal :show="showSubscriptionImportModal" @update:show="showSubscriptionImportModal = $event"
      :add-nodes-from-bulk="addNodesFromBulk" :groups="manualNodeGroups" />
  </div>
</template>
