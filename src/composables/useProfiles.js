import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useDataStore } from '../stores/useDataStore';
import { useToastStore } from '../stores/toast';
import { generateProfileId } from '../utils/id.js';

export function useProfiles(markDirty) {
  const { showToast } = useToastStore();
  const dataStore = useDataStore();
  const { profiles, settings } = storeToRefs(dataStore);

  /* Pagination setup */
  const isNewProfile = ref(false);
  const editingProfile = ref(null);
  const showProfileModal = ref(false);
  const showDeleteProfilesModal = ref(false);

  const profilesCurrentPage = ref(1);
  const profilesItemsPerPage = 6;

  const profilesTotalPages = computed(() => Math.ceil(profiles.value.length / profilesItemsPerPage));
  const paginatedProfiles = computed(() => {
    const start = (profilesCurrentPage.value - 1) * profilesItemsPerPage;
    const end = start + profilesItemsPerPage;
    return profiles.value.slice(start, end);
  });

  function changeProfilesPage(page) {
    if (page < 1 || page > profilesTotalPages.value) return;
    profilesCurrentPage.value = page;
  }

  const handleProfileToggle = (updatedProfile) => {
    const index = profiles.value.findIndex(p => p.id === updatedProfile.id);
    if (index !== -1) {
      profiles.value[index].enabled = updatedProfile.enabled;
      if (updatedProfile.isPublic !== undefined) {
        profiles.value[index].isPublic = updatedProfile.isPublic;
      }
      markDirty();
    }
  };

  const handleAddProfile = () => {
    isNewProfile.value = true;
    editingProfile.value = { name: '', enabled: true, subscriptions: [], manualNodes: [], customId: '', subConverter: '', subConfig: '', expiresAt: '' };
    showProfileModal.value = true;
  };

  const handleEditProfile = (profileId) => {
    const profile = profiles.value.find(p => p.id === profileId || p.customId === profileId);
    if (profile) {
      isNewProfile.value = false;
      editingProfile.value = JSON.parse(JSON.stringify(profile));
      editingProfile.value.expiresAt = profile.expiresAt || '';
      showProfileModal.value = true;
    }
  };

  const handleSaveProfile = (profileData) => {
    if (!profileData || !profileData.name) {
      showToast('订阅组名称不能为空', 'error');
      return;
    }
    if (profileData.customId) {
      profileData.customId = profileData.customId.replace(/[^a-zA-Z0-9-_]/g, '');
      if (profileData.customId && profiles.value.some(p => p.id !== profileData.id && p.customId === profileData.customId)) {
        showToast(`自定义 ID "${profileData.customId}" 已存在`, 'error');
        return;
      }
    }
    if (isNewProfile.value) {
      dataStore.addProfile({ ...profileData, id: generateProfileId() });
    } else {
      const index = profiles.value.findIndex(p => p.id === profileData.id);
      if (index !== -1) {
        profiles.value[index] = profileData;
      }
    }
    markDirty();
    showProfileModal.value = false;
  };

  const handleDeleteProfile = (profileId) => {
    dataStore.removeProfile(profileId);
    markDirty();
  };

  const handleDeleteAllProfiles = () => {
    profiles.value = [];
    markDirty();
    showDeleteProfilesModal.value = false;
  };

  const copyProfileLink = (profileId) => {
    const token = settings.value?.profileToken;
    if (!token || token === 'auto' || !token.trim()) {
      showToast('请在设置中配置一个固定的"订阅组分享Token"', 'error');
      return;
    }
    const profile = profiles.value.find(p => p.id === profileId || p.customId === profileId);
    if (!profile) return;
    const identifier = profile.customId || profile.id;
    const link = `${window.location.origin}/${token}/${identifier}`;

    // Clipboard API Fallback for non-secure contexts (http)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => showToast('订阅组分享链接已复制！', 'success'))
        .catch(() => showToast('复制失败，请手动复制', 'error'));
    } else {
      // Fallback method
      const textArea = document.createElement("textarea");
      textArea.value = link;

      // Ensure it's not visible but part of the DOM
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          showToast('订阅组分享链接已复制！', 'success');
        } else {
          showToast('复制失败，请手动复制', 'error');
        }
      } catch (err) {
        showToast('复制失败，请手动复制', 'error');
      }

      document.body.removeChild(textArea);
    }
  };

  // Clash 专用链接复制（带 builtin 转换器参数）
  const copyClashLink = (profileId) => {
    const token = settings.value?.profileToken;
    if (!token || token === 'auto' || !token.trim()) {
      showToast('请在设置中配置一个固定的"订阅组分享Token"', 'error');
      return;
    }
    const profile = profiles.value.find(p => p.id === profileId || p.customId === profileId);
    if (!profile) return;
    const identifier = profile.customId || profile.id;
    // 添加 Clash 专用参数
    const link = `${window.location.origin}/${token}/${identifier}?target=clash&builtin=1`;

    // Clipboard API Fallback for non-secure contexts (http)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => showToast('Clash 专用链接已复制！', 'success'))
        .catch(() => showToast('复制失败，请手动复制', 'error'));
    } else {
      // Fallback method
      const textArea = document.createElement("textarea");
      textArea.value = link;

      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          showToast('Clash 专用链接已复制！', 'success');
        } else {
          showToast('复制失败，请手动复制', 'error');
        }
      } catch (err) {
        showToast('复制失败，请手动复制', 'error');
      }

      document.body.removeChild(textArea);
    }
  };

  const cleanupSubscriptions = (subId) => {
    profiles.value.forEach(p => {
      p.subscriptions = p.subscriptions.filter(id => id !== subId);
    });
  };

  const cleanupNodes = (nodeId) => {
    profiles.value.forEach(p => {
      p.manualNodes = p.manualNodes.filter(id => id !== nodeId);
    });
  };

  const cleanupAllSubscriptions = () => {
    profiles.value.forEach(p => {
      p.subscriptions = [];
    });
  };

  const cleanupAllNodes = () => {
    profiles.value.forEach(p => {
      p.manualNodes = [];
    });
  };

  return {
    profiles,
    editingProfile,
    isNewProfile,
    showProfileModal,
    showDeleteProfilesModal,
    initializeProfiles: () => { }, // No-op now
    handleProfileToggle,
    handleAddProfile,
    handleEditProfile,
    handleSaveProfile,
    handleDeleteProfile,
    handleDeleteAllProfiles,
    copyProfileLink,
    copyClashLink,
    cleanupSubscriptions,
    cleanupNodes,
    cleanupAllSubscriptions,
    cleanupAllNodes,
    cleanupAllNodes,
    // Pagination exports
    profilesCurrentPage,
    profilesTotalPages,
    paginatedProfiles,
    changeProfilesPage
  };
}
