<script setup>
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent, watch } from 'vue';
import { formatBytes } from '../../../lib/utils.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUIStore } from '../../../stores/ui.js';
import { useDataStore } from '../../../stores/useDataStore.js';
import { useSubscriptions } from '../../../composables/useSubscriptions.js';
import { useManualNodes } from '../../../composables/useManualNodes.js';
import { useProfiles } from '../../../composables/useProfiles.js';
import { useSubscriptionForms } from '../../../composables/useSubscriptionForms.js';
import { useNodeForms } from '../../../composables/useNodeForms.js';
import { useBulkImportLogic } from '../../../composables/useBulkImportLogic.js';
import { useBackupLogic } from '../../../composables/useBackupLogic.js';
import { storeToRefs } from 'pinia';
import { useI18n } from '@/i18n/index.js';

const isDev = import.meta.env.DEV;

// --- Component Imports ---
import RightPanel from '../../profiles/RightPanel.vue';
import ProfilePanel from '../../profiles/ProfilePanel.vue';
import SubscriptionPanel from '../../subscriptions/SubscriptionPanel.vue';
import ManualNodePanel from '../../nodes/ManualNodePanel.vue';
import Modal from '../../forms/Modal.vue';
import SubscriptionEditModal from '../../modals/SubscriptionEditModal.vue';
import ManualNodeEditModal from '../../modals/ManualNodeEditModal.vue';
import ManualNodeDedupModal from '../../modals/ManualNodeDedupModal.vue';
import SkeletonLoader from '../../ui/SkeletonLoader.vue';

const SettingsModal = defineAsyncComponent(() => import('../../modals/SettingsModal.vue'));
const BulkImportModal = defineAsyncComponent(() => import('../../modals/BulkImportModal.vue'));
const ProfileModal = defineAsyncComponent(() => import('../../modals/ProfileModal.vue'));
const SubscriptionImportModal = defineAsyncComponent(() => import('../../modals/SubscriptionImportModal.vue'));
const LogModal = defineAsyncComponent(() => import('../../modals/LogModal.vue'));
const NodePreviewModal = defineAsyncComponent(() => import('../../modals/NodePreview/NodePreviewModal.vue'));

const BatchGroupModal = defineAsyncComponent(() => import('../../modals/BatchGroupModal.vue'));
const GroupManagementModal = defineAsyncComponent(() => import('../../modals/GroupManagementModal.vue'));
const QRCodeModal = defineAsyncComponent(() => import('../../modals/QRCodeModal.vue'));
const CopyLinkModal = defineAsyncComponent(() => import('../../modals/CopyLinkModal.vue'));

// --- 基礎 Props 和狀態 ---
const props = defineProps({ data: Object });
const { showToast } = useToastStore();
const { t } = useI18n();
const uiStore = useUIStore();
const dataStore = useDataStore();
const { settings, isDirty, isLoading } = storeToRefs(dataStore); // Use store refs
const config = settings; // Compatibility alias for template
const { clearDirty } = dataStore; // Don't destructure markDirty directly
if (isDev) {
  console.debug('Dashboard: setup running');
}

const saveState = ref('idle');

// Wrapper for markDirty to also reset saveState
const markDirty = () => {
  dataStore.markDirty();
  saveState.value = 'idle';
};

// --- 將狀態和邏輯委託給 Composables ---
// Composables now use global store, so we don't pass refs
// --- UI State ---
const isSortingSubs = ref(false);
const isSortingNodes = ref(false);
const isSortingProfiles = ref(false);
const manualNodeViewMode = ref('card');
const showQRCodeModal = ref(false);
const qrCodeUrl = ref('');
const qrCodeTitle = ref('');
const showCopyModal = ref(false);
const showCopyModalProfile = ref(null);

