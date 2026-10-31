<script setup>
    import { computed, ref, nextTick, watch } from 'vue';
    import draggable from 'vuedraggable';
    import Card from '../ui/Card.vue';
    import MoreActionsMenu from '@/components/shared/MoreActionsMenu.vue';
    import PanelPagination from '@/components/shared/PanelPagination.vue';
    import EmptyState from '@/components/ui/EmptyState.vue';
    import Modal from '@/components/forms/Modal.vue';
    import { useUIStore } from '@/stores/ui';
    import { useI18n } from '@/i18n/index.js';
    import { inferAirportRootDomain } from '../../utils/airport-domain.js';
    import { lookupDomainName } from '../../utils/domain-name-memory.js';
    import {
        getAirportIdentityKey,
        getAirportIdentityName,
        createAirportGroupId,
    } from '../../utils/airport-identity.js';

    const { layoutMode } = useUIStore();
    const { t } = useI18n();

    const props = defineProps({
        subscriptions: { type: Array, default: () => [] },
        paginatedSubscriptions: Array,
        currentPage: Number,
        totalPages: Number,
        isSorting: Boolean,
        searchable: { type: Boolean, default: false },
        searchQuery: { type: String, default: '' },
        filteredCount: { type: Number, default: undefined },
        isRefreshing: { type: Boolean, default: false },
        refreshError: { type: Boolean, default: false },
        lastRefreshAt: { type: [String, Number, Date], default: null },
        statusFilter: { type: String, default: '' },
        statusFilterLabel: { type: String, default: '' },
    });

    const groupNameInput = ref('');
    const selectedAirportGroup = ref('');
    const editingSubscriptionIds = ref([]);
    const showAirportIdentityEditor = ref(false);
    const emit = defineEmits([
        'add',
        'delete',
        'changePage',
        'updateNodeCount',
        'edit',
        'toggleSort',
        'markDirty',
        'preview',
        'deleteAll',
        'refreshAll',
        'reorder',
        'import',
        'qrcode',
        'updateSearch',
        'applyDetectedName',
        'rename-group',
        'reset-group',
        'assign-airport-group',
        'split-airport-group',
        'clearStatusFilter',
    ]);

    const searchModel = computed({
        get: () => props.searchQuery,
        set: (value) => emit('updateSearch', value),
    });

    const visibleCount = computed(() => props.filteredCount ?? props.subscriptions.length);
    const refreshTime = computed(() => {
        if (!props.lastRefreshAt) return '';
        const date = new Date(props.lastRefreshAt);
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const draggableSubscriptions = computed({
        get: () => [...props.subscriptions],
        set: (val) => emit('reorder', val),
    });

    const handleDelete = (id) => emit('delete', id);
    const handleEdit = (id) => emit('edit', id);
    const handleUpdate = (id) => emit('updateNodeCount', id);
    const handlePreview = (id) => emit('preview', id);
    const handleQRCode = (id) => emit('qrcode', id);
    const handleAdd = () => emit('add');
    const handleChangePage = (page) => emit('changePage', page);
    const handleToggleSort = () => emit('toggleSort');
    const handleSortEnd = () => emit('markDirty');
    const handleDeleteAll = () => emit('deleteAll');
    const handleRefreshAll = () => emit('refreshAll');
    const handleImport = () => emit('import');

    // 应用识别到的机场名：模板内联箭头函数无法访问 emit，需用具名函数转发
    // 一键重命名整组：转发给父组件并刷新折叠标题
    const availableAirportGroups = computed(() => {
        const groups = new Map();
        props.subscriptions.forEach((item) => {
            const identity = item.airportIdentity;
            if (identity?.groupId && identity?.name) groups.set(identity.groupId, identity.name);
        });
        return [...groups].map(([groupId, name]) => ({ groupId, name }));
    });
    const handleResetGroup = (group) =>
        emit(
            'reset-group',
            group.items.map((it) => it.id)
        );
    const openAirportIdentityEditor = (ids = props.subscriptions.map((item) => item.id)) => {
        groupNameInput.value = '';
        selectedAirportGroup.value = '';
        editingSubscriptionIds.value = [...ids];
        showAirportIdentityEditor.value = true;
    };
    const saveAirportIdentity = () => {
        const name = groupNameInput.value.trim();
        const existing = props.subscriptions
            .map((item) => item.airportIdentity)
            .find((identity) => identity?.groupId === selectedAirportGroup.value);
        if (!selectedAirportGroup.value && !name) return;
        const groupId = selectedAirportGroup.value || createAirportGroupId();
        emit('assign-airport-group', [...editingSubscriptionIds.value], {
            groupId,
            name: existing?.name || name,
        });
        showAirportIdentityEditor.value = false;
    };
    const handleSplitAirportGroup = (group) => {
        // 禁止后续域名启发式再次合并：每个订阅获得独立身份，但保留可识别的显示名。
        group.items.forEach((item) => {
            emit('split-airport-group', [item.id], {
                groupId: createAirportGroupId(),
                name: item.airportIdentity?.name || groupDetectedName(group),
            });
        });
    };
    const handleConfirmDetectedName = (group) => {
        const name = groupDetectedName(group);
        if (!name) return;
        const retainedGroupId = group.items
            .map((item) => item.airportIdentity?.groupId)
            .find(Boolean);
        emit(
            'rename-group',
            group.items.map((item) => item.id),
            name,
            retainedGroupId || createAirportGroupId()
        );
        setTimeout(refreshNameMemory, 0);
    };

    const handleApplyDetectedName = (subscription, name) => {
        emit('applyDetectedName', subscription?.id, name);
        // 父组件同步写入命名记忆，放到下一个 tick 刷新折叠标题
        setTimeout(refreshNameMemory, 0);
    };

    /**
     * 取该折叠组可用于重命名的名字（基础名）。
     * 优先级：
     *   1. 组内任一订阅的识别名（detectedName，来自 Profile-Title / 官网标题）
     *   2. 组域名推断出的品牌名（如 gsafevpn.com -> Gsafevpn）
     *   3. 组域名原文
     * 始终返回非空（除非组本身无 host），保证按钮可用。
     */
    const prettifyHost = (host) => {
        const raw = String(host || '').trim();
        if (!raw) return '';
        // 先去掉 sub1/api/dy11 之类的子域前缀，拿到机场主域名
        const root = inferAirportRootDomain(`https://${raw}`) || raw;
        const parts = root.split('.');
        let main = parts[0];
        // Root domain inference already excludes public-suffix labels (e.g. com.cn/co.uk).
        // 去掉带分隔符的常见拼接后缀（如 xxx-vpn），再首字母大写
        // 注意：不剥离「紧贴」的 vpn（gsafevpn 应保留为 Gsafevpn）
        const cleaned = main
            .replace(/[-_](vpn|proxy|cloud|services?|network|sub|node)$/i, '')
            .replace(/[-_]+/g, ' ')
            .trim();
        const base = cleaned || main;
        return base.charAt(0).toUpperCase() + base.slice(1);
    };

    const groupDetectedName = (group) => {
        const hit = (group?.items || []).find(
            (item) => typeof item?.detectedName === 'string' && item.detectedName.trim()
        );
        if (hit) return hit.detectedName.trim();
        if (group?.host) return prettifyHost(group.host);
        return '';
    };

    /**
     * 折叠组的显示名（标题栏）：
     *   1. 该域名记住的机场名（用户确认过，最准）
     *   2. 组内任一订阅的识别名
     *   3. 组域名
     */
    // 命名记忆存于 localStorage（非响应式），用一个版本号触发重算，
    // 使「重命名整组 / 应用识别名」后折叠标题立即更新。
    const nameMemoryVersion = ref(0);

    const groupDisplayName = (group) => {
        // 依赖 version，改名后自动重算
        void nameMemoryVersion.value;
        const confirmed = (group?.items || []).map(getAirportIdentityName).find(Boolean);
        if (confirmed) return confirmed;
        const host = group?.host || '';
        if (host) {
            const rootDomain = inferAirportRootDomain(`https://${host}`) || host;
            const remembered = lookupDomainName(rootDomain);
            if (remembered) return remembered;
        }
        const detected = groupDetectedName(group);
        if (detected) return detected;
        return host || t('subscriptions.otherSources');
    };

    /** 通知命名记忆已更新，触发折叠标题重算 */
    const refreshNameMemory = () => {
        nameMemoryVersion.value += 1;
    };

    // === 按站点自动折叠 ===
    // 同一家机场常有多个订阅链接（域名相同、路径 token 不同），逐个平铺会很乱。
    // 这里按 URL 的域名自动聚合，同一站点的订阅源折叠为一组，可展开查看。
    const collapsedGroups = ref(new Set());
    const knownGroupKeys = ref(new Set());

    /**
     * 从 URL 提取稳定的分组身份。
     * 普通域名按推断出的机场根域聚合（子域、路径 token 不影响）；
     * 在公共托管平台上不能将 tenants 合并到平台根域，保留其 tenant 主机名。
     */
    const siteKeyOf = (sub) => {
        const inferredKey = getAirportIdentityKey(sub);
        return inferredKey.startsWith('identity:')
            ? inferredKey
            : inferredKey.slice('site:'.length);
    };

    /**
     * 始终按完整筛选结果分组，避免分页把同一机场的订阅拆散到不同页；
     * 页面切换由分组列表分页，而非先分页订阅再尝试分组。
     */
    const groupedSubscriptions = computed(() => {
        const list = props.subscriptions || [];
        const order = [];
        const map = new Map();

        list.forEach((sub) => {
            const key = siteKeyOf(sub) || '';
            if (!map.has(key)) {
                map.set(key, []);
                order.push(key);
            }
            map.get(key).push(sub);
        });

        return order.map((key) => ({
            key: key || '__other__',
            host: key,
            items: map.get(key),
        }));
    });

    /** 只有多条目站点才值得折叠；单条目站点直接平铺，避免多余的展开操作。 */
    const collapsibleGroups = computed(() =>
        groupedSubscriptions.value.filter((g) => g.items.length > 1)
    );

    const pageSubscriptionIds = computed(
        () => new Set((props.paginatedSubscriptions || []).map((sub) => sub.id))
    );

    /** 当前分页命中组内任一条时显示组；组本身完整呈现但按首条排序锚定。 */
    const visibleCollapsibleGroups = computed(() =>
        collapsibleGroups.value.filter((group) =>
            group.items.some((item) => pageSubscriptionIds.value.has(item.id))
        )
    );

    /** 单条目站点仅在当前页平铺展示。 */
    const ungroupedSubscriptions = computed(() =>
        groupedSubscriptions.value
            .filter((g) => g.items.length === 1 && pageSubscriptionIds.value.has(g.items[0].id))
            .flatMap((g) => g.items)
    );

    const toggleGroup = (key) => {
        const next = new Set(collapsedGroups.value);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        collapsedGroups.value = next;
    };

    const isGroupCollapsed = (key) => collapsedGroups.value.has(key);

    // 仅对新出现的分组应用默认折叠；过滤/分页更新时保留用户手动展开状态。
    // 已消失分组的状态保留在本组件生命周期内，避免搜索/分页切换后忘记用户选择。
    watch(
        collapsibleGroups,
        (groups) => {
            const next = new Set(collapsedGroups.value);
            groups.forEach((group) => {
                if (!knownGroupKeys.value.has(group.key)) next.add(group.key);
            });
            groups.forEach((group) => knownGroupKeys.value.add(group.key));
            collapsedGroups.value = next;
        },
        { immediate: true }
    );

    const isGrouped = computed(() => collapsibleGroups.value.length > 0);

    const collapseAllGroups = () => {
        collapsedGroups.value = new Set(collapsibleGroups.value.map((g) => g.key));
    };

    const expandAllGroups = () => {
        collapsedGroups.value = new Set();
    };
</script>

<template>
    <div>
        <div
            class="mb-4 rounded-xl border border-gray-100/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/70"
        >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div class="min-w-0">
                    <div class="flex items-center gap-3 shrink-0">
                        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                            {{ t('subscriptions.title') }}
                        </h2>
                        <span
                            class="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200"
                            >{{ visibleCount }}/{{ subscriptions.length }}</span
                        >
                    </div>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{ t('subscriptions.subtitle') }}
                    </p>
                    <p
                        data-testid="subscriptions-refresh-status"
                        aria-live="polite"
                        class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                    >
                        <span v-if="isRefreshing">{{ t('subscriptions.refreshing') }}</span>
                        <span v-else-if="refreshError">{{
                            t('subscriptions.refreshFailedShort')
                        }}</span>
                        <span v-else-if="refreshTime">{{
                            t('subscriptions.lastRefreshed', { time: refreshTime })
                        }}</span>
                    </p>
                </div>
                <div
                    class="flex flex-wrap items-center gap-2 sm:w-auto justify-end sm:justify-start"
                >
                    <button
                        v-if="subscriptions.length > 1"
                        type="button"
                        class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                        :title="t('subscriptions.assignAirportGroup')"
                        @click.stop="openAirportIdentityEditor()"
                    >
                        {{ t('subscriptions.assignAirportGroup') }}
                    </button>

                    <button
                        @click="handleImport"
                        class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                    >
                        {{ t('actions.bulkImport') }}
                    </button>
                    <button
                        v-if="isGrouped && !isSorting"
                        @click="collapseAllGroups"
                        class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                    >
                        {{ t('subscriptions.collapseAll') }}
                    </button>
                    <button
                        v-if="isGrouped && !isSorting"
                        @click="expandAllGroups"
                        class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                    >
                        {{ t('subscriptions.expandAll') }}
                    </button>
                    <button
                        @click="handleAdd"
                        class="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                    >
                        {{ t('actions.add') }}
                    </button>
                    <MoreActionsMenu menu-width-class="w-36">
                        <template #menu="{ close }">
                            <button
                                @click="
                                    handleRefreshAll();
                                    close();
                                "
                                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                {{ t('actions.refreshAll') }}
                            </button>
                            <button
                                @click="
                                    handleToggleSort();
                                    close();
                                "
                                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                {{ isSorting ? t('actions.finishSort') : t('actions.manualSort') }}
                            </button>
                            <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                            <button
                                @click="
                                    handleDeleteAll();
                                    close();
                                "
                                class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-500/10"
                            >
                                {{ t('actions.clearAll') }}
                            </button>
                        </template>
                    </MoreActionsMenu>
                </div>
            </div>
            <div v-if="searchable" class="relative mt-4">
                <svg
                    class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                    v-model="searchModel"
                    data-testid="subscription-search"
                    type="search"
                    :placeholder="t('subscriptions.listSearchPlaceholder')"
                    :aria-label="t('subscriptions.searchPlaceholder')"
                    :disabled="isSorting"
                    class="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-20 text-sm text-gray-900 outline-none transition focus:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
                />
                <span
                    v-if="searchQuery"
                    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400"
                >
                    {{ visibleCount }}/{{ subscriptions.length }}
                </span>
            </div>

            <div
                v-if="statusFilter"
                data-testid="subscription-status-filter"
                class="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200"
            >
                <span>{{ statusFilterLabel }}</span>
                <span class="opacity-70">{{ visibleCount }}/{{ subscriptions.length }}</span>
                <button
                    type="button"
                    data-testid="subscription-status-filter-clear"
                    class="ml-auto font-semibold underline underline-offset-2 hover:opacity-80"
                    @click="emit('clearStatusFilter')"
                >
                    {{ t('subscriptions.clearStatusFilter') }}
                </button>
            </div>
        </div>
        <div v-if="subscriptions.length > 0 && isSorting">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <draggable
                    tag="div"
                    class="contents"
                    v-model="draggableSubscriptions"
                    item-key="id"
                    animation="300"
                    @end="handleSortEnd"
                >
                    <template #item="{ element: subscription }">
                        <div class="cursor-move">
                            <Card
                                :misub="subscription"
                                @delete="handleDelete(subscription.id)"
                                @change="handleSortEnd"
                                @update="handleUpdate(subscription.id)"
                                @edit="handleEdit(subscription.id)"
                                @preview="handlePreview(subscription.id)"
                                @qrcode="handleQRCode(subscription.id)"
                                @applyDetectedName="
                                    (name) => handleApplyDetectedName(subscription, name)
                                "
                            />
                        </div>
                    </template>
                </draggable>
            </div>
        </div>
        <div v-else-if="paginatedSubscriptions.length > 0" class="space-y-4">
            <!-- 按站点分组：同站点的多个订阅源折叠为一组 -->
            <template v-if="isGrouped">
                <template v-for="group in visibleCollapsibleGroups" :key="group.key">
                    <div
                        class="rounded-xl border border-gray-100/80 bg-white/70 shadow-sm dark:border-white/10 dark:bg-gray-900/50"
                    >
                        <div class="flex w-full items-center justify-between gap-3 px-4 py-3">
                            <button
                                type="button"
                                :aria-expanded="String(!isGroupCollapsed(group.key))"
                                class="flex min-w-0 flex-1 items-center gap-2 text-left"
                                @click="toggleGroup(group.key)"
                            >
                                <svg
                                    class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400 transition-transform"
                                    :class="isGroupCollapsed(group.key) ? '-rotate-90' : ''"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                                <span
                                    class="truncate font-semibold text-gray-800 dark:text-gray-100"
                                    >{{ groupDisplayName(group) }}</span
                                >
                                <span
                                    class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300"
                                    >{{ group.items.length }}</span
                                >
                            </button>
                            <div class="flex shrink-0 items-center gap-2">
                                <button
                                    v-if="groupDetectedName(group)"
                                    type="button"
                                    class="rounded-md border border-primary-500/30 px-2 py-1 text-[11px] font-medium text-primary-500 transition-colors hover:bg-primary-500/10 dark:text-primary-400"
                                    :title="
                                        t('subscriptions.renameGroupHint', {
                                            name: groupDetectedName(group),
                                        })
                                    "
                                    @click.stop="handleConfirmDetectedName(group)"
                                >
                                    {{ t('subscriptions.renameGroup') }}
                                </button>
                                <button
                                    type="button"
                                    class="rounded-md border border-gray-300/60 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-500/10 dark:border-white/15 dark:text-gray-300"
                                    :title="t('subscriptions.assignAirportGroup')"
                                    @click.stop="
                                        openAirportIdentityEditor(
                                            group.items.map((item) => item.id)
                                        )
                                    "
                                >
                                    {{ t('subscriptions.assignAirportGroup') }}
                                </button>
                                <button
                                    v-if="group.items.length > 1"
                                    type="button"
                                    class="rounded-md border border-gray-300/60 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-500/10 dark:border-white/15 dark:text-gray-300"
                                    :title="t('subscriptions.splitAirportGroup')"
                                    @click.stop="handleSplitAirportGroup(group)"
                                >
                                    {{ t('subscriptions.splitAirportGroup') }}
                                </button>
                                <button
                                    v-if="group.items.some((item) => item.airportIdentity?.groupId)"
                                    type="button"
                                    class="rounded-md border border-gray-300/60 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-500/10 dark:border-white/15 dark:text-gray-300"
                                    :title="t('subscriptions.automaticAirportIdentity')"
                                    @click.stop="handleResetGroup(group)"
                                >
                                    {{ t('subscriptions.automaticAirportIdentity') }}
                                </button>
                                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                                    isGroupCollapsed(group.key)
                                        ? t('subscriptions.expand')
                                        : t('subscriptions.collapse')
                                }}</span>
                            </div>
                        </div>
                        <div
                            v-show="!isGroupCollapsed(group.key)"
                            class="grid grid-cols-1 gap-4 border-t border-gray-100/80 p-4 md:grid-cols-2 dark:border-white/10"
                        >
                            <div
                                v-for="(subscription, index) in group.items"
                                :key="subscription.id"
                                class="list-item-animation"
                                :style="{ '--delay-index': index }"
                            >
                                <Card
                                    :misub="subscription"
                                    @delete="handleDelete(subscription.id)"
                                    @change="handleSortEnd"
                                    @update="handleUpdate(subscription.id)"
                                    @edit="handleEdit(subscription.id)"
                                    @preview="handlePreview(subscription.id)"
                                    @qrcode="handleQRCode(subscription.id)"
                                    @applyDetectedName="
                                        (name) => handleApplyDetectedName(subscription, name)
                                    "
                                />
                            </div>
                        </div>
                    </div>
                </template>
                <div
                    v-if="ungroupedSubscriptions.length > 0"
                    class="grid grid-cols-1 gap-4 md:grid-cols-2"
                >
                    <div
                        v-for="(subscription, index) in ungroupedSubscriptions"
                        :key="subscription.id"
                        class="list-item-animation"
                        :style="{ '--delay-index': index }"
                    >
                        <Card
                            :misub="subscription"
                            @delete="handleDelete(subscription.id)"
                            @change="handleSortEnd"
                            @update="handleUpdate(subscription.id)"
                            @edit="handleEdit(subscription.id)"
                            @preview="handlePreview(subscription.id)"
                            @qrcode="handleQRCode(subscription.id)"
                            @applyDetectedName="
                                (name) => handleApplyDetectedName(subscription, name)
                            "
                        />
                    </div>
                </div>
            </template>
            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div
                    v-for="(subscription, index) in paginatedSubscriptions"
                    :key="subscription.id"
                    class="list-item-animation"
                    :style="{ '--delay-index': index }"
                >
                    <Card
                        :misub="subscription"
                        @delete="handleDelete(subscription.id)"
                        @change="handleSortEnd"
                        @update="handleUpdate(subscription.id)"
                        @edit="handleEdit(subscription.id)"
                        @preview="handlePreview(subscription.id)"
                        @qrcode="handleQRCode(subscription.id)"
                        @applyDetectedName="(name) => handleApplyDetectedName(subscription, name)"
                    />
                </div>
            </div>
        </div>
        <div
            v-else-if="searchable && searchQuery && filteredCount === 0"
            data-testid="subscription-no-search-results"
            class="rounded-xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900/50"
        >
            <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ t('subscriptions.noSearchResults') }}
            </p>
            <button
                data-testid="clear-subscription-search"
                type="button"
                class="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                @click="searchModel = ''"
            >
                {{ t('actions.clearSearch') }}
            </button>
        </div>
        <div
            v-else-if="subscriptions.length === 0"
            class="rounded-xl border border-dashed border-gray-300 bg-white/60 py-6 dark:border-gray-700 dark:bg-gray-900/50"
        >
            <EmptyState
                :title="t('subscriptions.empty')"
                :description="t('subscriptions.emptyDesc')"
                icon="folder"
                :total-count="0"
            />
            <div class="-mt-8 mb-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                    data-testid="empty-add-subscription"
                    @click="handleAdd"
                    class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                >
                    {{ t('subscriptions.addEmpty') }}
                </button>
                <button
                    data-testid="empty-import-subscriptions"
                    @click="handleImport"
                    class="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                >
                    {{ t('actions.bulkImport') }}
                </button>
            </div>
        </div>
        <div v-if="!isSorting && totalPages > 1" class="mt-4">
            <PanelPagination
                variant="panel"
                :current-page="currentPage"
                :total-pages="totalPages"
                :total-items="visibleCount"
                :show-total-items="true"
                @change-page="handleChangePage"
            />
        </div>
        <Modal
            :show="showAirportIdentityEditor"
            size="md"
            :confirm-text="t('subscriptions.saveAirportIdentity')"
            :confirm-disabled="!selectedAirportGroup && !groupNameInput.trim()"
            @update:show="showAirportIdentityEditor = $event"
            @confirm="saveAirportIdentity"
        >
            <template #title>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                    {{ t('subscriptions.assignAirportGroup') }}
                </h3>
            </template>
            <template #body>
                <div class="space-y-4">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ t('subscriptions.chooseAirportGroup') }}
                    </p>
                    <select
                        v-model="selectedAirportGroup"
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary-500 dark:border-white/15 dark:bg-gray-800 dark:text-white"
                    >
                        <option value="">{{ t('subscriptions.newAirportGroupName') }}</option>
                        <option
                            v-for="airport in availableAirportGroups"
                            :key="airport.groupId"
                            :value="airport.groupId"
                        >
                            {{ airport.name }}
                        </option>
                    </select>
                    <input
                        v-if="!selectedAirportGroup"
                        v-model="groupNameInput"
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary-500 dark:border-white/15 dark:bg-gray-800 dark:text-white"
                        :placeholder="t('subscriptions.newAirportGroupName')"
                    />
                </div>
            </template>
        </Modal>
    </div>
</template>

<style scoped>
    .cursor-move {
        cursor: move;
    }
</style>
