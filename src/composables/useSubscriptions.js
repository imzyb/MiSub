// FILE: src/composables/useSubscriptions.js
import { ref, computed, watch } from 'vue';
import { fetchNodeCount, batchUpdateNodes } from '../lib/api.js';
import { useToastStore } from '../stores/toast.js';

export function useSubscriptions(initialSubsRef, markDirty) {
  const { showToast } = useToastStore();
  const subscriptions = ref([]);
  const subsCurrentPage = ref(1);
  const subsItemsPerPage = 6;

  function initializeSubscriptions(subsData) {
    subscriptions.value = (subsData || []).map(sub => ({
      ...sub,
      id: sub.id || crypto.randomUUID(),
      enabled: sub.enabled ?? true,
      nodeCount: sub.nodeCount || 0,
      isUpdating: false,
      userInfo: sub.userInfo || null,
      exclude: sub.exclude || '', // 新增 exclude 属性
    }));
    // [最終修正] 移除此處的自動更新迴圈，以防止本地開發伺服器因併發請求過多而崩潰。
    // subscriptions.value.forEach(sub => handleUpdateNodeCount(sub.id, true)); 
  }

  const enabledSubscriptions = computed(() => subscriptions.value.filter(s => s.enabled));
  
  const totalRemainingTraffic = computed(() => {
    const REASONABLE_TRAFFIC_LIMIT_BYTES = 10 * 1024 * 1024 * 1024 * 1024 * 1024; // 10 PB in bytes
    return subscriptions.value.reduce((acc, sub) => {
      if (
        sub.enabled &&
        sub.userInfo &&
        sub.userInfo.total > 0 &&
        sub.userInfo.total < REASONABLE_TRAFFIC_LIMIT_BYTES
      ) {  
        const used = (sub.userInfo.upload || 0) + (sub.userInfo.download || 0);
        const remaining = sub.userInfo.total - used;
        return acc + Math.max(0, remaining);
      }
      return acc;
    }, 0);
  });

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
    
    if (!isInitialLoad) {
        subToUpdate.isUpdating = true;
    }

    try {
      const data = await fetchNodeCount(subToUpdate.url);
      subToUpdate.nodeCount = data.count || 0;
      subToUpdate.userInfo = data.userInfo || null;
      
      if (!isInitialLoad) {
        showToast(`${subToUpdate.name || '订阅'} 更新成功！`, 'success');
        markDirty();
      }
    } catch (error) {
      if (!isInitialLoad) showToast(`${subToUpdate.name || '订阅'} 更新失败`, 'error');
      console.error(`Failed to fetch node count for ${subToUpdate.name}:`, error);
    } finally {
      subToUpdate.isUpdating = false;
    }
  }

  function addSubscription(sub) {
    subscriptions.value.unshift(sub);
    subsCurrentPage.value = 1;
    handleUpdateNodeCount(sub.id); // 新增時自動更新單個
    markDirty();
  }

  function updateSubscription(updatedSub) {
    const index = subscriptions.value.findIndex(s => s.id === updatedSub.id);
    if (index !== -1) {
      if (subscriptions.value[index].url !== updatedSub.url) {
        updatedSub.nodeCount = 0;
        handleUpdateNodeCount(updatedSub.id); // URL 變更時自動更新單個
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
  
  // {{ AURA-X: Modify - 使用批量更新API优化批量导入. Approval: 寸止(ID:1735459200). }}
  // [优化] 批量導入使用批量更新API，减少KV写入次数
  async function addSubscriptionsFromBulk(subs) {
    subscriptions.value.unshift(...subs);
    markDirty();

    // 过滤出需要更新的订阅（只有http/https链接）
    const subsToUpdate = subs.filter(sub => sub.url && sub.url.startsWith('http'));

    if (subsToUpdate.length > 0) {
      showToast(`正在批量更新 ${subsToUpdate.length} 个订阅...`, 'success');

      try {
        const result = await batchUpdateNodes(subsToUpdate.map(sub => sub.id));

        if (result.success) {
          // 更新本地数据
          result.results.forEach(updateResult => {
            if (updateResult.success) {
              const sub = subscriptions.value.find(s => s.id === updateResult.id);
              if (sub) {
                sub.nodeCount = updateResult.nodeCount;
                // userInfo会在下次数据同步时更新
              }
            }
          });

          const successCount = result.results.filter(r => r.success).length;
          showToast(`批量更新完成！成功更新 ${successCount}/${subsToUpdate.length} 个订阅`, 'success');
          markDirty(); // 标记需要保存
        } else {
          showToast(`批量更新失败: ${result.message}`, 'error');
          // 降级到逐个更新
          showToast('正在降级到逐个更新模式...', 'info');
          for(const sub of subsToUpdate) {
            await handleUpdateNodeCount(sub.id);
          }
        }
      } catch (error) {
        console.error('Batch update failed:', error);
        showToast('批量更新失败，正在降级到逐个更新...', 'error');
        // 降级到逐个更新
        for(const sub of subsToUpdate) {
          await handleUpdateNodeCount(sub.id);
        }
      }
    } else {
      showToast('批量导入完成！', 'success');
    }
  }

  watch(initialSubsRef, (newInitialSubs) => {
    initializeSubscriptions(newInitialSubs);
  }, { immediate: true, deep: true });

  return {
    subscriptions,
    subsCurrentPage,
    subsTotalPages,
    paginatedSubscriptions,
    totalRemainingTraffic,
    enabledSubscriptionsCount: computed(() => enabledSubscriptions.value.length),
    changeSubsPage,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    deleteAllSubscriptions,
    addSubscriptionsFromBulk,
    handleUpdateNodeCount,
  };
}