const handleQRCode = (id, type = 'subscription') => {
  if (type === 'subscription') {
    const sub = subscriptions.value.find(s => s.id === id);
    if (sub) {
      qrCodeUrl.value = sub.url;
      qrCodeTitle.value = sub.name || t('subscriptions.qrCodeTitle');
      showQRCodeModal.value = true;
    }
  } else if (type === 'profile') {
    const profile = profiles.value.find(p => p.id === id);
    if (profile) {
      if (!settings.value.profileToken) {
          showToast(t('notices.noToken'), 'error');
          return;
      }
      const token = settings.value.profileToken;
      const baseUrl = window.location.origin;
      // Using similar logic to useProfiles copy link
      const idToUse = profile.customId || profile.id;
      qrCodeUrl.value = `${baseUrl}/${token}/${idToUse}`; 
      qrCodeTitle.value = profile.name || t('profiles.qrCodeTitle');
      showQRCodeModal.value = true;
    }
  }
};

const handleOpenCopy = (profileId) => {
  const profile = profiles.value.find(p => p.id === profileId || p.customId === profileId);
  if (profile) {
    showCopyModalProfile.value = profile;
    showCopyModal.value = true;
  }
};

const {
  subscriptions, subsCurrentPage, subsTotalPages, paginatedSubscriptions, totalRemainingTraffic,
  changeSubsPage, addSubscription, updateSubscription, deleteSubscription, deleteAllSubscriptions,
  addSubscriptionsFromBulk, handleUpdateNodeCount, batchUpdateAllSubscriptions, startAutoUpdate, stopAutoUpdate,
  restartAutoUpdate, reorderSubscriptions,
} = useSubscriptions(markDirty);

const {
  manualNodes, manualNodesCurrentPage, manualNodesTotalPages, paginatedManualNodes, searchTerm,
  changeManualNodesPage, addNode, updateNode, deleteNode, deleteAllNodes,
  addNodesFromBulk, autoSortNodes, deduplicateNodes,
  reorderManualNodes, activeGroupFilter, setGroupFilter, batchUpdateGroup, batchDeleteNodes, buildDedupPlan, applyDedupPlan,
  manualNodeGroups, renameGroup, deleteGroup, reorderGroups, // Added group helpers
  pingResults, pingingNodes, pingNodeId, pingAllNodes
} = useManualNodes(markDirty);

const handleSearchTermUpdate = (val) => {
  searchTerm.value = val;
};

const {
  profiles, editingProfile, isNewProfile, showProfileModal, showDeleteProfilesModal,
  initializeProfiles, handleProfileToggle, handleAddProfile, handleEditProfile,
  handleSaveProfile, handleDeleteProfile, handleDeleteAllProfiles, copyProfileLink, copyClashLink,
  cleanupSubscriptions, cleanupNodes, cleanupAllSubscriptions, cleanupAllNodes,
} = useProfiles(markDirty);

// --- UI State ---

// --- New Form Logic Composables ---
const {
  showModal: showSubModal,
  isNew: isNewSubscription,
  editingSubscription,
  openAdd: handleAddSubscription,
  openEdit: handleEditSubscription,
  handleSave: handleSaveSubscription
} = useSubscriptionForms({ addSubscription, updateSubscription });

const {
  showModal: showNodeModal,
  isNew: isNewNode,
  editingNode,
  openAdd: handleAddNode,
  openEdit: handleEditNode,
  handleUrlInput: handleNodeUrlInput,
  handleSave: handleSaveNode
} = useNodeForms({ addNode, updateNode });

const {
  showModal: showBulkImportModal,
  handleBulkImport
} = useBulkImportLogic({ addSubscriptionsFromBulk, addNodesFromBulk });

// 使用备份 composable
const { exportBackup, importBackup } = useBackupLogic();

// --- UI State ---
const showDeleteSubsModal = ref(false);
const showDeleteNodesModal = ref(false);
const showSubscriptionImportModal = ref(false);
const showLogModal = ref(false);
const logProfileName = ref('');
const showBatchDeleteModal = ref(false);
const batchDeleteIds = ref([]);
const showDedupModal = ref(false);
const dedupPlan = ref(null);
const showBatchGroupModal = ref(false); // Added
const batchGroupIds = ref([]); // Added
const showGroupManagementModal = ref(false); // 分组管理模态框

