/**
* Dashboard 主容器组件
* @author MiSub Team
*/

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { saveMisubs } from '../../../lib/api.js';
import { useToastStore } from '../../../stores/toast.js';
import { useUIStore } from '../../../stores/ui.js';
import { TIMING } from '../../../constants/timing.js';

// 子组件
import SubscriptionManager from './SubscriptionManager.vue';
import NodeManager from './NodeManager.vue';
import ProfileManager from './ProfileManager.vue';
import SaveIndicator from './SaveIndicator.vue';
import BulkImportModal from './BulkImportModal.vue';
import ProfileModal from './ProfileModal.vue';
import SubscriptionImportModal from './SubscriptionImportModal.vue';
import NodePreviewModal from './NodePreviewModal.vue';
import Modal from './Modal.vue';

// Composables
import { useSubscriptions } from '../composables/useSubscriptions.js';
import { useManualNodes } from '../composables/useManualNodes.js';
import { useProfiles } from '../composables/useProfiles.js';

// Props
const props = defineProps({ data: Object });

// Store
const { showToast } = useToastStore();
const uiStore = useUIStore();

// Loading and dirty state
const isLoading = ref(true);
const dirty = ref(false);
const saveState = ref('idle');

// Data
const initialSubs = ref([]);
const initialNodes = ref([]);
const initialProfiles = ref([]);
const config = ref({});

// Mark dirty callback
const markDirty = () => {
  dirty.value = true;
  saveState.value = 'idle';
};

// Initialize composables
const {
  subscriptions, subsCurrentPage, subsTotalPages, paginatedSubscriptions, totalRemainingTraffic,
  changeSubsPage, addSubscription, updateSubscription, deleteSubscription, deleteAllSubscriptions,
  addSubscriptionsFromBulk, handleUpdateNodeCount,
} = useSubscriptions(initialSubs, markDirty);

const {
  manualNodes, manualNodesCurrentPage, manualNodesTotalPages, paginatedManualNodes, searchTerm,
  changeManualNodesPage, addNode, updateNode, deleteNode, deleteAllNodes,
  addNodesFromBulk, autoSortNodes, deduplicateNodes,
} = useManualNodes(initialNodes, markDirty);

const {
  profiles, editingProfile, isNewProfile, showProfileModal, showDeleteProfilesModal,
  initializeProfiles, handleProfileToggle, handleAddProfile, handleEditProfile,
  handleSaveProfile, handleDeleteProfile, handleDeleteAllProfiles, copyProfileLink,
  cleanupSubscriptions, cleanupNodes, cleanupAllSubscriptions, cleanupAllNodes,
} = useProfiles(initialProfiles, markDirty, config);

// UI State
const showBulkImportModal = ref(false);
const showDeleteSubsModal = ref(false);
const showDeleteNodesModal = ref(false);
const showSubscriptionImportModal = ref(false);

// Node preview state
const showNodePreviewModal = ref(false);
const previewSubscriptionId = ref(null);
const previewProfileId = ref(null);

