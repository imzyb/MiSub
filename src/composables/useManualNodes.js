// FILE: src/composables/useManualNodes.js
import { ref, computed, watch } from 'vue';

export function useManualNodes(initialNodesRef, markDirty) {
  const manualNodes = ref([]);
  const manualNodesCurrentPage = ref(1);
  const manualNodesPerPage = 24;

  // 【关键修正】: 将内部所有辅助函数从 'const' 改为 'function' 声明

  function initializeManualNodes(nodesData) {
    manualNodes.value = (nodesData || []).map(node => ({
      ...node, id: crypto.randomUUID(), enabled: node.enabled ?? true,
    }));
  }

  const manualNodesTotalPages = computed(() => Math.ceil(manualNodes.value.length / manualNodesPerPage));
  const paginatedManualNodes = computed(() => {
    const start = (manualNodesCurrentPage.value - 1) * manualNodesPerPage;
    const end = start + manualNodesPerPage;
    return manualNodes.value.slice(start, end);
  });
  const enabledManualNodes = computed(() => manualNodes.value.filter(n => n.enabled));

  function changeManualNodesPage(page) {
    if (page < 1 || page > manualNodesTotalPages.value) return;
    manualNodesCurrentPage.value = page;
  }

  function addNode(node) {
    manualNodes.value.unshift(node);
    manualNodesCurrentPage.value = 1;
    markDirty();
  }

  function updateNode(updatedNode) {
    const index = manualNodes.value.findIndex(n => n.id === updatedNode.id);
    if (index !== -1) {
      manualNodes.value[index] = updatedNode;
      markDirty();
    }
  }

  function deleteNode(nodeId) {
    manualNodes.value = manualNodes.value.filter(n => n.id !== nodeId);
    if (paginatedManualNodes.value.length === 0 && manualNodesCurrentPage.value > 1) {
      manualNodesCurrentPage.value--;
    }
    markDirty();
  }

  function deleteAllNodes() {
    manualNodes.value = [];
    manualNodesCurrentPage.value = 1;
    markDirty();
  }

  function addNodesFromBulk(nodes) {
    manualNodes.value.unshift(...nodes);
    markDirty();
  }

  watch(initialNodesRef, (newInitialNodes) => {
    initializeManualNodes(newInitialNodes);
  }, { immediate: true, deep: true });

  return {
    manualNodes, manualNodesCurrentPage, manualNodesTotalPages, paginatedManualNodes,
    enabledManualNodesCount: computed(() => enabledManualNodes.value.length),
    changeManualNodesPage, addNode, updateNode, deleteNode, // <-- 【最终修正】在这里加上它
    deleteAllNodes, addNodesFromBulk,
  };
}