// 节点预览相关状态
const showNodePreviewModal = ref(false);
const previewSubscriptionId = ref(null);
const previewProfileId = ref(null);
const previewSubscriptionName = ref('');
const previewSubscriptionUrl = ref('');
const previewProfileName = ref('');



// --- 初始化與生命週期 ---
const initializeState = async () => {
  if (isDev) {
    console.debug('Dashboard: initializeState started');
  }
  try {
    // fetchData 内部会检查数据是否已加载，避免重复请求
    await dataStore.fetchData();
    if (isDev) {
      console.debug('Dashboard: fetchData completed', {
        subs: subscriptions.value?.length,
        nodes: manualNodes.value?.length
      });
    }
    clearDirty();
  } catch (e) {
    console.error('Dashboard: initializeState error', e);
  }
};

const handleBeforeUnload = (event) => {
  if (isDirty.value) {
    event.preventDefault();
    event.returnValue = t('common.unsavedLeaveConfirm');
  }
};

onMounted(() => {
  initializeState();
  window.addEventListener('beforeunload', handleBeforeUnload);
  const savedViewMode = localStorage.getItem('manualNodeViewMode');
  if (savedViewMode) {
    manualNodeViewMode.value = savedViewMode;
  }
  // 启动订阅自动更新定时器（每30分钟）
  startAutoUpdate();
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  // 停止订阅自动更新定时器
  stopAutoUpdate();
});

// 监听设置变更，重启自动更新定时器
watch(
  () => settings.value?.autoUpdateInterval,
  (newInterval) => {
    if (newInterval !== undefined) {
      restartAutoUpdate(newInterval);
    }
  }
);

const setViewMode = (mode) => {
  manualNodeViewMode.value = mode;
  localStorage.setItem('manualNodeViewMode', mode);
};

// --- 其他 JS 逻辑 (省略) ---
const handleDiscard = async () => {
  // 强制刷新数据，忽略缓存
  await dataStore.fetchData(true);
  showToast(t('notices.discardedChanges'));
};

const handleSave = async () => {
  saveState.value = 'saving';

  try {
    await dataStore.saveData();

    saveState.value = 'success';

    if (isSortingNodes.value) isSortingNodes.value = false;

    setTimeout(() => { saveState.value = 'idle'; }, 1500);

  } catch (error) {
    saveState.value = 'idle';
  }
};


const handleDeleteSubscriptionWithCleanup = (subId) => {
  deleteSubscription(subId);
  // cleanup 已在 deleteSubscription 内部通过 removeSubscriptionFromProfiles 实现
};
const handleDeleteNodeWithCleanup = (nodeId) => {
  deleteNode(nodeId);
  // cleanup 已在 deleteNode 内部通过 removeManualNodeFromProfiles 实现
};
const handleDeleteAllSubscriptionsWithCleanup = () => {
  deleteAllSubscriptions();
  // cleanup 已在 deleteAllSubscriptions 内部通过 removeSubscriptionFromProfiles 实现
  showDeleteSubsModal.value = false;
};
const handleDeleteAllNodesWithCleanup = () => {
  deleteAllNodes();
  // cleanup 已在 deleteAllNodes 内部通过 removeManualNodeFromProfiles 实现
  showDeleteNodesModal.value = false;
};
const handleAutoSortNodes = () => {
  autoSortNodes();
  showToast(t('manualNodes.sortedByRegion'), 'success');
};

