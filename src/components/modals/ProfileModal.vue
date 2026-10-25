<script setup>
    import { ref, watch, computed } from 'vue';
    import Modal from '../forms/Modal.vue';
    import ProfileForm from './ProfileModal/ProfileForm.vue';
    import SubscriptionSelector from './ProfileModal/SubscriptionSelector.vue';
    import SubProfileSelector from './ProfileModal/SubProfileSelector.vue';
    import NodeSelector from './ProfileModal/NodeSelector.vue';
    import { useManualNodes } from '../../composables/useManualNodes.js';
    import { useDataStore } from '../../stores/useDataStore.js';
    import { useSettingsStore } from '../../stores/settings.js';
    import { useI18n } from '@/i18n/index.js';
    import { DEFAULT_GROUP_KEY } from '@/composables/manual-nodes/groups.js';

    const { t } = useI18n();
    const dataStore = useDataStore();
    const settingsStore = useSettingsStore();
    const { manualNodeGroups } = useManualNodes(dataStore.markDirty);

    const props = defineProps({
        show: Boolean,
        profile: Object,
        isNew: Boolean,
        allSubscriptions: Array,
        allManualNodes: Array,
    });

    const emit = defineEmits(['update:show', 'save']);

    const localProfile = ref({});
    const subscriptionSearchTerm = ref('');
    const subProfileSearchTerm = ref('');
    const nodeSearchTerm = ref('');
    const activeResourceTab = ref('subscriptions');
    const activeManualNodeGroupFilter = ref(null);
    const showAdvanced = ref(false);
    const uiText = computed(() => ({
        prefixTitle: t('profileModal.nodeNameVisibility'),
        manualPrefixLabel: t('profileModal.manualPrefixText'),
        manualPrefixToggle: t('profileModal.manualNodeDisplay'),
        subscriptionPrefixToggle: t('profileModal.subscriptionPrefix'),
        enable: t('profiles.optionEnabled'),
        disable: t('profiles.optionDisabled'),
    }));
    const prefixToggleOptions = [
        { label: t('profiles.globalDefault'), value: null },
        { label: t('profiles.optionEnabled'), value: true },
        { label: t('profiles.optionDisabled'), value: false },
    ];

    const groupPrefixToggleOptions = [
        { label: t('profiles.globalDefault'), value: null },
        { label: t('profiles.optionEnabled'), value: true },
        { label: t('profiles.optionDisabled'), value: false },
    ];

    // 国家/地区代码到旗帜和中文名称的映射
    const countryCodeMap = {
        hk: ['🇭🇰', '香港'],
        tw: ['🇨🇳', '台湾', '臺灣'],
        sg: ['🇸🇬', '新加坡', '狮城'],
        jp: ['🇯🇵', '日本'],
        us: ['🇺🇸', '美国', '美國'],
        kr: ['🇰🇷', '韩国', '韓國'],
        gb: ['🇬🇧', '英国', '英國'],
        de: ['🇩🇪', '德国', '德國'],
        fr: ['🇫🇷', '法国', '法國'],
        ca: ['🇨🇦', '加拿大'],
        au: ['🇦🇺', '澳大利亚', '澳洲', '澳大利亞'],
        cn: ['🇨🇳', '中国', '大陸', '内地'],
        my: ['🇲🇾', '马来西亚', '馬來西亞'],
        th: ['🇹🇭', '泰国', '泰國'],
        vn: ['🇻🇳', '越南'],
        ph: ['🇵🇭', '菲律宾', '菲律賓'],
        id: ['🇮🇩', '印度尼西亚', '印尼'],
        in: ['🇮🇳', '印度'],
        pk: ['🇵🇰', '巴基斯坦'],
        bd: ['🇧🇩', '孟加拉国', '孟加拉國'],
        ae: ['🇦🇪', '阿联酋', '阿聯酋'],
        sa: ['🇸🇦', '沙特阿拉伯'],
        tr: ['🇹🇷', '土耳其'],
        ru: ['🇷🇺', '俄罗斯', '俄羅斯'],
        br: ['🇧🇷', '巴西'],
        mx: ['🇲🇽', '墨西哥'],
        ar: ['🇦🇷', '阿根廷'],
        cl: ['🇨🇱', '智利'],
        za: ['🇿🇦', '南非'],
        eg: ['🇪🇬', '埃及'],
        ng: ['🇳🇬', '尼日利亚', '尼日利亞'],
        ke: ['🇰🇪', '肯尼亚', '肯尼亞'],
        il: ['🇮🇱', '以色列'],
        ir: ['🇮🇷', '伊朗'],
        iq: ['🇮🇶', '伊拉克'],
        ua: ['🇺🇦', '乌克兰', '烏克蘭'],
        pl: ['🇵🇱', '波兰', '波蘭'],
        cz: ['🇨🇿', '捷克'],
        hu: ['🇭🇺', '匈牙利'],
        ro: ['🇷🇴', '罗马尼亚', '羅馬尼亞'],
        gr: ['🇬🇷', '希腊', '希臘'],
        pt: ['🇵🇹', '葡萄牙'],
        es: ['🇪🇸', '西班牙'],
        it: ['🇮🇹', '意大利'],
        nl: ['🇳🇱', '荷兰', '荷蘭'],
        be: ['🇧🇪', '比利时', '比利時'],
        se: ['🇸🇪', '瑞典'],
        no: ['🇳🇴', '挪威'],
        dk: ['🇩🇰', '丹麦', '丹麥'],
        fi: ['🇫🇮', '芬兰', '芬蘭'],
        ch: ['🇨🇭', '瑞士'],
        at: ['🇦🇹', '奥地利', '奧地利'],
        ie: ['🇮🇪', '爱尔兰', '愛爾蘭'],
        nz: ['🇳🇿', '新西兰', '紐西蘭'],
    };

    const selectableSubscriptions = computed(() => {
        return (props.allSubscriptions || []).filter(
            (sub) => sub.enabled && sub.url && /^https?:\/\//.test(sub.url)
        );
    });

    const filteredSubscriptions = computed(() => {
        const validSubs = selectableSubscriptions.value;

        if (!subscriptionSearchTerm.value) {
            return validSubs;
        }
        const lowerCaseSearchTerm = subscriptionSearchTerm.value.toLowerCase();
        const alternativeTerms = countryCodeMap[lowerCaseSearchTerm] || [];

        return validSubs.filter((sub) => {
            const subNameLower = sub.name ? sub.name.toLowerCase() : '';

            if (subNameLower.includes(lowerCaseSearchTerm)) {
                return true;
            }

            for (const altTerm of alternativeTerms) {
                if (subNameLower.includes(altTerm.toLowerCase())) {
                    return true;
                }
            }
            return false;
        });
    });

    const selectableSubProfiles = computed(() => {
        const currentId = localProfile.value?.id || props.profile?.id;
        return (dataStore.profiles || []).filter((p) => {
            if (!p) return false;
            if (currentId && (p.id === currentId || p.customId === currentId)) {
                return false;
            }
            return p.enabled !== false;
        });
    });

    const filteredSubProfiles = computed(() => {
        const list = selectableSubProfiles.value;
        if (!subProfileSearchTerm.value) {
            return list;
        }
        const lowerCaseSearchTerm = subProfileSearchTerm.value.toLowerCase();
        const alternativeTerms = countryCodeMap[lowerCaseSearchTerm] || [];

        return list.filter((p) => {
            const pNameLower = p.name ? p.name.toLowerCase() : '';
            const pDescLower = p.description ? p.description.toLowerCase() : '';
            const pIdLower = p.customId ? p.customId.toLowerCase() : '';

            if (
                pNameLower.includes(lowerCaseSearchTerm) ||
                pDescLower.includes(lowerCaseSearchTerm) ||
                pIdLower.includes(lowerCaseSearchTerm)
            ) {
                return true;
            }

            for (const altTerm of alternativeTerms) {
                if (pNameLower.includes(altTerm.toLowerCase())) {
                    return true;
                }
            }
            return false;
        });
    });

    const filteredManualNodes = computed(() => {
        let nodes = props.allManualNodes;

        if (activeManualNodeGroupFilter.value) {
            if (activeManualNodeGroupFilter.value === DEFAULT_GROUP_KEY) {
                nodes = nodes.filter((n) => !n.group);
            } else {
                nodes = nodes.filter((n) => n.group === activeManualNodeGroupFilter.value);
            }
        }

        if (!nodeSearchTerm.value) {
            return nodes;
        }
        const lowerCaseSearchTerm = nodeSearchTerm.value.toLowerCase();
        const alternativeTerms = countryCodeMap[lowerCaseSearchTerm] || [];

        return nodes.filter((node) => {
            const nodeNameLower = node.name ? node.name.toLowerCase() : '';

            if (nodeNameLower.includes(lowerCaseSearchTerm)) {
                return true;
            }

            for (const altTerm of alternativeTerms) {
                if (nodeNameLower.includes(altTerm.toLowerCase())) {
                    return true;
                }
            }
            return false;
        });
    });

    watch(
        () => props.profile,
        (newProfile) => {
            if (newProfile) {
                const profileCopy = JSON.parse(JSON.stringify(newProfile));
                // Format date for input[type=date]
                if (profileCopy.expiresAt) {
                    try {
                        profileCopy.expiresAt = new Date(profileCopy.expiresAt)
                            .toISOString()
                            .split('T')[0];
                    } catch (e) {
                        console.error('Error parsing expiresAt date:', e);
                        profileCopy.expiresAt = '';
                    }
                }
                if (!profileCopy.prefixSettings || typeof profileCopy.prefixSettings !== 'object') {
                    profileCopy.prefixSettings = {};
                }
                profileCopy.prefixSettings.enableManualNodes =
                    profileCopy.prefixSettings.enableManualNodes ?? null;
                profileCopy.prefixSettings.enableSubscriptions =
                    profileCopy.prefixSettings.enableSubscriptions ?? null;
                profileCopy.prefixSettings.manualNodePrefix =
                    profileCopy.prefixSettings.manualNodePrefix ?? '';
                profileCopy.prefixSettings.prependGroupName =
                    profileCopy.prefixSettings.prependGroupName ?? null;

                if (
                    Object.prototype.hasOwnProperty.call(
                        profileCopy.prefixSettings,
                        'enableNodeEmoji'
                    )
                ) {
                    delete profileCopy.prefixSettings.enableNodeEmoji;
                }

                // 确保 subconverter 对象存在
                if (!profileCopy.subconverter || typeof profileCopy.subconverter !== 'object') {
                    profileSub: profileCopy.subconverter = {
                        engineMode: '',
                        backend: '',
                        options: {
                            udp: null,
                            emoji: null,
                            scv: null,
                            sort: null,
                            tfo: null,
                            list: null,
                        },
                    };
                } else {
                    // 补充缺失的 options 字段，支持 null (即跟随全局)
                    profileCopy.subconverter.options = profileCopy.subconverter.options || {};
                    const fields = ['udp', 'emoji', 'scv', 'sort', 'tfo', 'list'];
                    fields.forEach((f) => {
                        if (profileCopy.subconverter.options[f] === undefined) {
                            profileCopy.subconverter.options[f] = null;
                        }
                    });
                }

                // 确保 operators 数组存在
                profileCopy.operators = Array.isArray(profileCopy.operators)
                    ? profileCopy.operators
                    : [];

                // 确保 subProfiles 数组存在
                profileCopy.subProfiles = Array.isArray(profileCopy.subProfiles)
                    ? profileCopy.subProfiles
                    : [];

                localProfile.value = profileCopy;
            } else {
                localProfile.value = {
                    name: '',
                    enabled: true,
                    subscriptions: [],
                    subProfiles: [],
                    manualNodes: [],
                    customId: '',
                    expiresAt: '',
                    isPublic: true,
                    description: '',
                    prefixSettings: {
                        enableManualNodes: null,
                        enableSubscriptions: null,
                        manualNodePrefix: '',
                        prependGroupName: null,
                    },
                    operators: [],
                };
            }
        },
        { deep: true, immediate: true }
    );

    const handleConfirm = () => {
        const profileToSave = JSON.parse(JSON.stringify(localProfile.value));
        if (profileToSave.expiresAt) {
            try {
                // Set time to the end of the selected day in local time, then convert to ISO string
                const date = new Date(profileToSave.expiresAt);
                date.setHours(23, 59, 59, 999);
                profileToSave.expiresAt = date.toISOString();
            } catch (e) {
                console.error('Error processing expiresAt date:', e);
                // Decide how to handle error: save as is, or clear it
                profileToSave.expiresAt = '';
            }
        }
        // 顺序已由用户通过拖拽确定，无需额外排序
        emit('save', profileToSave);
    };

    const toggleSelection = (listName, id) => {
        const list = localProfile.value[listName];
        const index = list.indexOf(id);
        if (index > -1) {
            list.splice(index, 1);
        } else {
            list.push(id);
        }
    };

    const handleSelectAll = (listName, sourceArray) => {
        const currentSelection = new Set(localProfile.value[listName]);
        sourceArray.forEach((item) => currentSelection.add(item.id));
        localProfile.value[listName] = Array.from(currentSelection);
    };

    const handleDeselectAll = (listName, sourceArray) => {
        const sourceIds = sourceArray.map((item) => item.id);
        localProfile.value[listName] = localProfile.value[listName].filter(
            (id) => !sourceIds.includes(id)
        );
    };

    // 处理拖拽排序后的 ID 顺序更新
    const updateSelectedIds = (listName, newIds) => {
        localProfile.value[listName] = newIds;
    };
