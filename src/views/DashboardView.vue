<script setup>
    import { computed, ref, defineAsyncComponent, onMounted } from 'vue';
    import { useDataStore } from '../stores/useDataStore.js';
    import { useBulkImportLogic } from '../composables/useBulkImportLogic.js';
    import { storeToRefs } from 'pinia';
    import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
    import RightPanel from '../components/profiles/RightPanel.vue';
    import { useSubscriptions } from '../composables/useSubscriptions.js';
    import { useRouter } from 'vue-router';
    import { useProfiles } from '../composables/useProfiles.js';
    import { useManualNodes } from '../composables/useManualNodes.js';
    import { formatBytes } from '../lib/utils.js';
    import StatCards from '../components/features/Dashboard/StatCards.vue';
    import {
        addDismissedHealthItem,
        clearLegacyDismissedHealthItemIds,
        filterDismissedHealthItems,
        isHealthItemDismissed,
        normalizeDismissedHealthItemIds,
        readLegacyDismissedHealthItemIds,
    } from '../utils/health-item-dismissal.js';
    import {
        getDashboardHealthItems,
        resolveHealthItemCopy,
        shouldShowFullGuide,
    } from '../utils/dashboard-health.js';
    import { useToastStore } from '../stores/toast.js';
    import { useI18n } from '../i18n/index.js';

    const { t } = useI18n();
    const { showToast } = useToastStore();

    const dataStore = useDataStore();
    const { settings, profiles, isLoading, lastUpdated } = storeToRefs(dataStore);
    const { activeProfiles, markDirty } = dataStore;

    const {
        totalRemainingTraffic: trafficVal,
        enabledSubscriptionsCount,
        subscriptions,
        addSubscriptionsFromBulk,
    } = useSubscriptions(markDirty);

    const { manualNodes, addNodesFromBulk } = useManualNodes(markDirty);

    const router = useRouter();

    const formattedTotalRemainingTraffic = computed(() => formatBytes(trafficVal.value));

    const totalNodesCount = computed(() => {
        return (subscriptions.value || []).reduce((acc, sub) => acc + (sub.nodeCount || 0), 0);
    });

    const subscriptionsCount = computed(() => (subscriptions.value || []).length);
    const activeProfilesCount = computed(() => (activeProfiles || []).length);

    const lastUpdatedTime = computed(() => {
        if (!lastUpdated.value) return t('dashboard.never');
        return new Date(lastUpdated.value).toLocaleString();
    });

    const trafficStats = computed(() => {
        let totalUsed = 0;
        let totalMax = 0;
        (subscriptions.value || []).forEach((sub) => {
            if (sub.excludeTraffic) return;
            if (sub.userInfo) {
                totalUsed += (sub.userInfo.upload || 0) + (sub.userInfo.download || 0);
                totalMax += sub.userInfo.total || 0;
            }
        });
        const percentage =
            totalMax > 0 ? Math.min(100, (totalUsed / totalMax) * 100).toFixed(1) : 0;
        return {
            used: formatBytes(totalUsed),
            total: formatBytes(totalMax),
            percentage,
        };
    });

    // 已忽略的待处理项，直接派生自设置（settings.dismissedHealthItems）。
    // 放在设置里而不是 localStorage，是为了跨设备同步。
    // 用 computed 而不是本地 ref 镜像：保存成功后 settings 更新，列表自动重算。
    const dismissedHealthItemIds = computed(() =>
        normalizeDismissedHealthItemIds(settings.value?.dismissedHealthItems)
    );

    const allHealthItems = computed(() =>
        getDashboardHealthItems({
            subscriptions: subscriptions.value || [],
            profiles: profiles.value || [],
            settings: settings.value || {},
            totalNodesCount: totalNodesCount.value,
        }).map((item) => resolveHealthItemCopy(item, t))
    );

    const dashboardHealthItems = computed(() =>
        filterDismissedHealthItems(allHealthItems.value, dismissedHealthItemIds.value)
    );

    const dismissedHealthItemsCount = computed(
        () => allHealthItems.value.length - dashboardHealthItems.value.length
    );

    const hasHealthItems = computed(() => dashboardHealthItems.value.length > 0);

    // How many health items to render before the "show more" toggle kicks in.
    const HEALTH_ITEMS_COLLAPSED_COUNT = 4;
    const showAllHealthItems = ref(false);
    const visibleHealthItems = computed(() =>
        showAllHealthItems.value
            ? dashboardHealthItems.value
            : dashboardHealthItems.value.slice(0, HEALTH_ITEMS_COLLAPSED_COUNT)
    );
    const hiddenHealthItemsCount = computed(() =>
        Math.max(0, dashboardHealthItems.value.length - visibleHealthItems.value.length)
    );

    const showFullGuide = computed(() =>
        shouldShowFullGuide({
            subscriptions: subscriptions.value || [],
            profiles: profiles.value || [],
        })
    );

    const readinessText = computed(() => {
        if (subscriptionsCount.value === 0) return t('dashboard.readiness.waitingForSubscriptions');
        if (activeProfilesCount.value === 0) return t('dashboard.readiness.waitingForProfiles');
        if (totalNodesCount.value === 0) return t('dashboard.readiness.needsRefresh');
        if (hasHealthItems.value) return t('dashboard.readiness.hasPendingItems');
        return t('dashboard.readiness.ready');
    });

    const readinessToneClass = computed(() => {
        if (!hasHealthItems.value && totalNodesCount.value > 0) {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-400/20';
        }
        return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-400/20';
    });

    const healthToneClasses = {
        danger: 'border-red-200/80 bg-red-50/80 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200',
        warning:
            'border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200',
        info: 'border-sky-200/80 bg-sky-50/80 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200',
    };

    const healthDotClasses = {
        danger: 'bg-red-500',
        warning: 'bg-amber-500',
        info: 'bg-sky-500',
    };

    const handleStatNavigate = (path, query = {}) => {
        router.push({ path, query });
    };

    // --- Bulk Import Logic ---
    const { showModal: showBulkImportModal, handleBulkImport } = useBulkImportLogic({
        addSubscriptionsFromBulk,
        addNodesFromBulk,
    });

    const openBulkImportModal = () => {
        showBulkImportModal.value = true;
    };

    const BulkImportModal = defineAsyncComponent(
        () => import('../components/modals/BulkImportModal.vue')
    );

    // --- Profile Modal Logic ---
    const { handleAddProfile, handleSaveProfile, editingProfile, isNewProfile, showProfileModal } =
        useProfiles(markDirty);

    const ProfileModal = defineAsyncComponent(
        () => import('../components/modals/ProfileModal.vue')
    );

    // --- Log Modal Logic ---
    const showLogModal = ref(false);
    const LogModal = defineAsyncComponent(() => import('../components/modals/LogModal.vue'));

    // Kept below the `showLogModal` declaration on purpose: this handler closes
    // over it, so co-locating them keeps the dependency obvious and immune to a
    // future refactor that might call it during setup.
    //
    // Only the PRIMARY button routes here. `item.action` is the *secondary*
    // action key and must not be consulted: an item can carry both (e.g. the
    // error card links to the filtered list AND offers "打开日志"), and reading
    // `action` here used to short-circuit the primary navigation entirely.
    const handleHealthAction = (item) => {
        if (item.actionRoute) {
            router.push({ path: item.actionRoute, query: item.actionQuery || {} });
        }
    };

    // Secondary buttons dispatch the item's own action key instead of navigating.
    const handleHealthSecondaryAction = (item) => {
        if (item.action === 'openLog') {
            showLogModal.value = true;
        }
    };

    // --- Health item dismissal ---
    // 隐藏某个待处理项只是记一条偏好，底层问题不动，所以「全部恢复」能把它放回来。
    // 这份偏好现在存在设置里并同步到服务端（跨设备生效），
    // 写入失败必须明确告知用户，否则表现为「点了没反应」且没有任何提示。
    // silent=true：忽略某个待处理项不该弹「设置已更新」，失败文案也用下面更贴切的两句。
    // preferencesOnly=true：这个字段不影响节点处理，让服务端跳过清缓存与 TG 通知。
    const persistDismissedHealthItems = async (ids) => {
        try {
            await dataStore.saveSettings(
                { dismissedHealthItems: ids },
                { silent: true, preferencesOnly: true }
            );
            return true;
        } catch {
            // saveSettings 已在控制台留下原因，这里只负责给用户一句能看懂的提示
            return false;
        }
    };

    const dismissHealthItemById = async (id) => {
        const current = dismissedHealthItemIds.value;
        // 已经忽略过就不必再往返一次服务端
        if (isHealthItemDismissed(current, id)) return;
        const persisted = await persistDismissedHealthItems(addDismissedHealthItem(current, id));
        if (!persisted) {
            showToast(t('dashboard.health.dismissFailed'), 'error');
        }
    };

    const restoreDismissedHealthItems = async () => {
        if (dismissedHealthItemIds.value.length === 0) return;
        const persisted = await persistDismissedHealthItems([]);
        if (!persisted) {
            showToast(t('dashboard.health.restoreFailed'), 'error');
        }
    };

    // 一次性迁移：旧版的忽略记录只存在本机 localStorage，不并进设置的话，
    // 升级后用户之前忽略过的项会全部复活。
    // 规则：只在服务端还没有这份列表时采用本机记录（bootstrap）；
    // 服务端已有数据就以服务端为准 —— 它更新、且汇总了所有设备，
    // 否则会把用户在别的设备上「全部恢复」掉的项又塞回来。
    // 无论走哪条分支都要清掉旧键，否则每次启动都会重复迁移。
    onMounted(async () => {
        const legacy = readLegacyDismissedHealthItemIds();
        if (legacy.length === 0) return;

        if (dismissedHealthItemIds.value.length === 0) {
            const persisted = await persistDismissedHealthItems(
                normalizeDismissedHealthItemIds(legacy)
            );
            // 写不进去就先留着旧键，下次启动再试（清了就等于把用户的记录丢了）
            if (!persisted) return;
        }
        clearLegacyDismissedHealthItemIds();
    });

    // --- QRCode Modal Logic ---
    const QRCodeModal = defineAsyncComponent(() => import('../components/modals/QRCodeModal.vue'));
    const showQRCodeModal = ref(false);
    const qrCodeUrl = ref('');
    const qrCodeTitle = ref('');

    const handleQRCode = (url, title) => {
        qrCodeUrl.value = url;
        qrCodeTitle.value = title;
        showQRCodeModal.value = true;
    };
