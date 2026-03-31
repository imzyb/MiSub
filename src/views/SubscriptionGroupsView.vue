<script setup>
import { ref, defineAsyncComponent, computed } from 'vue';
import { extractNodeName } from '../lib/utils.js';
import { useDataStore } from '../stores/useDataStore.js';
import { useSubscriptions } from '../composables/useSubscriptions.js';
import { useManualNodes } from '../composables/useManualNodes.js';
import { useProfiles } from '../composables/useProfiles.js';
import { useSubscriptionForms } from '../composables/useSubscriptionForms.js'; // Added
import { useBulkImportLogic } from '../composables/useBulkImportLogic.js'; // Added
import SubscriptionPanel from '../components/subscriptions/SubscriptionPanel.vue';
import Modal from '../components/forms/Modal.vue';
import SubscriptionEditModal from '../components/modals/SubscriptionEditModal.vue';
import { useToastStore } from '../stores/toast.js';

const dataStore = useDataStore();
const { showToast } = useToastStore();
const { markDirty } = dataStore;

// State
// State
const isSortingSubs = ref(false);
const showDeleteSubsModal = ref(false);

const {
  subscriptions, subsCurrentPage, subsTotalPages, paginatedSubscriptions,
  changeSubsPage, addSubscription, updateSubscription, deleteSubscription, deleteAllSubscriptions,
  addSubscriptionsFromBulk, handleUpdateNodeCount, batchUpdateAllSubscriptions,
  reorderSubscriptions
} = useSubscriptions(markDirty);

const { addNodesFromBulk } = useManualNodes(markDirty);

const { cleanupSubscriptions, cleanupAllSubscriptions } = useProfiles(markDirty);

// Composables
const {
  showModal: showSubModal,
  isNew: isNewSubscription,
  editingSubscription,
  openAdd: handleAddSubscription,
  openEdit: handleEditSubscription,
  handleSave: handleSaveSubscription
} = useSubscriptionForms({ addSubscription, updateSubscription });

const {
  showModal: showBulkImportModal,
  handleBulkImport
} = useBulkImportLogic({ addSubscriptionsFromBulk, addNodesFromBulk });

const openBulkImportModal = () => {
    showBulkImportModal.value = true;
};

const handleDeleteSubscriptionWithCleanup = (subId) => {
    deleteSubscription(subId);
    cleanupSubscriptions(subId);
};

const handleDeleteAllSubscriptionsWithCleanup = () => {
    deleteAllSubscriptions();
    cleanupAllSubscriptions();
    showDeleteSubsModal.value = false;
};

// Preview
const NodePreviewModal = defineAsyncComponent(() => import('../components/modals/NodePreview/NodePreviewModal.vue'));
const showNodePreviewModal = ref(false);
const previewSubscriptionId = ref(null);
const previewSubscriptionName = ref('');
const previewSubscriptionUrl = ref('');

const handlePreviewSubscription = (subscriptionId) => {
  const subscription = subscriptions.value.find(s => s.id === subscriptionId);
  if (subscription) {
    previewSubscriptionId.value = subscriptionId;
    previewSubscriptionName.value = subscription.name || '未命名订阅';
    previewSubscriptionUrl.value = subscription.url;
    showNodePreviewModal.value = true;
  }
};

// Bulk Import Logic
const BulkImportModal = defineAsyncComponent(() => import('../components/modals/BulkImportModal.vue'));

// QRCode
const QRCodeModal = defineAsyncComponent(() => import('../components/modals/QRCodeModal.vue'));
const showQRCodeModal = ref(false);
const qrCodeUrl = ref('');
const qrCodeTitle = ref('');

const handleQRCode = (id) => {
  const sub = subscriptions.value.find(s => s.id === id);
  if (sub) {
    qrCodeUrl.value = sub.url;
    qrCodeTitle.value = sub.name || '订阅二维码';
    showQRCodeModal.value = true;
  }
};
</script>

<template>
  <div class="max-w-(--breakpoint-xl) mx-auto">


    <SubscriptionPanel
      :subscriptions="subscriptions"
      :paginated-subscriptions="paginatedSubscriptions"
      :current-page="subsCurrentPage"
      :total-pages="subsTotalPages"
      :is-sorting="isSortingSubs"
      @add="handleAddSubscription"
      @delete="handleDeleteSubscriptionWithCleanup"
      @change-page="changeSubsPage"
      @update-node-count="handleUpdateNodeCount"
      @refresh-all="batchUpdateAllSubscriptions"
      @edit="(id) => handleEditSubscription(subscriptions.find(s => s.id === id))"
      @toggle-sort="isSortingSubs = !isSortingSubs"
      @mark-dirty="markDirty"
      @delete-all="showDeleteSubsModal = true"
      @preview="handlePreviewSubscription"
      @reorder="reorderSubscriptions"
      @import="openBulkImportModal"
      @qrcode="handleQRCode"
    >
        <!-- Slot removed as user requested button move to dropdown -->
    </SubscriptionPanel>

    <!-- Dialogs -->
    <SubscriptionEditModal
        v-model:show="showSubModal"
        :is-new="isNewSubscription"
        :editing-subscription="editingSubscription"
        @confirm="handleSaveSubscription"
    />

    <Modal v-model:show="showDeleteSubsModal" @confirm="handleDeleteAllSubscriptionsWithCleanup">
        <template #title><h3 class="text-lg font-bold text-red-500">确认清空订阅</h3></template>
        <template #body><p class="text-sm text-gray-400">您确定要删除所有**订阅**吗？</p></template>
    </Modal>
    
    <BulkImportModal 
        v-if="showBulkImportModal" 
        :show="showBulkImportModal" 
        @update:show="showBulkImportModal = $event"
        @import="(txt, tag) => handleBulkImport(txt, tag)"
    />

    <NodePreviewModal
        :show="showNodePreviewModal"
        :subscription-id="previewSubscriptionId"
        :subscription-name="previewSubscriptionName"
        :subscription-url="previewSubscriptionUrl"
        :profile-id="null"
        :profile-name="''"
        @update:show="showNodePreviewModal = $event"
    />

    <QRCodeModal 
        v-model:show="showQRCodeModal" 
        :url="qrCodeUrl" 
        :title="qrCodeTitle" 
    />
  </div>
</template>
