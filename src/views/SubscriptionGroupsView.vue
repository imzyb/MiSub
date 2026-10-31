<script setup>
    import { ref, defineAsyncComponent, computed, onMounted, watch } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
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
    import { useI18n } from '../i18n/index.js';
    import { createAirportGroupId } from '../utils/airport-identity.js';
    import {
        resolveSubscriptionStatusFilter,
        matchesSubscriptionStatus,
    } from '../utils/dashboard-deeplink.js';

    const dataStore = useDataStore();
    const { showToast } = useToastStore();
    const { markDirty } = dataStore;
    const { t } = useI18n();
    const route = useRoute();
    const router = useRouter();

    // State
    // State
    const isSortingSubs = ref(false);
    const showDeleteSubsModal = ref(false);

    const {
        subscriptions,
        filteredSubscriptions,
        searchQuery: subscriptionSearchQuery,
        subsCurrentPage,
        subsTotalPages,
        paginatedSubscriptions,
        changeSubsPage,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        deleteAllSubscriptions,
        addSubscriptionsFromBulk,
        handleUpdateNodeCount,
        batchUpdateAllSubscriptions,
        reorderSubscriptions,
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
        handleSave: handleSaveSubscription,
    } = useSubscriptionForms({ addSubscription, updateSubscription });

    const { showModal: showBulkImportModal, handleBulkImport } = useBulkImportLogic({
        addSubscriptionsFromBulk,
        addNodesFromBulk,
    });

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
    const NodePreviewModal = defineAsyncComponent(
        () => import('../components/modals/NodePreview/NodePreviewModal.vue')
    );
    const showNodePreviewModal = ref(false);
    const previewSubscriptionId = ref(null);
    const previewSubscriptionName = ref('');
    const previewSubscriptionUrl = ref('');

    // 将当前显示组确认为一个机场身份，并统一显示组名；订阅源自身名称保持不变。
    const handleRenameGroup = (ids, baseName, requestedGroupId) => {
        const base = String(baseName || '').trim();
        if (!base || !Array.isArray(ids) || ids.length === 0) return;
        const groupId =
            ids
                .map(
                    (id) =>
                        subscriptions.value.find((sub) => sub.id === id)?.airportIdentity?.groupId
                )
                .find(Boolean) ||
            requestedGroupId ||
            createAirportGroupId();
        const name = base;
        let updated = 0;
        ids.forEach((id) => {
            const target = subscriptions.value.find((sub) => sub.id === id);
            if (!target) return;
            const identity = { groupId, name: base };
            if (
                target.airportIdentity?.groupId === groupId &&
                target.airportIdentity?.name === base
            )
                return;
            updateSubscription({ ...target, airportIdentity: identity });
            updated++;
        });
        if (updated)
            showToast(t('subscriptions.groupRenamed', { name: base, count: updated }), 'success');
    };

    // 应用识别到的机场名（来自订阅响应头 / 官网标题）
    const handleApplyDetectedName = (subscriptionId, name) => {
        const target = String(name || '').trim();
        if (!target) return;
        // useSubscriptions 的 updateSubscription 接收「完整订阅对象」而非 (id, patch)
        const targetSub = subscriptions.value.find((s) => s.id === subscriptionId);
        if (!targetSub) return;
        updateSubscription({
            ...targetSub,
            airportIdentity: {
                groupId: targetSub.airportIdentity?.groupId || createAirportGroupId(),
                name: target,
            },
        });
        showToast(t('subscriptions.nameApplied', { name: target }), 'success');
    };

    const handleAssignAirportGroup = (ids, identity) => {
        const groupId = String(identity?.groupId || '').trim();
        const name = String(identity?.name || '').trim();
        if (!groupId || !name || !Array.isArray(ids)) return;
        ids.forEach((id) => {
            const target = subscriptions.value.find((sub) => sub.id === id);
            if (target) updateSubscription({ ...target, airportIdentity: { groupId, name } });
        });
    };

    const handleSplitAirportGroup = (ids, identity) => {
        const groupId = String(identity?.groupId || '').trim();
        const name = String(identity?.name || '').trim();
        if (!groupId || !name || !Array.isArray(ids)) return;
        ids.forEach((id) => {
            const target = subscriptions.value.find((sub) => sub.id === id);
            if (target) updateSubscription({ ...target, airportIdentity: { groupId, name } });
        });
    };

    const handleResetAirportIdentity = (ids) => {
        (ids || []).forEach((id) => {
            const target = subscriptions.value.find((sub) => sub.id === id);
            if (target) updateSubscription({ ...target, airportIdentity: null });
        });
        showToast(t('subscriptions.airportIdentityReset'), 'success');
    };

    const handlePreviewSubscription = (subscriptionId) => {
        const subscription = subscriptions.value.find((s) => s.id === subscriptionId);
        if (subscription) {
            previewSubscriptionId.value = subscriptionId;
            previewSubscriptionName.value = subscription.name || t('subscriptions.unnamed');
            previewSubscriptionUrl.value = subscription.url;
            showNodePreviewModal.value = true;
        }
    };

    // Bulk Import Logic
    const BulkImportModal = defineAsyncComponent(
        () => import('../components/modals/BulkImportModal.vue')
    );

    // QRCode
    const QRCodeModal = defineAsyncComponent(() => import('../components/modals/QRCodeModal.vue'));
    const showQRCodeModal = ref(false);
    const qrCodeUrl = ref('');
    const qrCodeTitle = ref('');

    const handleQRCode = (id) => {
        const sub = subscriptions.value.find((s) => s.id === id);
        if (sub) {
            qrCodeUrl.value = sub.url;
            qrCodeTitle.value = sub.name || t('subscriptions.qrCodeTitle');
            showQRCodeModal.value = true;
        }
    };

    // --- Dashboard deep-link status filter (?status=error / expired / ...) ---
    // The dashboard health cards link here with a status. Previously the query
    // was dropped, so the user landed on an unfiltered list.
    const activeStatusFilter = ref('');
    const STATUS_FILTER_LABEL_KEYS = {
        disabled: 'subscriptions.filterStatusDisabled',
        error: 'subscriptions.filterStatusError',
        expired: 'subscriptions.filterStatusExpired',
        'low-traffic': 'subscriptions.filterStatusLowTraffic',
        'zero-nodes': 'subscriptions.filterStatusZeroNodes',
    };

    const statusFilterLabel = computed(() => {
        const key = STATUS_FILTER_LABEL_KEYS[activeStatusFilter.value];
        return key ? t(key) : '';
    });

    // Subscriptions matching the active status filter, before search/pagination.
    const statusFilteredSubscriptions = computed(() => {
        if (!activeStatusFilter.value) return subscriptions.value;
        return subscriptions.value.filter((sub) =>
            matchesSubscriptionStatus(sub, activeStatusFilter.value)
        );
    });

    function applyStatusFromQuery() {
        activeStatusFilter.value = resolveSubscriptionStatusFilter(route.query?.status) || '';
    }

    const clearStatusFilter = () => {
        activeStatusFilter.value = '';
        if (route.query?.status) {
            const nextQuery = { ...route.query };
            delete nextQuery.status;
            router.replace({ query: nextQuery });
        }
    };

    onMounted(applyStatusFromQuery);
    watch(() => route.query.status, applyStatusFromQuery);

    // `subscriptions` is the prop the panel renders; when a status filter is
    // active we narrow it so the list, the count and pagination all agree.
    const visibleSubscriptions = computed(() =>
        activeStatusFilter.value ? statusFilteredSubscriptions.value : subscriptions.value
    );