const handleDeduplicateNodes = () => {
  const plan = buildDedupPlan();
  if (!plan || plan.removeCount === 0) {
    showToast(t('manualNodes.noDuplicates'), 'info');
    return;
  }
  dedupPlan.value = plan;
  showDedupModal.value = true;
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

const handleOpenBatchGroupModal = (ids) => {
  batchGroupIds.value = ids;
  showBatchGroupModal.value = true;
};

const handleBatchGroupConfirm = (groupName) => {
  batchUpdateGroup(batchGroupIds.value, groupName);
  batchGroupIds.value = [];
};

// 分组管理处理函数
const handleOpenGroupManagement = () => {
  showGroupManagementModal.value = true;
};

const handleGroupRename = (oldName, newName) => {
  renameGroup(oldName, newName);
  showToast(t('manualNodes.groupRenamed', { oldName, newName }), 'success');
};

const handleGroupDelete = (groupName) => {
  deleteGroup(groupName);
  showToast(t('manualNodes.groupDeleted', { groupName }), 'success');
};

const handleGroupReorder = (newOrder) => {
  reorderGroups(newOrder);
  showToast(t('manualNodes.groupOrderUpdated'), 'success');
};

// 节点预览处理函数
const handlePreviewSubscription = (subscriptionId) => {
  const subscription = subscriptions.value.find(s => s.id === subscriptionId);
  if (subscription) {
    previewSubscriptionId.value = subscriptionId;
    previewSubscriptionName.value = subscription.name || t('subscriptions.unnamed');
    previewSubscriptionUrl.value = subscription.url;
    previewProfileId.value = null;
    previewProfileName.value = '';
    showNodePreviewModal.value = true;
  }
};

const handlePreviewProfile = (profileId) => {
  const profile = profiles.value.find(p => p.id === profileId || p.customId === profileId);
  if (profile) {
    previewProfileId.value = profileId;
    previewProfileName.value = profile.name;
    previewSubscriptionId.value = null;
    previewSubscriptionName.value = '';
    previewSubscriptionUrl.value = '';
    showNodePreviewModal.value = true;
  }
};

const handleViewLogs = (profileId) => {
  const profile = profiles.value.find(p => p.id === profileId || p.customId === profileId);
  if (profile) {
    logProfileName.value = profile.name;
    showLogModal.value = true;
  }
};

const handleProfileReorder = (profileId, direction) => {
  const fromIndex = profiles.value.findIndex(profile => profile.id === profileId || profile.customId === profileId);
  if (fromIndex === -1) return;

  const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= profiles.value.length) return;

  const [item] = profiles.value.splice(fromIndex, 1);
  profiles.value.splice(toIndex, 0, item);
  markDirty();
};

// 备份函数由 useBackupLogic 提供
// 格式化函数由 utils.js 提供
const formattedTotalRemainingTraffic = computed(() => formatBytes(totalRemainingTraffic.value));

import DashboardHeader from './DashboardHeader.vue';
import SavePrompt from '../../ui/SavePrompt.vue';
</script>

