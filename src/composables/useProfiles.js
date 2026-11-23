import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useDataStore } from '../stores/useDataStore';
import { useToastStore } from '../stores/toast';
import { generateProfileId } from '../utils/id.js';
import { getProfileShareIdentifier } from '../utils/profile-link.js';
import { copyTextToClipboard } from '../utils/clipboard.js';
import { t } from '../i18n/index.js';

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

    const searchQuery = ref('');
    const filteredProfiles = computed(() => {
        const query = searchQuery.value.trim().toLowerCase();
        if (!query) return profiles.value;

        return profiles.value.filter((profile) =>
            [
                profile.name,
                profile.description,
                profile.desc,
                profile.remark,
                profile.customId,
            ].some((value) =>
                String(value || '')
                    .toLowerCase()
                    .includes(query)
            )
        );
    });

    const profilesTotalPages = computed(() =>
        Math.ceil(filteredProfiles.value.length / profilesItemsPerPage)
    );
    const paginatedProfiles = computed(() => {
        const start = (profilesCurrentPage.value - 1) * profilesItemsPerPage;
        const end = start + profilesItemsPerPage;
        return filteredProfiles.value.slice(start, end);
    });

    watch(searchQuery, () => {
        profilesCurrentPage.value = 1;
    });

    function changeProfilesPage(page) {
        if (page < 1 || page > profilesTotalPages.value) return;
        profilesCurrentPage.value = page;
    }

    const handleProfileToggle = (updatedProfile) => {
        const index = profiles.value.findIndex((p) => p.id === updatedProfile.id);
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
        editingProfile.value = {
            name: '',
            enabled: true,
            subscriptions: [],
            manualNodes: [],
            customId: '',
            transformConfigMode: 'global',
            transformConfig: '',
            ruleLevel: '',
            expiresAt: '',
            operators: [], // [New] Initialize operator chain
        };
        showProfileModal.value = true;
    };

    const handleEditProfile = (profileId) => {
        const profile = profiles.value.find((p) => p.id === profileId || p.customId === profileId);
        if (profile) {
            isNewProfile.value = false;
            editingProfile.value = JSON.parse(JSON.stringify(profile));
            if (!editingProfile.value.transformConfigMode) {
                editingProfile.value.transformConfigMode = editingProfile.value.transformConfig
                    ? 'preset'
                    : 'global';
            }
            if (!editingProfile.value.ruleLevel && editingProfile.value.clashRuleLevel) {
                editingProfile.value.ruleLevel = editingProfile.value.clashRuleLevel;
            }
            editingProfile.value.expiresAt = profile.expiresAt || '';
            if (!Array.isArray(editingProfile.value.operators)) {
                editingProfile.value.operators = [];
            }
            showProfileModal.value = true;
        }
    };

    const handleSaveProfile = (profileData) => {
        if (!profileData || !profileData.name) {
            showToast(t('profiles.nameRequired'), 'error');
            return;
        }
        if (profileData.customId) {
            profileData.customId = profileData.customId.replace(/[^a-zA-Z0-9-_]/g, '');
            if (
                profileData.customId &&
                profiles.value.some(
                    (p) => p.id !== profileData.id && p.customId === profileData.customId
                )
            ) {
                showToast(t('profiles.customIdExists', { id: profileData.customId }), 'error');
                return;
            }
        }
        if (isNewProfile.value) {
            dataStore.addProfile({
                ...profileData,
                id: generateProfileId(),
                linkId: generateProfileId(),
            });
        } else {
            const index = profiles.value.findIndex((p) => p.id === profileData.id);
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

    const copyProfileLink = async (profileId) => {
        const token = settings.value?.profileToken;
        if (!token || token === 'auto' || !token.trim()) {
            showToast(t('profiles.fixedTokenRequired'), 'error');
            return;
        }
        const profile = profiles.value.find((p) => p.id === profileId || p.customId === profileId);
        if (!profile) return;
        const identifier = getProfileShareIdentifier(profile);
        const link = `${window.location.origin}/${token}/${identifier}`;

        const ok = await copyTextToClipboard(link);
        showToast(
            ok ? t('profiles.linkCopied') : t('publicProfiles.copyFailedManual'),
            ok ? 'success' : 'error'
        );
    };

    // Clash 专用链接复制（带 builtin 转换器参数）
    const copyClashLink = async (profileId) => {
        const token = settings.value?.profileToken;
        if (!token || token === 'auto' || !token.trim()) {
            showToast(t('profiles.fixedTokenRequired'), 'error');
            return;
        }
        const profile = profiles.value.find((p) => p.id === profileId || p.customId === profileId);
        if (!profile) return;
        const identifier = getProfileShareIdentifier(profile);
        // 添加 Clash 专用参数
        const link = `${window.location.origin}/${token}/${identifier}?target=clash&builtin=1`;

        const ok = await copyTextToClipboard(link);
        showToast(
            ok ? t('profiles.clashLinkCopied') : t('publicProfiles.copyFailedManual'),
            ok ? 'success' : 'error'
        );
    };

    const cleanupSubscriptions = (subId) => {
        profiles.value.forEach((p) => {
            p.subscriptions = p.subscriptions.filter((id) => id !== subId);
        });
    };

    const cleanupNodes = (nodeId) => {
        profiles.value.forEach((p) => {
            p.manualNodes = p.manualNodes.filter((id) => id !== nodeId);
        });
    };

    const cleanupAllSubscriptions = () => {
        profiles.value.forEach((p) => {
            p.subscriptions = [];
        });
    };

    const cleanupAllNodes = () => {
        profiles.value.forEach((p) => {
            p.manualNodes = [];
        });
    };

    return {
        profiles,
        filteredProfiles,
        searchQuery,
        editingProfile,
        isNewProfile,
        showProfileModal,
        showDeleteProfilesModal,
        initializeProfiles: () => {}, // No-op now
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
        changeProfilesPage,
    };
}
