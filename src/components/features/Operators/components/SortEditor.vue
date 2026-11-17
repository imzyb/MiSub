<script setup>
    import { computed, ref } from 'vue';
    import { useI18n } from '../../../../i18n/index.js';
    import draggable from 'vuedraggable';
    import { REGION_EMOJI } from '../../../../../functions/modules/utils/geo-utils.js';

    const props = defineProps({
        modelValue: {
            type: Object,
            default: () => ({}),
        },
    });

    const emit = defineEmits(['update:modelValue']);
    const { t } = useI18n();
    const regexDrafts = ref({});
    const regexErrors = ref({});
    // 按行下标与条件类型暂存已编辑的 customOrder，防止切换条件类型后配置丢失
    const stashedCustomOrders = ref({});
    const CUSTOM_ORDER_KEYS = new Set(['region', 'protocol', 'regex']);

    const swapIndexedMap = (mapObj, idxA, idxB) => {
        const next = { ...mapObj };
        const valA = next[idxA];
        const valB = next[idxB];
        if (valB === undefined) delete next[idxA];
        else next[idxA] = valB;
        if (valA === undefined) delete next[idxB];
        else next[idxB] = valA;
        return next;
    };

    const removeIndexedEntry = (mapObj, removedIdx) => {
        const next = {};
        for (const [k, v] of Object.entries(mapObj)) {
            const num = Number(k);
            if (num < removedIdx) next[num] = v;
            else if (num > removedIdx) next[num - 1] = v;
        }
        return next;
    };

    const omitIndexedEntry = (mapObj, idx) => {
        if (!(idx in mapObj)) return mapObj;
        const next = { ...mapObj };
        delete next[idx];
        return next;
    };

    const params = computed({
        get: () => ({
            keys: [],
            ...props.modelValue,
        }),
        set: (val) => emit('update:modelValue', val),
    });

    const updateKeys = (updater) => {
        const currentKeys = Array.isArray(params.value.keys) ? params.value.keys : [];
        params.value = {
            ...params.value,
            keys: updater([...currentKeys]),
        };
    };

    const DEFAULT_CUSTOM_ORDERS = {
        region: [
            '香港',
            '台湾',
            '日本',
            '新加坡',
            '美国',
            '韩国',
            '英国',
            '德国',
            '法国',
            '加拿大',
        ],
        protocol: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr', 'anytls'],
    };

    const getDefaultCustomOrder = (keyType) => [...(DEFAULT_CUSTOM_ORDERS[keyType] || [])];

    const addKey = () => {
        updateKeys((keys) => [
            ...keys,
            { key: 'region', order: 'asc', customOrder: getDefaultCustomOrder('region') },
        ]);
    };

    const removeKey = (index) => {
        updateKeys((keys) => {
            keys.splice(index, 1);
            return keys;
        });
        regexDrafts.value = removeIndexedEntry(regexDrafts.value, index);
        regexErrors.value = removeIndexedEntry(regexErrors.value, index);
        stashedCustomOrders.value = removeIndexedEntry(stashedCustomOrders.value, index);
    };

    const moveKey = (index, dir) => {
        const currentLen = Array.isArray(params.value.keys) ? params.value.keys.length : 0;
        const target = index + dir;
        if (target < 0 || target >= currentLen) return;
        updateKeys((keys) => {
            [keys[index], keys[target]] = [keys[target], keys[index]];
            return keys;
        });
        regexDrafts.value = swapIndexedMap(regexDrafts.value, index, target);
        regexErrors.value = swapIndexedMap(regexErrors.value, index, target);
        stashedCustomOrders.value = swapIndexedMap(stashedCustomOrders.value, index, target);
    };

    const updateKeyField = (index, field, value) => {
        let nextDrafts = regexDrafts.value;
        let nextErrors = regexErrors.value;
        let nextStashed = stashedCustomOrders.value;

        updateKeys((keys) => {
            const current = keys[index];
            if (!current) return keys;
            let next = { ...current, [field]: value };
            if (field === 'key' && current.key !== value) {
                const rowStash = { ...(nextStashed[index] || {}) };
                if (CUSTOM_ORDER_KEYS.has(current.key) && Array.isArray(current.customOrder)) {
                    rowStash[current.key] = [...current.customOrder];
                }

                const restoredOrder = rowStash[value];
                if (Array.isArray(restoredOrder)) {
                    next.customOrder = [...restoredOrder];
                    delete rowStash[value];
                } else {
                    next.customOrder = getDefaultCustomOrder(value);
                }

                if (Object.keys(rowStash).length > 0) {
                    nextStashed = { ...nextStashed, [index]: rowStash };
                } else {
                    nextStashed = omitIndexedEntry(nextStashed, index);
                }

                if (value === 'regex') {
                    next.order = 'asc';
                }

                nextDrafts = omitIndexedEntry(nextDrafts, index);
                nextErrors = omitIndexedEntry(nextErrors, index);
            }
            keys[index] = next;
            return keys;
        });

        regexDrafts.value = nextDrafts;
        regexErrors.value = nextErrors;
        stashedCustomOrders.value = nextStashed;
    };

    const getRegionEmoji = (region) => {
        if (!region) return '🌐';
        return REGION_EMOJI[region] || '🌍';
    };

    const getTagsList = (item) => {
        return (item.customOrder || []).map((val) => ({ id: val, name: val }));
    };

    const handleDragEnd = (idx, newOrder) => {
        updateKeys((keys) => {
            const current = keys[idx];
            if (!current) return keys;
            keys[idx] = {
                ...current,
                customOrder: newOrder.map((item) => item.name),
            };
            return keys;
        });
    };

    const resetToDefaultOrder = (idx, keyType) => {
        updateKeys((keys) => {
            const current = keys[idx];
            if (!current) return keys;
            keys[idx] = { ...current, customOrder: getDefaultCustomOrder(keyType) };
            return keys;
        });
    };

    const clearRegexError = (idx) => {
        regexErrors.value = omitIndexedEntry(regexErrors.value, idx);
    };

    const handleRegexEnter = (event, idx) => {
        if (event?.isComposing || event?.keyCode === 229) return;
        event?.preventDefault?.();
        addCustomOrderItem(idx);
    };

    const addCustomOrderItem = (idx) => {
        const raw = String(regexDrafts.value[idx] || '').trim();
        if (!raw) return;
        try {
            new RegExp(raw, 'i');
        } catch {
            regexErrors.value = {
                ...regexErrors.value,
                [idx]: t('operators.invalidRegexError'),
            };
            return;
        }
        clearRegexError(idx);
        updateKeys((keys) => {
            const current = keys[idx];
            if (!current) return keys;
            const existing = Array.isArray(current.customOrder) ? current.customOrder : [];
            if (!existing.includes(raw)) {
                keys[idx] = {
                    ...current,
                    customOrder: [...existing, raw],
                };
            }
            return keys;
        });
        regexDrafts.value = omitIndexedEntry(regexDrafts.value, idx);
    };

    const removeCustomOrderItem = (idx, tagIdx) => {
        updateKeys((keys) => {
            const current = keys[idx];
            if (!current) return keys;
            const nextOrder = [...(current.customOrder || [])];
            nextOrder.splice(tagIdx, 1);
            keys[idx] = { ...current, customOrder: nextOrder };
            return keys;
        });
    };

    const clearCustomOrder = (idx) => {
        updateKeys((keys) => {
            const current = keys[idx];
            if (!current) return keys;
            keys[idx] = { ...current, customOrder: [] };
            return keys;
        });
        clearRegexError(idx);
    };

    const getPriorityTypeLabelKey = (key) => {
        if (key === 'region') return 'operators.sortKeyRegion';
        if (key === 'protocol') return 'operators.sortKeyProtocol';
        return 'operators.sortKeyRegex';
    };

    const availableKeys = [
        { value: 'region', labelKey: 'operators.sortKeyRegion' },
        { value: 'protocol', labelKey: 'operators.sortKeyProtocol' },
        { value: 'name', labelKey: 'operators.sortKeyName' },
        { value: 'regex', labelKey: 'operators.sortKeyRegex' },
        { value: 'group', labelKey: 'operators.sortKeyGroup' },
        { value: 'server', labelKey: 'operators.sortKeyServer' },
        { value: 'port', labelKey: 'operators.sortKeyPort' },
    ];

    const regionLabels = {
        香港: 'Hong Kong',
        台湾: 'Taiwan',
        日本: 'Japan',
        新加坡: 'Singapore',
        美国: 'United States',
        韩国: 'South Korea',
        英国: 'United Kingdom',
        德国: 'Germany',
        法国: 'France',
        加拿大: 'Canada',
    };
    const displayTagName = (item, name) =>
        item.key === 'region'
            ? `${getRegionEmoji(name)} ${t('operators.regionLabel', { region: regionLabels[name] || name })}`
            : name;