<template>

  <div v-if="isLoading" class="w-full max-w-(--breakpoint-xl) mx-auto p-4 sm:p-6 lg:p-8">
    <SkeletonLoader type="dashboard" />
  </div>
  <div v-else class="w-full max-w-(--breakpoint-xl) mx-auto p-4 sm:p-6 lg:p-8">
    <!-- Header -->
    <DashboardHeader
      :formatted-total-remaining-traffic="formattedTotalRemainingTraffic"
      @open-log="showLogModal = true"
      @open-bulk-import="showBulkImportModal = true"
    />

    <SavePrompt 
      :is-dirty="isDirty" 
      :save-state="saveState" 
      @save="handleSave" 
      @discard="handleDiscard" 
    />

    <!-- Main Grid -->
    <div class="grid grid-cols-1 gap-6 items-start lg:gap-7 xl:grid-cols-3 xl:gap-8">
      <div class="space-y-8 lg:space-y-9 xl:col-span-2">
        <!-- Subscription Panel -->
        <SubscriptionPanel :subscriptions="subscriptions" :paginated-subscriptions="paginatedSubscriptions"
          :current-page="subsCurrentPage" :total-pages="subsTotalPages" :is-sorting="isSortingSubs"
          @add="handleAddSubscription" @delete="handleDeleteSubscriptionWithCleanup" @change-page="changeSubsPage"
          @update-node-count="handleUpdateNodeCount" @refresh-all="batchUpdateAllSubscriptions"
          @edit="(id) => handleEditSubscription(subscriptions.find(s => s.id === id))"
          @toggle-sort="isSortingSubs = !isSortingSubs" @mark-dirty="markDirty" @delete-all="showDeleteSubsModal = true"
          @preview="handlePreviewSubscription" @reorder="reorderSubscriptions" 
          @qrcode="(id) => handleQRCode(id, 'subscription')" @import="showBulkImportModal = true" />

        <!-- Manual Node Panel -->
        <ManualNodePanel :manual-nodes="manualNodes" :paginated-manual-nodes="paginatedManualNodes"
          :current-page="manualNodesCurrentPage" :total-pages="manualNodesTotalPages" :is-sorting="isSortingNodes"
          :search-term="searchTerm" :view-mode="manualNodeViewMode" :active-group-filter="activeGroupFilter"
          :ping-results="pingResults" :pinging-nodes="pingingNodes"
          :groups="manualNodeGroups"
          :compact-grid="true"
          @add="handleAddNode" @delete="handleDeleteNodeWithCleanup"
          @edit="(id) => handleEditNode(manualNodes.find(n => n.id === id))" @change-page="changeManualNodesPage"
          @update:search-term="handleSearchTermUpdate" @update:view-mode="setViewMode"
          @toggle-sort="isSortingNodes = !isSortingNodes" @mark-dirty="markDirty" @auto-sort="handleAutoSortNodes"
          @deduplicate="handleDeduplicateNodes" @import="showSubscriptionImportModal = true"
          @delete-all="showDeleteNodesModal = true" @reorder="reorderManualNodes" @set-group-filter="setGroupFilter"
          @batch-update-group="(ids, group) => batchUpdateGroup(ids, group)" 
          @batch-delete-nodes="handleBatchDeleteRequest" 
          @rename-group="renameGroup" @delete-group="deleteGroup"
          @open-batch-group-modal="handleOpenBatchGroupModal"
          @manage-groups="handleOpenGroupManagement" @ping="pingNodeId" @ping-all="pingAllNodes" />
      </div>

      <!-- Right Column -->
      <div class="space-y-6 lg:space-y-7 xl:col-span-1">
        <RightPanel :config="config" :profiles="profiles" :compact="true" @qrcode="(url, title) => { qrCodeUrl = url; qrCodeTitle = title; showQRCodeModal = true; }" />
        <ProfilePanel :profiles="profiles" :compact="true" :is-sorting="isSortingProfiles" @add="handleAddProfile" @edit="handleEditProfile"
          @delete="handleDeleteProfile" @deleteAll="showDeleteProfilesModal = true" @toggle="handleProfileToggle"
          @open-copy="handleOpenCopy" @copyLink="copyProfileLink" @copyClashLink="copyClashLink" @preview="handlePreviewProfile" @viewLogs="handleViewLogs" @reorder="handleProfileReorder" 
          @qrcode="(id) => handleQRCode(id, 'profile')" @toggle-sort="isSortingProfiles = !isSortingProfiles" />
      </div>
    </div>
  </div>

  <BulkImportModal v-model:show="showBulkImportModal" @import="(txt, tag) => handleBulkImport(txt, tag)" />
  <LogModal v-model:show="showLogModal" />
  <Modal v-model:show="showDeleteSubsModal" @confirm="handleDeleteAllSubscriptionsWithCleanup"><template #title>
      <h3 class="text-lg font-bold text-red-500">{{ t('subscriptions.deleteAllConfirmTitle') }}</h3>
    </template><template #body>
      <p class="text-sm text-gray-400">{{ t('subscriptions.deleteAllConfirmBody') }}</p>
    </template></Modal>
  <Modal v-model:show="showDeleteNodesModal" @confirm="handleDeleteAllNodesWithCleanup"><template #title>
      <h3 class="text-lg font-bold text-red-500">{{ t('manualNodes.deleteAllConfirmTitle') }}</h3>
    </template><template #body>
      <p class="text-sm text-gray-400">{{ t('manualNodes.deleteAllConfirmBody') }}</p>
    </template></Modal>
  <Modal v-model:show="showBatchDeleteModal" @confirm="confirmBatchDelete">
    <template #title>
      <h3 class="text-lg font-bold text-red-500">{{ t('manualNodes.batchDeleteConfirmTitle') }}</h3>
    </template>
    <template #body>
      <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('manualNodes.batchDeleteConfirmBody', { count: batchDeleteIds.length }) }}</p>
    </template>
  </Modal>
  <Modal v-model:show="showDeleteProfilesModal" @confirm="handleDeleteAllProfiles"><template #title>
      <h3 class="text-lg font-bold text-red-500">{{ t('profiles.deleteAllConfirmTitle') }}</h3>
    </template><template #body>
      <p class="text-sm text-gray-400">{{ t('profiles.deleteAllConfirmBody') }}</p>
    </template></Modal>

  <ProfileModal v-if="showProfileModal" v-model:show="showProfileModal" :profile="editingProfile" :is-new="isNewProfile"
    :all-subscriptions="subscriptions" :all-manual-nodes="manualNodes" @save="handleSaveProfile" size="6xl" />

  <ManualNodeEditModal v-model:show="showNodeModal" :is-new="isNewNode" :editing-node="editingNode"
    :groups="manualNodeGroups" @confirm="handleSaveNode" @input-url="handleNodeUrlInput" />
  <ManualNodeDedupModal v-model:show="showDedupModal" :plan="dedupPlan"
    @confirm="applyDedupPlan(dedupPlan); showDedupModal = false; dedupPlan = null" />
  
  <BatchGroupModal v-model:show="showBatchGroupModal" :groups="manualNodeGroups" @confirm="handleBatchGroupConfirm" />

  <GroupManagementModal 
    v-model:show="showGroupManagementModal" 
    :groups="manualNodeGroups" 
    @rename="handleGroupRename"
    @delete="handleGroupDelete"
    @reorder="handleGroupReorder"
  />

  <SubscriptionEditModal v-model:show="showSubModal" :is-new="isNewSubscription"
    :editing-subscription="editingSubscription" @confirm="handleSaveSubscription" />

  <SettingsModal v-model:show="uiStore.isSettingsModalVisible" :export-backup="exportBackup"
    :import-backup="importBackup" />
  <SubscriptionImportModal :show="showSubscriptionImportModal" @update:show="showSubscriptionImportModal = $event"
    :add-nodes-from-bulk="addNodesFromBulk" />

  <!-- Node preview modal -->
  <NodePreviewModal :show="showNodePreviewModal" :subscription-id="previewSubscriptionId"
    :subscription-name="previewSubscriptionName" :subscription-url="previewSubscriptionUrl"
    :profile-id="previewProfileId" :profile-name="previewProfileName" @update:show="showNodePreviewModal = $event" />

  <QRCodeModal 
    v-model:show="showQRCodeModal" 
    :url="qrCodeUrl" 
    :title="qrCodeTitle" 
  />

  <CopyLinkModal 
    v-if="showCopyModal && showCopyModalProfile" 
    v-model:show="showCopyModal" 
    :profile="showCopyModalProfile" 
    :token="settings?.profileToken" 
  />
</template>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease-out;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

.cursor-move {
  cursor: move;
}

.slide-fade-sm-enter-active,
.slide-fade-sm-leave-active {
  transition: all 0.2s ease-out;
}

.slide-fade-sm-enter-from,
.slide-fade-sm-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
