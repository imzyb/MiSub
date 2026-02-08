<script setup>
import { ref, defineAsyncComponent } from 'vue';
import { useDataStore } from '../stores/useDataStore.js';
import { useProfiles } from '../composables/useProfiles.js';
import ProfilePanel from '../components/profiles/ProfilePanel.vue';
import Modal from '../components/forms/Modal.vue';
import { storeToRefs } from 'pinia';
import { useManualNodes } from '../composables/useManualNodes.js';

const dataStore = useDataStore();
const { markDirty } = dataStore;

const {
  profiles, editingProfile, isNewProfile, showProfileModal, showDeleteProfilesModal,
  handleProfileToggle, handleAddProfile, handleEditProfile,
  handleSaveProfile, handleDeleteProfile, handleDeleteAllProfiles, copyProfileLink, copyClashLink,
  profilesCurrentPage, profilesTotalPages, paginatedProfiles, changeProfilesPage
} = useProfiles(markDirty);

// For ProfileModal need access to all subscriptions and nodes
const { subscriptions } = storeToRefs(dataStore);
const { manualNodes } = useManualNodes(markDirty);

const handleProfileReorder = (fromIndex, toIndex) => {
  const [item] = profiles.value.splice(fromIndex, 1);
  profiles.value.splice(toIndex, 0, item);
  markDirty();
};

const NodePreviewModal = defineAsyncComponent(() => import('../components/modals/NodePreview/NodePreviewModal.vue'));
const showNodePreviewModal = ref(false);
const previewProfileId = ref(null);
const previewProfileName = ref('');

const handlePreviewProfile = (profileId) => {
  const profile = profiles.value.find(p => p.id === profileId || p.customId === profileId);
  if (profile) {
    previewProfileId.value = profileId;
    previewProfileName.value = profile.name;
    showNodePreviewModal.value = true;
  }
};

const ProfileModal = defineAsyncComponent(() => import('../components/modals/ProfileModal.vue'));
const LogModal = defineAsyncComponent(() => import('../components/modals/LogModal.vue'));

const showLogModal = ref(false);
const logProfileName = ref('');

const handleViewLogs = (profileId) => {
    const profile = profiles.value.find(p => p.id === profileId || p.customId === profileId);
    if (profile) {
        logProfileName.value = profile.name;
        showLogModal.value = true;
    }
};

// QRCode
const QRCodeModal = defineAsyncComponent(() => import('../components/modals/QRCodeModal.vue'));
const showQRCodeModal = ref(false);
const qrCodeUrl = ref('');
const qrCodeTitle = ref('');
const { settings } = storeToRefs(dataStore); // Check if settings is already imported or available from dataStore

const handleQRCode = (profileId) => {
    const profile = profiles.value.find(p => p.id === profileId || p.customId === profileId);
    if (profile) {
      if (!settings.value.profileToken) {
          showToast("未配置订阅组 Token，无法生成链接", "error");
          return;
      }
      const token = settings.value.profileToken;
      const baseUrl = window.location.origin;
      // Use customId if available, otherwise use id
      const idToUse = profile.customId || profile.id;
      qrCodeUrl.value = `${baseUrl}/sub/${token}/${idToUse}`; 
      qrCodeTitle.value = profile.name || '订阅组二维码';
      showQRCodeModal.value = true;
    }
};
</script>

<template>
  <div class="max-w-(--breakpoint-xl) mx-auto">


    <ProfilePanel 
      :profiles="profiles"
      :paginated-profiles="paginatedProfiles"
      :current-page="profilesCurrentPage"
      :total-pages="profilesTotalPages"
      @add="handleAddProfile"
      @edit="handleEditProfile"
      @delete="handleDeleteProfile"
      @deleteAll="showDeleteProfilesModal = true"
      @toggle="handleProfileToggle"
      @copyLink="copyProfileLink"
      @copy-clash-link="copyClashLink"
      @preview="handlePreviewProfile"
      @reorder="handleProfileReorder"
      @change-page="changeProfilesPage"
      @viewLogs="handleViewLogs"
      @qrcode="handleQRCode"
    />

    <LogModal
        :show="showLogModal"
        @update:show="showLogModal = $event"
        :filter-profile-name="logProfileName"
    />

    <ProfileModal 
        v-if="showProfileModal" 
        v-model:show="showProfileModal" 
        :profile="editingProfile" 
        :is-new="isNewProfile" 
        :all-subscriptions="subscriptions" 
        :all-manual-nodes="manualNodes" 
        @save="handleSaveProfile" 
        size="2xl" 
    />

    <Modal v-model:show="showDeleteProfilesModal" @confirm="handleDeleteAllProfiles">
        <template #title><h3 class="text-lg font-bold text-red-500">确认清空订阅组</h3></template>
        <template #body><p class="text-sm text-gray-400">您确定要删除所有**订阅组**吗？此操作不可逆。</p></template>
    </Modal>

    <NodePreviewModal
        :show="showNodePreviewModal"
        :subscription-id="null"
        :subscription-name="''"
        :subscription-url="''"
        :profile-id="previewProfileId"
        :profile-name="previewProfileName"
        @update:show="showNodePreviewModal = $event"
    />

    <QRCodeModal 
        v-model:show="showQRCodeModal" 
        :url="qrCodeUrl" 
        :title="qrCodeTitle" 
    />
  </div>
</template>
