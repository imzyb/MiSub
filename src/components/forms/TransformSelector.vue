<script setup>
    import { computed, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import { getLocalizedTransformAssets } from '@/constants/transform-assets';
    import { useDataStore } from '@/stores/useDataStore.js';
    import { useI18n } from '../../i18n/index.js';

    const { t } = useI18n();

    const props = defineProps({
        modelValue: { type: String, default: '' },
        type: { type: String, required: true },
        placeholder: { type: String, default: '' },
        allowEmpty: { type: Boolean, default: true },
        forceCustom: { type: Boolean, default: false },
        // ⚠️ 默认值不能写成 t('...')：prop 的 default 在组件定义时就被求值，
        // 那时候 i18n 还没初始化，而且切换语言也不会重新求值。
        // 这里只留空字符串，真正的兜底文案交给下面的 resolvedCustomPlaceholder。
        customPlaceholder: { type: String, default: '' },
        excludeBuiltinAssets: { type: Boolean, default: false },
        customTemplatesOnly: { type: Boolean, default: false },
    });

    const emit = defineEmits(['update:modelValue', 'select-asset']);
    const dataStore = useDataStore();
    const { ruleTemplates } = storeToRefs(dataStore);

    const resolvedCustomPlaceholder = computed(
        () => props.customPlaceholder || t('transformSelector.customPlaceholder')
    );

    // 模板变量说明是「显示文案」，必须放在 computed 里求值：
    // ① 顶层常量只在组件创建时算一次，切换语言不会更新；
    // ② computed 里调用 t() 会经 locale.value 建立响应式依赖，切语言即时生效。
    const templateVariableGroups = computed(() => [
        {
            title: t('transformSelector.varGroupBasic'),
            items: [
                { key: '<%proxies%>', example: t('transformSelector.varProxies') },
                { key: '<%rules%>', example: t('transformSelector.varRules') },
                { key: '<%file_name%>', example: t('transformSelector.varFileName') },
                { key: '<%target_format%>', example: t('transformSelector.varTargetFormat') },
                { key: '<%node_count%>', example: t('transformSelector.varNodeCount') },
            ],
        },
        {
            title: t('transformSelector.varGroupStrategy'),
            items: [
                {
                    key: '<%primary_strategy_chain%>',
                    example: t('transformSelector.varPrimaryStrategyChain'),
                },
                {
                    key: '<%region_strategy_chain%>',
                    example: t('transformSelector.varRegionStrategyChain'),
                },
                {
                    key: '<%protocol_strategy_chain%>',
                    example: t('transformSelector.varProtocolStrategyChain'),
                },
                {
                    key: '<%all_strategy_groups%>',
                    example: t('transformSelector.varAllStrategyGroups'),
                },
            ],
        },
        {
            title: t('transformSelector.varGroupDetail'),
            items: [
                {
                    key: '<%region_group_names%>',
                    example: t('transformSelector.varRegionGroupNames'),
                },
                {
                    key: '<%region_group_counts%>',
                    example: t('transformSelector.varRegionGroupCounts'),
                },
                {
                    key: '<%region_group_list%>',
                    example: t('transformSelector.varRegionGroupList'),
                },
                {
                    key: '<%protocol_group_names%>',
                    example: t('transformSelector.varProtocolGroupNames'),
                },
                {
                    key: '<%protocol_group_counts%>',
                    example: t('transformSelector.varProtocolGroupCounts'),
                },
                {
                    key: '<%protocol_group_list%>',
                    example: t('transformSelector.varProtocolGroupList'),
                },
            ],
        },
    ]);

    const customTemplateAssets = computed(() => {
        if (props.excludeBuiltinAssets) return [];

        return (ruleTemplates.value || [])
            .filter((item) => item && item.enabled !== false && item.id)
            .map((item) => ({
                id: `custom:${item.id}`,
                name: item.name || t('transformSelector.unnamedTemplate'),
                url: `custom:${item.id}`,
                group: t('transformSelector.customTemplateGroup'),
                sourceType: 'custom-template',
                description: item.description || t('transformSelector.customTemplateDescription'),
            }));
    });

    const assets = computed(() => {
        if (props.customTemplatesOnly) return customTemplateAssets.value;

        // 在 computed 里解析模板名称，切换语言时下拉框即时更新。
        const builtinAndRemote = getLocalizedTransformAssets(t).filter((item) => {
            if (!props.excludeBuiltinAssets) return true;
            return !String(item.url || '').startsWith('builtin:');
        });
        return [...customTemplateAssets.value, ...builtinAndRemote];
    });

    const missingCustomTemplateValue = computed(() => {
        const value = String(props.modelValue || '').trim();
        if (!props.customTemplatesOnly || !value.startsWith('custom:')) return '';
        return customTemplateAssets.value.some((item) => item.url === value) ? '' : value;
    });

    const groupedConfigs = computed(() => {
        if (props.type !== 'config') return {};

        const groups = {};
        assets.value.forEach((item) => {
            const group = item.group || t('transformSelector.otherGroup');
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
        });
        return groups;
    });

    const isCustom = ref(false);
    const selectedUrl = ref('');
    const showTemplateVariables = ref(false);

    watch(
        () => props.modelValue,
        (newVal) => {
            if (props.forceCustom) {
                isCustom.value = true;
                selectedUrl.value = 'custom';
                emit('select-asset', null);
                return;
            }

            if (props.customTemplatesOnly) {
                const foundCustom = assets.value.find((item) => item.url === newVal);
                selectedUrl.value = foundCustom ? newVal : '';
                isCustom.value = false;
                emit('select-asset', foundCustom || null);
                return;
            }

            if (props.excludeBuiltinAssets && String(newVal || '').startsWith('builtin:')) {
                selectedUrl.value = '';
                isCustom.value = false;
                emit('select-asset', null);
                return;
            }

            if (isCustom.value && newVal !== '' && newVal !== selectedUrl.value) return;

            const found = assets.value.find((item) => item.url === newVal);
            if (found) {
                selectedUrl.value = newVal;
                isCustom.value = false;
                emit('select-asset', found);
            } else if (newVal && String(newVal).trim() !== '') {
                selectedUrl.value = 'custom';
                isCustom.value = true;
                emit('select-asset', null);
            } else {
                selectedUrl.value = '';
                isCustom.value = false;
                emit('select-asset', null);
            }
        },
        { immediate: true }
    );

    watch(
        () => props.forceCustom,
        (newVal) => {
            if (newVal) {
                isCustom.value = true;
                selectedUrl.value = 'custom';
                emit('select-asset', null);
            } else if (!props.modelValue) {
                isCustom.value = false;
                selectedUrl.value = '';
                emit('select-asset', null);
            }
        },
        { immediate: true }
    );

    const handleSelectChange = (e) => {
        if (props.forceCustom) return;

        const val = e.target.value;
        if (val === 'custom' && !props.customTemplatesOnly) {
            isCustom.value = true;
            emit('select-asset', null);
            emit('update:modelValue', '');
            return;
        }

        isCustom.value = false;
        selectedUrl.value = val;
        emit('select-asset', assets.value.find((item) => item.url === val) || null);
        emit('update:modelValue', val);
    };

    const handleCustomInput = (e) => {
        emit('update:modelValue', e.target.value);
    };

    const switchToSelect = () => {
        if (props.forceCustom) return;

        isCustom.value = false;
        selectedUrl.value = '';
        emit('select-asset', null);
        emit('update:modelValue', '');
    };

    const helperText = computed(() => {
        if (props.customTemplatesOnly) {
            return t('transformSelector.helperCustomTemplatesOnly');
        }
        if (props.excludeBuiltinAssets) {
            return t('transformSelector.helperExcludeBuiltin');
        }
        return t('transformSelector.helperDefault');
    });
</script>

<template>
    <div>
        <div
            v-if="type === 'config' && excludeBuiltinAssets"
            class="mb-3 rounded-lg border border-amber-300/60 bg-amber-50/90 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200"
        >
            {{ t('transformSelector.thirdPartyNotice') }}
        </div>

        <div v-if="!isCustom" class="relative">
            <select
                :value="selectedUrl"
                @change="handleSelectChange"
                class="block w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm shadow-xs focus:border-indigo-500 focus-visible:outline-hidden focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
                <option value="">
                    {{
                        placeholder ||
                        (allowEmpty
                            ? t('transformSelector.defaultGlobalOption')
                            : t('transformSelector.pleaseSelect'))
                    }}
                </option>

                <optgroup
                    v-for="(items, groupName) in groupedConfigs"
                    :key="groupName"
                    :label="groupName"
                >
                    <option v-for="item in items" :key="item.id" :value="item.url">
                        {{ item.name }}
                    </option>
                </optgroup>

                <option
                    v-if="!customTemplatesOnly"
                    value="custom"
                    class="border-t font-bold text-indigo-600 dark:text-indigo-400"
                >
                    {{ t('transformSelector.customInputOption') }}
                </option>
            </select>
            <div
                class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300"
            >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </div>
        </div>

        <div v-else class="w-full">
            <div class="flex items-center gap-2">
                <div class="relative flex-grow">
                    <input
                        type="text"
                        :value="modelValue"
                        @input="handleCustomInput"
                        :placeholder="resolvedCustomPlaceholder"
                        class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus-visible:outline-hidden focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        :aria-label="resolvedCustomPlaceholder"
                    />
                </div>
                <button
                    @click="switchToSelect"
                    class="flex-shrink-0 rounded-lg bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 hover:text-indigo-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-indigo-400"
                    :title="t('operators.backToList')"
                    :aria-label="t('operators.backToList')"
                >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 6h16M4 12h16M4 18h16"
                        />
                    </svg>
                </button>
            </div>
            <p
                v-if="modelValue"
                class="mt-1 truncate text-xs text-indigo-500"
                :title="t('transformSelector.currentCustomValue')"
            >
                {{ t('transformSelector.currentValue') }}: {{ modelValue }}
            </p>
        </div>

        <div
            v-if="missingCustomTemplateValue"
            class="mt-2 rounded-lg border border-amber-300/60 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200"
        >
            <span>{{ t('transformSelector.missingTemplatePrefix') }}</span
            ><code class="font-mono">{{ missingCustomTemplateValue }}</code
            ><span>{{ t('transformSelector.missingTemplateSuffix') }}</span>
        </div>

        <div
            v-if="type === 'config'"
            class="mt-3 rounded-lg border border-gray-200 bg-gray-50/80 text-xs dark:border-gray-700 dark:bg-gray-800/40"
        >
            <button
                type="button"
                class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-100/70 dark:hover:bg-gray-700/30"
                :aria-expanded="showTemplateVariables"
                @click="showTemplateVariables = !showTemplateVariables"
            >
                <span>
                    <span class="font-medium text-gray-700 dark:text-gray-200">{{
                        t('transformSelector.templateVariablesTitle')
                    }}</span>
                    <span class="ml-2 text-[11px] text-gray-500 dark:text-gray-400">{{
                        helperText
                    }}</span>
                </span>
                <svg
                    class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400 transition-transform"
                    :class="showTemplateVariables ? 'rotate-180' : ''"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>
            <div
                v-if="showTemplateVariables"
                class="grid gap-3 border-t border-gray-200 p-3 md:grid-cols-2 dark:border-gray-700"
            >
                <div
                    v-for="group in templateVariableGroups"
                    :key="group.title"
                    class="rounded-lg border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/20"
                >
                    <p class="font-medium text-gray-700 dark:text-gray-200">{{ group.title }}</p>
                    <div class="mt-2 space-y-2">
                        <div v-for="item in group.items" :key="item.key">
                            <code class="text-[11px] text-indigo-600 dark:text-indigo-300">{{
                                item.key
                            }}</code>
                            <p class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                {{ t('transformSelector.exampleLabel') }}: {{ item.example }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