// Initialize state
const initializeState = () => {
  isLoading.value = true;
  if (props.data) {
    const subsData = props.data.misubs || [];
    initialSubs.value = subsData.filter(item => item.url && /^https?:\/\//.test(item.url));
    initialNodes.value = subsData.filter(item => !item.url || !/^https?:\/\//.test(item.url));
    initialProfiles.value = props.data.profiles || [];
    config.value = props.data.config || {};
    initializeProfiles();
  }
  isLoading.value = false;
  dirty.value = false;
};

// Handle before unload
const handleBeforeUnload = (event) => {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
};

// Save functionality
const handleSave = async () => {
  if (!dirty.value || saveState.value === 'saving') return;

  saveState.value = 'saving';
  try {
    await saveMisubs(subscriptions.value, profiles.value);
    dirty.value = false;
    saveState.value = 'success';
    showToast('保存成功', 'success');
    setTimeout(() => {
      saveState.value = 'idle';
    }, 2000);
  } catch (error) {
    console.error('保存失败:', error);
    saveState.value = 'error';
    showToast('保存失败: ' + error.message, 'error');
    setTimeout(() => {
      saveState.value = 'idle';
    }, TIMING.TOAST_DURATION_MS);
  }
};

// Event handlers
const handlePreviewSubscription = (subscription) => {
  previewSubscriptionId.value = subscription.id;
  previewProfileId.value = null;
  showNodePreviewModal.value = true;
};

const handlePreviewProfile = (profile) => {
  previewSubscriptionId.value = null;
  previewProfileId.value = profile.customId || profile.id;
  showNodePreviewModal.value = true;
};

const handleBulkImport = (importedSubscriptions) => {
  addSubscriptionsFromBulk(importedSubscriptions);
  showToast(`成功导入 ${importedSubscriptions.length} 个订阅`, 'success');
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

// Lifecycle
onMounted(() => {
  initializeState();
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header with Save Indicator -->
      <SaveIndicator :dirty="dirty" :save-state="saveState" @save="handleSave" />

      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>

      <!-- Main Content -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-start">
        <div class="lg:col-span-2 md:col-span-2 space-y-12">
          <!-- Subscription Manager -->
          <SubscriptionManager :subscriptions="subscriptions" :paginated-subscriptions="paginatedSubscriptions"
            :current-page="subsCurrentPage" :total-pages="subsTotalPages"
            :total-remaining-traffic="totalRemainingTraffic" @add="addSubscription" @delete="deleteSubscription"
            @change-page="changeSubsPage" @update-node-count="handleUpdateNodeCount" @edit="updateSubscription"
            @mark-dirty="markDirty" @delete-all="showDeleteSubsModal = true" @preview="handlePreviewSubscription"
            @bulk-import="showBulkImportModal = true" />

          <!-- Node Manager -->
          <NodeManager :manual-nodes="manualNodes" :paginated-manual-nodes="paginatedManualNodes"
            :current-page="manualNodesCurrentPage" :total-pages="manualNodesTotalPages" :search-term="searchTerm"
            @add="addNode" @delete="deleteNode" @edit="updateNode" @change-page="changeManualNodesPage"
            @update:search-term="newVal => searchTerm = newVal" @mark-dirty="markDirty" @auto-sort="autoSortNodes"
            @deduplicate="deduplicateNodes" @import="showSubscriptionImportModal = true"
            @delete-all="showDeleteNodesModal = true" />
        </div>

        <!-- Profile Manager -->
        <div class="lg:col-span-1">
          <ProfileManager :config="config" :profiles="profiles" @add="handleAddProfile" @edit="handleEditProfile"
            @delete="handleDeleteProfile" @delete-all="showDeleteProfilesModal = true" @toggle="handleProfileToggle"
            @copy-link="copyProfileLink" @preview="handlePreviewProfile" />
        </div>
      </div>
    </div>

    <!-- Modals -->
    <BulkImportModal v-model:show="showBulkImportModal" @import="handleBulkImport" />

    <Modal v-model:show="showDeleteSubsModal" @confirm="handleDeleteAllSubscriptionsWithCleanup">
      <template #title>
        <h3 class="text-lg font-bold text-red-500">确认清空订阅</h3>
      </template>
      <template #body>
        <p class="text-sm text-gray-400">
          您确定要删除所有**订阅**吗？此操作将标记为待保存，不会影响手动节点。
        </p>
      </template>
    </Modal>

    <Modal v-model:show="showDeleteNodesModal" @confirm="handleDeleteAllNodesWithCleanup">
      <template #title>
        <h3 class="text-lg font-bold text-red-500">确认清空节点</h3>
      </template>
      <template #body>
        <p class="text-sm text-gray-400">
          您确定要删除所有**手动节点**吗？此操作将标记为待保存，不会影响订阅。
        </p>
      </template>
    </Modal>

    <Modal v-model:show="showDeleteProfilesModal" @confirm="handleDeleteAllProfiles">
      <template #title>
        <h3 class="text-lg font-bold text-red-500">确认清空订阅组</h3>
      </template>
      <template #body>
        <p class="text-sm text-gray-400">
          您确定要删除所有**订阅组**吗？此操作不可逆。
        </p>
      </template>
    </Modal>

    <ProfileModal v-if="showProfileModal" v-model:show="showProfileModal" :profile="editingProfile"
      :is-new="isNewProfile" :all-subscriptions="subscriptions" :all-manual-nodes="manualNodes"
      @save="handleSaveProfile" size="6xl" />

    <SubscriptionImportModal v-if="showSubscriptionImportModal" v-model:show="showSubscriptionImportModal"
      @import="addNodesFromBulk" />

    <NodePreviewModal v-if="showNodePreviewModal" v-model:show="showNodePreviewModal"
      :subscription-id="previewSubscriptionId" :profile-id="previewProfileId" />
  </div>
</template>