</script>

<template>
    <div class="space-y-3">
        <div class="flex items-center justify-between">
            <label
                class="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight"
                >{{ t('operators.sortWeights') }}</label
            >
            <button @click="addKey" class="text-[10px] text-indigo-600 font-bold">
                + {{ t('operators.addCondition') }}
            </button>
        </div>

        <div class="space-y-1.5">
            <div
                v-for="(item, idx) in params.keys"
                :key="idx"
                class="flex flex-col gap-2 p-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 transition-all"
            >
                <div class="flex items-center gap-2">
                    <div class="flex flex-col">
                        <button
                            @click="moveKey(idx, -1)"
                            class="text-gray-500 dark:text-gray-400 hover:text-indigo-500 disabled:opacity-20"
                            :disabled="idx === 0"
                            :aria-label="t('actions.moveUp')"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-2.5 w-2.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path d="M5 15l7-7 7 7" />
                            </svg>
                        </button>
                        <button
                            @click="moveKey(idx, 1)"
                            class="text-gray-500 dark:text-gray-400 hover:text-indigo-500 disabled:opacity-20"
                            :disabled="idx === params.keys.length - 1"
                            :aria-label="t('actions.moveDown')"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-2.5 w-2.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    <select
                        :value="item.key"
                        @change="updateKeyField(idx, 'key', $event.target.value)"
                        class="flex-1 bg-transparent border-none p-0 text-[11px] font-medium text-gray-900 dark:text-gray-100 focus-visible:ring-0 outline-none"
                    >
                        <option
                            v-for="k in availableKeys"
                            :key="k.value"
                            :value="k.value"
                            class="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                        >
                            {{ t(k.labelKey) }}
                        </option>
                    </select>

                    <select
                        v-if="item.key !== 'regex'"
                        :value="item.order"
                        @change="updateKeyField(idx, 'order', $event.target.value)"
                        class="w-14 bg-transparent border-none p-0 text-[11px] text-gray-600 dark:text-gray-300 focus-visible:ring-0 outline-none"
                    >
                        <option
                            value="asc"
                            class="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                        >
                            {{ t('operators.ascending') }}
                        </option>
                        <option
                            value="desc"
                            class="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                        >
                            {{ t('operators.descending') }}
                        </option>
                    </select>

                    <button
                        @click="removeKey(idx)"
                        class="p-1 text-gray-500 dark:text-gray-400 hover:text-rose-500 touch-target"
                        :aria-label="t('operators.removeSortKey')"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Custom Order Editor Section -->
                <div
                    v-if="item.key === 'region' || item.key === 'protocol' || item.key === 'regex'"
                    class="mt-0.5 p-2 bg-white dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-900 space-y-2"
                >
                    <div class="flex items-center justify-between text-[10px]">
                        <span
                            class="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight flex items-center gap-1"
                        >
                            {{
                                t('operators.customPriorityOrder', {
                                    type: t(getPriorityTypeLabelKey(item.key)),
                                })
                            }}
                        </span>
                        <button
                            v-if="item.key === 'region' || item.key === 'protocol'"
                            type="button"
                            @click="resetToDefaultOrder(idx, item.key)"
                            class="text-indigo-500 hover:text-indigo-600 font-bold"
                        >
                            {{ t('operators.resetDefault') }}
                        </button>
                        <button
                            v-else-if="(item.customOrder || []).length > 0"
                            type="button"
                            @click="clearCustomOrder(idx)"
                            class="text-rose-500 hover:text-rose-600 font-bold"
                        >
                            {{ t('operators.clearAll') }}
                        </button>
                    </div>

                    <!-- Regex Input Row -->
                    <div v-if="item.key === 'regex'" class="space-y-1">
                        <div class="flex items-center gap-1.5">
                            <input
                                v-model="regexDrafts[idx]"
                                type="text"
                                @input="clearRegexError(idx)"
                                @keydown.enter="handleRegexEnter($event, idx)"
                                :placeholder="t('operators.regexPinPlaceholder')"
                                :class="[
                                    'flex-1 px-2.5 py-1 text-[11px] rounded-md bg-gray-50 dark:bg-gray-900 border text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-800 transition-all outline-none',
                                    regexErrors[idx]
                                        ? 'border-rose-400 dark:border-rose-500/70 focus:border-rose-500'
                                        : 'border-gray-200/70 dark:border-gray-800 focus:border-indigo-500/40',
                                ]"
                            />
                            <button
                                type="button"
                                @click="addCustomOrderItem(idx)"
                                class="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-colors shrink-0"
                            >
                                + {{ t('operators.add') }}
                            </button>
                        </div>
                        <p v-if="regexErrors[idx]" class="text-[10px] text-rose-500">
                            {{ regexErrors[idx] }}
                        </p>
                    </div>

                    <!-- Drag and Drop Tags List -->
                    <draggable
                        :model-value="getTagsList(item)"
                        @update:model-value="(newOrder) => handleDragEnd(idx, newOrder)"
                        item-key="id"
                        animation="200"
                        class="flex flex-wrap gap-1.5"
                    >
                        <template #item="{ element, index }">
                            <div
                                class="cursor-grab active:cursor-grabbing inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100/80 dark:hover:bg-indigo-500/20 transition-colors select-none"
                            >
                                <span v-if="item.key === 'regex'" class="opacity-60 font-mono"
                                    >{{ index + 1 }}.</span
                                >
                                <span>{{ displayTagName(item, element.name) }}</span>
                                <button
                                    v-if="item.key === 'regex'"
                                    type="button"
                                    @click.stop="removeCustomOrderItem(idx, index)"
                                    class="ml-0.5 text-indigo-400 hover:text-rose-500 transition-colors leading-none"
                                    :aria-label="t('operators.removeRule')"
                                >
                                    ×
                                </button>
                            </div>
                        </template>
                    </draggable>

                    <div
                        v-if="!(item.customOrder || []).length"
                        class="text-[9px] text-gray-500 dark:text-gray-400 italic"
                    >
                        {{
                            t(
                                item.key === 'regex'
                                    ? 'operators.emptyRegexPriorityItems'
                                    : 'operators.emptyPriorityItems'
                            )
                        }}
                    </div>
                </div>
            </div>

            <div
                v-if="params.keys.length === 0"
                class="text-center py-2 text-[10px] text-gray-500 dark:text-gray-400 italic"
            >
                {{ t('operators.emptySortConditions') }}
            </div>
        </div>
        <p class="text-[10px] text-gray-500 dark:text-gray-400">{{ t('operators.sortHint') }}</p>
    </div>
</template>