</script>

<template>
    <Modal
        :show="show"
        @update:show="emit('update:show', $event)"
        @confirm="handleConfirm"
        size="6xl"
    >
        <template #title>
            <div class="flex items-center gap-3">
                <div class="p-2 misub-radius-lg bg-indigo-500/10">
                    <!-- Folder Icon for Profile -->
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6 text-indigo-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                    </svg>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white">
                        {{ isNew ? t('profiles.addTitle') : t('profiles.editTitle') }}
                    </h3>
                    <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        {{ t('profiles.modalDescription') }}
                    </p>
                </div>
            </div>
        </template>
        <template #body>
            <div v-if="localProfile" class="space-y-6">
                <ProfileForm
                    :local-profile="localProfile"
                    :show-advanced="showAdvanced"
                    :ui-text="uiText"
                    :prefix-toggle-options="prefixToggleOptions"
                    :group-prefix-toggle-options="groupPrefixToggleOptions"
                    :global-settings="dataStore.settings"
                    @toggle-advanced="showAdvanced = !showAdvanced"
                />

                <!-- 资源类型 Tab 切换栏 -->
                <div class="border-b border-gray-200 dark:border-gray-700">
                    <nav
                        class="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto pb-1"
                        aria-label="Tabs"
                    >
                        <button
                            type="button"
                            @click="activeResourceTab = 'subscriptions'"
                            :class="[
                                activeResourceTab === 'subscriptions'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200',
                                'whitespace-nowrap pb-3 px-2 border-b-2 font-medium text-sm flex items-center gap-1.5 transition-colors cursor-pointer',
                            ]"
                        >
                            <span>📡 {{ t('profileModal.tabSubscriptions') }}</span>
                            <span
                                v-if="localProfile.subscriptions?.length"
                                class="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-semibold"
                            >
                                {{ localProfile.subscriptions.length }}
                            </span>
                        </button>

                        <button
                            type="button"
                            @click="activeResourceTab = 'subProfiles'"
                            :class="[
                                activeResourceTab === 'subProfiles'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200',
                                'whitespace-nowrap pb-3 px-2 border-b-2 font-medium text-sm flex items-center gap-1.5 transition-colors cursor-pointer',
                            ]"
                        >
                            <span>🧩 {{ t('profileModal.tabSubProfiles') }}</span>
                            <span
                                v-if="localProfile.subProfiles?.length"
                                class="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-semibold"
                            >
                                {{ localProfile.subProfiles.length }}
                            </span>
                        </button>

                        <button
                            type="button"
                            @click="activeResourceTab = 'manualNodes'"
                            :class="[
                                activeResourceTab === 'manualNodes'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200',
                                'whitespace-nowrap pb-3 px-2 border-b-2 font-medium text-sm flex items-center gap-1.5 transition-colors cursor-pointer',
                            ]"
                        >
                            <span>📌 {{ t('profileModal.tabManualNodes') }}</span>
                            <span
                                v-if="localProfile.manualNodes?.length"
                                class="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-semibold"
                            >
                                {{ localProfile.manualNodes.length }}
                            </span>
                        </button>

                        <button
                            type="button"
                            @click="activeResourceTab = 'all'"
                            :class="[
                                activeResourceTab === 'all'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200',
                                'whitespace-nowrap pb-3 px-2 border-b-2 font-medium text-sm flex items-center gap-1.5 transition-colors cursor-pointer',
                            ]"
                        >
                            <span>⚡ {{ t('profileModal.tabAll') }}</span>
                        </button>
                    </nav>
                </div>

                <div
                    :class="
                        activeResourceTab === 'all'
                            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                            : 'space-y-6'
                    "
                >
                    <div
                        v-show="
                            activeResourceTab === 'subscriptions' || activeResourceTab === 'all'
                        "
                    >
                        <SubscriptionSelector
                            :subscriptions="selectableSubscriptions"
                            :filtered-subscriptions="filteredSubscriptions"
                            :search-term="subscriptionSearchTerm"
                            :selected-ids="localProfile.subscriptions || []"
                            @update:search-term="subscriptionSearchTerm = $event"
                            @update:selected-ids="updateSelectedIds('subscriptions', $event)"
                            @toggle-selection="toggleSelection('subscriptions', $event)"
                            @select-all="handleSelectAll('subscriptions', filteredSubscriptions)"
                            @deselect-all="
                                handleDeselectAll('subscriptions', filteredSubscriptions)
                            "
                        />
                    </div>

                    <div
                        v-show="activeResourceTab === 'subProfiles' || activeResourceTab === 'all'"
                    >
                        <SubProfileSelector
                            :profiles="selectableSubProfiles"
                            :filtered-profiles="filteredSubProfiles"
                            :search-term="subProfileSearchTerm"
                            :selected-ids="localProfile.subProfiles || []"
                            :target-profile-id="localProfile.id || props.profile?.id || ''"
                            :all-profiles="dataStore.profiles || []"
                            @update:search-term="subProfileSearchTerm = $event"
                            @update:selected-ids="updateSelectedIds('subProfiles', $event)"
                            @toggle-selection="toggleSelection('subProfiles', $event)"
                            @select-all="handleSelectAll('subProfiles', $event)"
                            @deselect-all="handleDeselectAll('subProfiles', filteredSubProfiles)"
                        />
                    </div>

                    <div
                        v-show="activeResourceTab === 'manualNodes' || activeResourceTab === 'all'"
                    >
                        <NodeSelector
                            :nodes="allManualNodes"
                            :filtered-nodes="filteredManualNodes"
                            :search-term="nodeSearchTerm"
                            :active-group-filter="activeManualNodeGroupFilter"
                            :groups="manualNodeGroups"
                            :selected-ids="localProfile.manualNodes || []"
                            @update:search-term="nodeSearchTerm = $event"
                            @update:group-filter="activeManualNodeGroupFilter = $event"
                            @update:selected-ids="updateSelectedIds('manualNodes', $event)"
                            @toggle-selection="toggleSelection('manualNodes', $event)"
                            @select-all="handleSelectAll('manualNodes', filteredManualNodes)"
                            @deselect-all="handleDeselectAll('manualNodes', filteredManualNodes)"
                        />
                    </div>
                </div>
            </div>
        </template>
    </Modal>
</template>