</script>

<template>
    <div class="max-w-(--breakpoint-xl) mx-auto">
        <SubscriptionPanel
            :subscriptions="visibleSubscriptions"
            :paginated-subscriptions="paginatedSubscriptions"
            :search-query="subscriptionSearchQuery"
            :filtered-count="filteredSubscriptions.length"
            :status-filter="activeStatusFilter"
            :status-filter-label="statusFilterLabel"
            :current-page="subsCurrentPage"
            :total-pages="subsTotalPages"
            :is-sorting="isSortingSubs"
            searchable
            @clear-status-filter="clearStatusFilter"
            @add="handleAddSubscription"
            @delete="handleDeleteSubscriptionWithCleanup"
            @change-page="changeSubsPage"
            @update-node-count="handleUpdateNodeCount"
            @refresh-all="batchUpdateAllSubscriptions"
            @edit="(id) => handleEditSubscription(subscriptions.find((s) => s.id === id))"
            @toggle-sort="isSortingSubs = !isSortingSubs"
            @mark-dirty="markDirty"
            @delete-all="showDeleteSubsModal = true"
            @preview="handlePreviewSubscription"
            @reorder="reorderSubscriptions"
            @import="openBulkImportModal"
            @qrcode="handleQRCode"
            @update-search="subscriptionSearchQuery = $event"
            @applyDetectedName="handleApplyDetectedName"
            @rename-group="handleRenameGroup"
            @assign-airport-group="handleAssignAirportGroup"
            @split-airport-group="handleSplitAirportGroup"
            @reset-group="handleResetAirportIdentity"
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

        <Modal
            v-model:show="showDeleteSubsModal"
            @confirm="handleDeleteAllSubscriptionsWithCleanup"
        >
            <template #title
                ><h3 class="text-lg font-bold text-red-500">
                    {{ t('subscriptions.deleteAllConfirmTitle') }}
                </h3></template
            >
            <template #body
                ><p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t('subscriptions.deleteAllConfirmBody') }}
                </p></template
            >
        </Modal>

        <BulkImportModal
            v-if="showBulkImportModal"
            :show="showBulkImportModal"
            @update:show="showBulkImportModal = $event"
            @import="(txt, tag) => handleBulkImport(txt, tag)"
            @files-imported="(nodes, group) => addNodesFromBulk(nodes, group)"
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

        <QRCodeModal v-model:show="showQRCodeModal" :url="qrCodeUrl" :title="qrCodeTitle" />
    </div>
</template>
