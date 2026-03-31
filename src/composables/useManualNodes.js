// FILE: src/composables/useManualNodes.js
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useDataStore } from '../stores/useDataStore.js';
import { useToastStore } from '../stores/toast.js'; // Restored
import { extractNodeName, extractHostAndPort } from '../lib/utils.js';
import { pingNode } from '../utils/ping.js';
import { filterManualNodes, isManualNodeEntry } from './manual-nodes/filters.js';
import { buildDedupPlan as buildDedupPlanCore } from './manual-nodes/dedup.js';
import { buildAutoSortedSubscriptions } from './manual-nodes/sorting.js';
import { collectManualNodeGroups, buildGroupedManualNodes } from './manual-nodes/groups.js';

export function useManualNodes(markDirty) {
  const { showToast } = useToastStore();
  const dataStore = useDataStore();
  const { subscriptions: allSubscriptions } = storeToRefs(dataStore);

  // Manual Nodes are items in subscriptions that are NOT http/https
  // We filter from the shared store state
  // [FIX] 添加更严格的验证,确保只识别有效的手工节点
  const manualNodes = computed(() => {
    return (allSubscriptions.value || []).filter(isManualNodeEntry);
  });

  const manualNodesCurrentPage = ref(1);
  const manualNodesPerPage = ref(parseInt(localStorage.getItem('manualNodesPPS')) || 24);
  const searchTerm = ref('');

  watch(manualNodesPerPage, (newVal) => {
    localStorage.setItem('manualNodesPPS', newVal);
    manualNodesCurrentPage.value = 1;
  });

  const activeGroupFilter = ref(null); // null = all, or group name string

  const filteredManualNodes = computed(() => {
    return filterManualNodes(manualNodes.value, searchTerm.value, activeGroupFilter.value);
  });

  const manualNodesTotalPages = computed(() => {
    if (manualNodesPerPage.value === -1) return 1; // All
    return Math.ceil(filteredManualNodes.value.length / manualNodesPerPage.value);
  });

  const paginatedManualNodes = computed(() => {
    if (manualNodesPerPage.value === -1) return filteredManualNodes.value;
    const start = (manualNodesCurrentPage.value - 1) * manualNodesPerPage.value;
    const end = start + manualNodesPerPage.value;
    return filteredManualNodes.value.slice(start, end);
  });

  const enabledManualNodes = computed(() => manualNodes.value.filter(n => n.enabled));

  function changeManualNodesPage(page) {
    let p = parseInt(page);
    if (isNaN(p)) p = 1;
    if (p < 1) p = 1;
    if (p > manualNodesTotalPages.value) p = manualNodesTotalPages.value;
    manualNodesCurrentPage.value = p;
  }

  function setGroupFilter(group) {
    activeGroupFilter.value = group;
    manualNodesCurrentPage.value = 1; // Reset to page 1
  }

  function batchUpdateGroup(nodeIds, groupName) {
    if (!nodeIds || nodeIds.length === 0) return;
    const idsSet = new Set(nodeIds);
    const updates = manualNodes.value
      .filter(n => idsSet.has(n.id))
      .map(n => {
        // Only update if changed
        if (n.group === groupName) return null;
        return { id: n.id, updates: { ...n, group: groupName } };
      })
      .filter(u => u);

    if (updates.length > 0) {
      updates.forEach(({ id, updates }) => {
        dataStore.updateSubscription(id, updates);
      });
      markDirty();
      showToast(`已将 ${updates.length} 个节点移动到分组 ${groupName || '默认'}`, 'success');
    }
  }

  function batchDeleteNodes(nodeIds) {
    if (!nodeIds || nodeIds.length === 0) return;
    // Confirmation moved to UI layer

    nodeIds.forEach(id => {
      dataStore.removeSubscription(id);
    });
    // 清理组合订阅中对这些节点的引用
    dataStore.removeManualNodeFromProfiles(nodeIds);

    // Adjust pagination if needed
    if (paginatedManualNodes.value.length === 0 && manualNodesCurrentPage.value > 1) {
      manualNodesCurrentPage.value--;
    }

    markDirty();
    showToast(`已删除 ${nodeIds.length} 个节点`, 'success');
  }

  function addNode(node) {
    if (!node.name) {
      node.name = extractNodeName(node.url);
    }
    // Add to shared store
    dataStore.addSubscription(node);
    manualNodesCurrentPage.value = 1;
    markDirty();
  }

  function updateNode(updatedNode) {
    // Update in shared store
    dataStore.updateSubscription(updatedNode.id, updatedNode);
    markDirty();
  }

  function deleteNode(nodeId) {
    dataStore.removeSubscription(nodeId);
    // 清理组合订阅中对该节点的引用
    dataStore.removeManualNodeFromProfiles(nodeId);
    if (paginatedManualNodes.value.length === 0 && manualNodesCurrentPage.value > 1) {
      manualNodesCurrentPage.value--;
    }
    markDirty();
  }

  function deleteAllNodes() {
    // Only remove proper manual nodes (not subscriptions)
    const idsToRemove = manualNodes.value.map(n => n.id);

    // 如果没有节点，提示并返回
    if (idsToRemove.length === 0) {
      showToast('没有可删除的节点', 'info');
      return;
    }

    idsToRemove.forEach(id => dataStore.removeSubscription(id));
    // 清理组合订阅中对这些节点的引用
    dataStore.removeManualNodeFromProfiles(idsToRemove);

    manualNodesCurrentPage.value = 1;
    markDirty();
    showToast(`已清空 ${idsToRemove.length} 个节点`, 'success');
  }

  function addNodesFromBulk(nodes, groupName = '') {
    // Reverse insert so they appear in correct order when unshifted
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = { ...nodes[i] };
      if (groupName) {
        node.group = groupName;
      }
      dataStore.addSubscription(node);
    }
    markDirty();
  }

  const buildDedupPlan = () => buildDedupPlanCore(manualNodes.value);

  function applyDedupPlan(plan) {
    if (!plan || !plan.removeNodes || plan.removeNodes.length === 0) {
      showToast('没有发现重复的节点。', 'info');
      return;
    }

    plan.removeNodes.forEach(node => dataStore.removeSubscription(node.id));
    showToast(`成功移除 ${plan.removeNodes.length} 个重复节点，请记得保存。`, 'success');
    markDirty();
    manualNodesCurrentPage.value = 1;
  }

  function deduplicateNodes() {
    const plan = buildDedupPlan();
    applyDedupPlan(plan);
  }

  function autoSortNodes() {
    // Sort logic requires replacing the list.
    // Since manual nodes are part of a larger list (subscriptions), we need to extract them, sort them, 
    // and then potentially re-insert them or just update their order relative to themselves?
    // The store's 'subscriptions' array is mixed.
    // If we want to sort ONLY manual nodes but keep subscriptions in place... 
    // It's complex because we don't track indices separately easily.
    // Approach: Extract all Manual Nodes, Sort them, Extract all Subscriptions (keep order),
    // Then Combine: [Subscriptions..., SortedManualNodes...]
    // This effectively moves all manual nodes to the bottom. This is acceptable/expected behavior.

    const mergedList = buildAutoSortedSubscriptions(allSubscriptions.value || [], manualNodes.value);

    // Update store with new order: Manual Nodes first, then Subscriptions
    dataStore.overwriteSubscriptions(mergedList);

    manualNodesCurrentPage.value = 1;
    markDirty();
  }

  watch(searchTerm, (newValue, oldValue) => {
    if (newValue !== oldValue) {
      manualNodesCurrentPage.value = 1;
    }
  });

  function reorderManualNodes(newOrder) {
    // 1. Get all Subscriptions (to preserve them)
    const currentSubscriptions = (allSubscriptions.value || []).filter(item => item.url && /^https?:\/\//.test(item.url));

    // 2. Combine Existing Subscriptions + New Ordered Manual Nodes
    // Logic: Manual Nodes at top, Subscriptions at bottom
    const mergedList = [...newOrder, ...currentSubscriptions];

    // 3. Update Store
    dataStore.overwriteSubscriptions(mergedList);

    // 4. Mark Dirty
    markDirty();
  }

  const manualNodeGroups = computed(() => collectManualNodeGroups(manualNodes.value));

  const groupedManualNodes = computed(() => {
    return buildGroupedManualNodes(filteredManualNodes.value, manualNodeGroups.value);
  });

  function renameGroup(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;

    const nodesInGroup = manualNodes.value.filter(n => n.group === oldName);
    nodesInGroup.forEach(node => {
      dataStore.updateSubscription(node.id, { ...node, group: newName });
    });
    markDirty();
  }

  function deleteGroup(groupName) {
    if (!groupName) return;
    // Ungroup nodes (move to default)
    const nodesInGroup = manualNodes.value.filter(n => n.group === groupName);
    nodesInGroup.forEach(node => {
      // Creating a copy logic is safe here as updateSubscription handles it
      const { group, ...rest } = node;
      dataStore.updateSubscription(node.id, { ...rest, group: '' }); // Set to empty string or remove property
    });
    markDirty();
  }

  // --- 连通性测试 (Ping) ---
  const pingResults = ref({}); // { [nodeId]: { status: 'ok'|'error'|'timeout', latency: 120 } }
  const pingingNodes = ref(new Set());

  async function pingNodeId(nodeId) {
      if (pingingNodes.value.has(nodeId)) return;
      const node = manualNodes.value.find(n => n.id === nodeId);
      if (!node) return;
  
      const { host, port } = extractHostAndPort(node.url);
      if (!host || !port) {
          pingResults.value[nodeId] = { status: 'error', latency: -1, message: '解析地址失败' };
          return;
      }
  
      pingingNodes.value.add(nodeId);
      pingResults.value = { ...pingResults.value, [nodeId]: { status: 'loading', latency: 0 } };
  
      try {
          // 由于 fetch ping 主要看 tcp 连通性，给个 3000ms 兜底即可
          const result = await pingNode(host, port, 3000);
          pingResults.value = { ...pingResults.value, [nodeId]: result };
      } catch(e) {
          pingResults.value = { ...pingResults.value, [nodeId]: { status: 'error', latency: -1 } };
      } finally {
          pingingNodes.value.delete(nodeId);
      }
  }

  // 批量并发测试所有开启的手动节点
  async function pingAllNodes() {
      const nodesToTest = enabledManualNodes.value.map(n => n.id);
      if (nodesToTest.length === 0) return;
      
      showToast(`开始测速 ${nodesToTest.length} 个节点...`, 'info');
      
      // 控制并发数 (比如最大 10 并发)
      const CONCURRENCY = 10;
      let currentIndex = 0;
      
      const workers = Array(Math.min(CONCURRENCY, nodesToTest.length)).fill(null).map(async () => {
          while (currentIndex < nodesToTest.length) {
              const idx = currentIndex++;
              const nodeId = nodesToTest[idx];
              await pingNodeId(nodeId);
          }
      });
      
      await Promise.allSettled(workers);
      showToast(`已完成 ${nodesToTest.length} 个节点的连通性测试`, 'success');
  }

  return {
    manualNodes, // Returns computed filtered list
    manualNodeGroups,
    groupedManualNodes,
    manualNodesCurrentPage,
    manualNodesTotalPages,
    paginatedManualNodes,
    enabledManualNodesCount: computed(() => enabledManualNodes.value.length),
    searchTerm,
    activeGroupFilter, // New
    changeManualNodesPage,
    addNode,
    updateNode,
    deleteNode,
    deleteAllNodes,
    addNodesFromBulk,
    autoSortNodes,
    deduplicateNodes,
    buildDedupPlan,
    applyDedupPlan,
    reorderManualNodes, // Added
    renameGroup,
    deleteGroup,
    setGroupFilter, // New
    batchUpdateGroup, // New
    batchDeleteNodes, // New
    manualNodesPerPage, // Added
    pingResults,
    pingingNodes,
    pingNodeId,
    pingAllNodes
  };
}
