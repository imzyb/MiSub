// FILE: src/composables/useSubscriptions.js
import { ref, computed, watch } from 'vue';
import { fetchNodeCount } from '../lib/api.js';
import { useToast } from '../lib/stores.js';

export function useSubscriptions(initialSubsRef, markDirty) {
  const { showToast } = useToast();
  const subscriptions = ref([]);
  const subsCurrentPage = ref(1);
  const subsItemsPerPage = 3;

  // 【关键修正】: 将内部所有辅助函数从 'const' 改为 'function' 声明

  function initializeSubscriptions(subsData) {
    subscriptions.value = (subsData || []).map(sub => ({
      ...sub, id: crypto.randomUUID(), enabled: sub.enabled ?? true, nodeCount: sub.nodeCount || 0, isUpdating: false,
    }));
    subscriptions.value.forEach(sub => handleUpdateNodeCount(sub.id, true));
  }

  const enabledSubscriptions = computed(() => subscriptions.value.filter(s => s.enabled));
  const nodesFromSubs = computed(() =>
    enabledSubscriptions.value.reduce((acc, sub) => {
      const count = parseInt(sub.nodeCount, 10);
      return acc + (isNaN(count) ? 0 : count);
    }, 0)
  );
  const subsTotalPages = computed(() => Math.ceil(subscriptions.value.length / subsItemsPerPage));
  const paginatedSubscriptions = computed(() => {
    const start = (subsCurrentPage.value - 1) * subsItemsPerPage;
    const end = start + subsItemsPerPage;
    return subscriptions.value.slice(start, end);
  });

  function changeSubsPage(page) {
    if (page < 1 || page > subsTotalPages.value) return;
    subsCurrentPage.value = page;
  }

  async function handleUpdateNodeCount(subId, isInitialLoad = false) {
    const subToUpdate = subscriptions.value.find(s => s.id === subId);
    if (!subToUpdate || !subToUpdate.url.startsWith('http')) return;
    subToUpdate.isUpdating = true;
    try {
      const count = await fetchNodeCount(subToUpdate.url);
      subToUpdate.nodeCount = typeof count === 'number' ? count : 0;
      if (!isInitialLoad) {
        showToast(`${subToUpdate.name || '订阅'} 更新成功！`, 'success');
        markDirty();
      }
    } catch (error) {
      if (!isInitialLoad) showToast(`${subToUpdate.name || '订阅'} 更新失败`, 'error');
    } finally {
      subToUpdate.isUpdating = false;
    }
  }

  function addSubscription(sub) {
    subscriptions.value.unshift(sub);
    subsCurrentPage.value = 1;
    handleUpdateNodeCount(sub.id);
    markDirty();
  }

  function updateSubscription(updatedSub) {
    const index = subscriptions.value.findIndex(s => s.id === updatedSub.id);
    if (index !== -1) {
      if (subscriptions.value[index].url !== updatedSub.url) {
        updatedSub.nodeCount = 0;
        handleUpdateNodeCount(updatedSub.id);
      }
      subscriptions.value[index] = updatedSub;
      markDirty();
    }
  }

  function deleteSubscription(subId) {
    subscriptions.value = subscriptions.value.filter((s) => s.id !== subId);
    if (paginatedSubscriptions.value.length === 0 && subsCurrentPage.value > 1) {
      subsCurrentPage.value--;
    }
    markDirty();
  }

  function deleteAllSubscriptions() {
    subscriptions.value = [];
    subsCurrentPage.value = 1;
    markDirty();
  }

  watch(initialSubsRef, (newInitialSubs) => {
    initializeSubscriptions(newInitialSubs);
  }, { immediate: true, deep: true });

  return {
    subscriptions, subsCurrentPage, subsTotalPages, paginatedSubscriptions,
    nodesFromSubs, enabledSubscriptionsCount: computed(() => enabledSubscriptions.value.length),
    changeSubsPage, addSubscription, updateSubscription, deleteSubscription, deleteAllSubscriptions,
    handleUpdateNodeCount, // <-- 【关键修正】在这里加上它
  };
}