</script>

<template>
    <div class="space-y-6">
        <div v-if="isLoading" class="p-4">
            <SkeletonLoader type="dashboard" />
        </div>

        <template v-else>
            <section
                class="relative overflow-hidden bg-white/85 dark:bg-gray-900/75 border border-gray-100/80 dark:border-white/10 misub-radius-lg p-4 sm:p-5 shadow-sm"
            >
                <div
                    class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-sky-400 to-emerald-400 opacity-80"
                ></div>
                <div
                    class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
                >
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                                {{ t('dashboard.title') }}
                            </h1>
                            <span
                                class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                                :class="readinessToneClass"
                            >
                                <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
                                {{ readinessText }}
                            </span>
                        </div>
                        <p
                            class="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1"
                        >
                            <span>{{ t('dashboard.subtitle') }}</span>
                            <span class="hidden sm:inline text-gray-500 dark:text-gray-400">|</span>
                            <span class="w-full sm:w-auto text-xs sm:text-sm"
                                >{{ t('dashboard.lastUpdate') }}: {{ lastUpdatedTime }}</span
                            >
                        </p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
                        <button
                            @click="showLogModal = true"
                            class="min-h-11 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-white/80 text-gray-700 hover:bg-white dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.07] misub-radius-lg transition-colors border border-gray-200/80 dark:border-white/10"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4 w-4 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                            {{ t('dashboard.actions.viewLog') }}
                        </button>
                        <button
                            @click="openBulkImportModal"
                            class="min-h-11 px-4 py-2.5 text-sm font-medium bg-gray-100/80 text-gray-800 hover:bg-gray-200/80 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.07] misub-radius-lg transition-colors border border-transparent dark:border-white/10"
                        >
                            {{ t('dashboard.actions.bulkImport') }}
                        </button>
                        <button
                            @click="handleAddProfile"
                            class="min-h-11 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 misub-radius-lg transition-colors shadow-sm shadow-primary-500/20"
                        >
                            {{ t('dashboard.actions.addProfile') }}
                        </button>
                    </div>
                </div>
            </section>

            <StatCards
                :formatted-total-remaining-traffic="formattedTotalRemainingTraffic"
                :traffic-stats="trafficStats"
                :active-subscriptions-count="enabledSubscriptionsCount"
                :subscriptions-count="subscriptionsCount"
                :total-nodes-count="totalNodesCount"
                :active-profiles-count="activeProfilesCount"
                @navigate="handleStatNavigate"
            />

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 space-y-6">
                    <section
                        class="bg-white/90 dark:bg-gray-900/80 p-5 misub-radius-lg shadow-sm border border-gray-100/80 dark:border-white/10"
                    >
                        <div
                            class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4"
                        >
                            <div>
                                <h3
                                    class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-5 w-5 text-amber-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                                        />
                                    </svg>
                                    {{ t('dashboard.health.title') }}
                                </h3>
                                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {{ t('dashboard.health.subtitle') }}
                                </p>
                            </div>
                            <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">{{
                                t('dashboard.health.itemsCount', {
                                    count: dashboardHealthItems.length,
                                })
                            }}</span>
                        </div>

                        <div v-if="hasHealthItems" class="grid gap-3">
                            <div
                                v-for="item in visibleHealthItems"
                                :key="item.id"
                                class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[var(--misub-radius-md)] border p-3"
                                :class="healthToneClasses[item.tone] || healthToneClasses.info"
                            >
                                <div class="flex gap-3 min-w-0">
                                    <span
                                        class="mt-2 h-2 w-2 shrink-0 rounded-full"
                                        :class="
                                            healthDotClasses[item.tone] || healthDotClasses.info
                                        "
                                    ></span>
                                    <div class="min-w-0">
                                        <p class="font-semibold">{{ item.title }}</p>
                                        <p class="mt-0.5 text-sm opacity-80">
                                            {{ item.description }}
                                        </p>
                                    </div>
                                </div>
                                <div class="flex shrink-0 flex-col sm:flex-row gap-2">
                                    <button
                                        v-if="item.actionLabel"
                                        type="button"
                                        class="min-h-10 rounded-[var(--misub-radius-md)] border border-current/20 bg-white/60 px-3 py-2 text-sm font-semibold hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 transition-colors"
                                        @click="handleHealthAction(item)"
                                    >
                                        {{ item.actionLabel }}
                                    </button>
                                    <button
                                        v-if="item.secondaryActionLabel"
                                        type="button"
                                        class="min-h-10 rounded-[var(--misub-radius-md)] border border-current/15 px-3 py-2 text-sm font-semibold opacity-80 hover:opacity-100 transition-opacity"
                                        @click="handleHealthSecondaryAction(item)"
                                    >
                                        {{ item.secondaryActionLabel }}
                                    </button>
                                    <button
                                        type="button"
                                        class="min-h-10 rounded-[var(--misub-radius-md)] px-3 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-opacity"
                                        :title="t('dashboard.health.dismissItem')"
                                        :aria-label="t('dashboard.health.dismissItem')"
                                        data-testid="health-item-dismiss"
                                        @click="dismissHealthItemById(item.id)"
                                    >
                                        {{ t('dashboard.health.dismiss') }}
                                    </button>
                                </div>
                            </div>
                            <button
                                v-if="hiddenHealthItemsCount > 0 || showAllHealthItems"
                                type="button"
                                class="min-h-10 justify-self-start rounded-[var(--misub-radius-md)] border border-gray-200/80 bg-white/70 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
                                @click="showAllHealthItems = !showAllHealthItems"
                            >
                                {{
                                    showAllHealthItems
                                        ? t('dashboard.health.showLess')
                                        : t('dashboard.health.showMore', {
                                              count: hiddenHealthItemsCount,
                                          })
                                }}
                            </button>
                        </div>
                        <div
                            v-else
                            class="rounded-[var(--misub-radius-md)] border border-emerald-200/80 bg-emerald-50/80 p-4 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                        >
                            <p class="font-semibold">{{ t('dashboard.health.allGood') }}</p>
                            <p class="mt-1 text-sm opacity-80">
                                {{ t('dashboard.health.allGoodDesc') }}
                            </p>
                        </div>
                        <button
                            v-if="dismissedHealthItemsCount > 0"
                            type="button"
                            class="justify-self-start text-sm font-medium text-gray-500 underline decoration-dotted underline-offset-4 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            data-testid="health-items-restore"
                            @click="restoreDismissedHealthItems"
                        >
                            {{
                                t('dashboard.health.restoreDismissed', {
                                    count: dismissedHealthItemsCount,
                                })
                            }}
                        </button>
                    </section>

                    <section
                        v-if="showFullGuide"
                        class="bg-white/90 dark:bg-gray-900/80 p-5 misub-radius-lg shadow-sm border border-gray-100/80 dark:border-white/10 min-h-[320px]"
                    >
                        <h3
                            class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5 mr-2 text-indigo-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            {{ t('dashboard.guide.title') }}
                        </h3>
                        <div class="grid md:grid-cols-2 gap-3">
                            <div
                                class="p-4 bg-white/80 dark:bg-gray-900/70 misub-radius-lg border border-gray-200/60 dark:border-white/10"
                            >
                                <h4 class="font-medium text-gray-900 dark:text-gray-200 mb-2">
                                    {{ t('dashboard.guide.step1Title') }}
                                </h4>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    {{ t('dashboard.guide.step1Desc') }}
                                </p>
                            </div>
                            <div
                                class="p-4 bg-white/80 dark:bg-gray-900/70 misub-radius-lg border border-gray-200/60 dark:border-white/10"
                            >
                                <h4 class="font-medium text-gray-900 dark:text-gray-200 mb-2">
                                    {{ t('dashboard.guide.step2Title') }}
                                </h4>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    {{ t('dashboard.guide.step2Desc') }}
                                </p>
                            </div>
                            <div
                                class="p-4 bg-white/80 dark:bg-gray-900/70 misub-radius-lg border border-gray-200/60 dark:border-white/10"
                            >
                                <h4 class="font-medium text-gray-900 dark:text-gray-200 mb-2">
                                    {{ t('dashboard.guide.step3Title') }}
                                </h4>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    {{ t('dashboard.guide.step3Desc') }}
                                </p>
                            </div>
                            <div
                                class="p-4 bg-white/80 dark:bg-gray-900/70 misub-radius-lg border border-gray-200/60 dark:border-white/10"
                            >
                                <h4 class="font-medium text-gray-900 dark:text-gray-200 mb-2">
                                    {{ t('dashboard.guide.step4Title') }}
                                </h4>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    {{ t('dashboard.guide.step4Desc') }}
                                </p>
                            </div>
                        </div>
                    </section>
                </div>

                <div class="lg:col-span-1">
                    <RightPanel :config="settings" :profiles="profiles" @qrcode="handleQRCode" />
                </div>
            </div>

            <BulkImportModal
                v-if="showBulkImportModal"
                :show="showBulkImportModal"
                @update:show="showBulkImportModal = $event"
                @import="(txt, tag) => handleBulkImport(txt, tag)"
                @files-imported="(nodes, group) => addNodesFromBulk(nodes, group)"
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

            <LogModal :show="showLogModal" @update:show="showLogModal = $event" />

            <QRCodeModal v-model:show="showQRCodeModal" :url="qrCodeUrl" :title="qrCodeTitle" />
        </template>
    </div>
</template>
