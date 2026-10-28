<script setup>
    import { computed } from 'vue';
    import { useI18n } from '../../../i18n/index.js';

    const { t } = useI18n();

    const props = defineProps({
        editingSubscription: {
            type: Object,
            required: true,
        },
        isRuleExpanded: {
            type: Boolean,
            default: false,
        },
        isAdvancedMode: {
            type: Boolean,
            default: false,
        },
        ruleMode: {
            type: String,
            default: 'exclude',
        },
        customKeyword: {
            type: String,
            default: '',
        },
        selectedRules: {
            type: Array,
            default: () => [],
        },
        keepRules: {
            type: Array,
            default: () => [],
        },
        excludeRules: {
            type: Array,
            default: () => [],
        },
        presetRegions: {
            type: Array,
            default: () => [],
        },
        presetProtocols: {
            type: Array,
            default: () => [],
        },
        presetKeywords: {
            type: Array,
            default: () => [],
        },
        excludeRuleState: {
            type: Object,
            required: true,
        },
        toggleTag: {
            type: Function,
            required: true,
        },
        isSelected: {
            type: Function,
            required: true,
        },
        isOtherSelected: {
            type: Function,
            default: () => false,
        },
        addCustomKeyword: {
            type: Function,
            required: true,
        },
        removeRule: {
            type: Function,
            required: true,
        },
        removeKeepRule: {
            type: Function,
            default: null,
        },
        removeExcludeRule: {
            type: Function,
            default: null,
        },
        switchToAdvanced: {
            type: Function,
            required: true,
        },
        switchToVisual: {
            type: Function,
            required: true,
        },
    });

    const emit = defineEmits(['toggle-expand', 'update:ruleMode', 'update:customKeyword']);

    const ruleModeModel = computed({
        get: () => props.ruleMode,
        set: (val) => emit('update:ruleMode', val),
    });

    const customKeywordModel = computed({
        get: () => props.customKeyword,
        set: (val) => emit('update:customKeyword', val),
    });

    const effectiveKeepRules = computed(() => {
        if (props.keepRules && props.keepRules.length > 0) return props.keepRules;
        if (props.ruleMode === 'keep') return props.selectedRules;
        return [];
    });

    const effectiveExcludeRules = computed(() => {
        if (props.excludeRules && props.excludeRules.length > 0) return props.excludeRules;
        if (props.ruleMode === 'exclude') return props.selectedRules;
        return [];
    });

    const handleRemoveKeep = (index) => {
        if (props.removeKeepRule) {
            props.removeKeepRule(index);
        } else {
            props.removeRule(index, 'keep');
        }
    };

    const handleRemoveExclude = (index) => {
        if (props.removeExcludeRule) {
            props.removeExcludeRule(index);
        } else {
            props.removeRule(index, 'exclude');
        }
    };
</script>

<template>
    <!-- 包含/排除节点 -->
    <div class="border border-gray-200 dark:border-gray-700 misub-radius-md overflow-hidden">
        <!-- 折叠头部 -->
        <div
            class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        >
            <button
                type="button"
                @click="emit('toggle-expand')"
                :aria-expanded="isRuleExpanded"
                aria-controls="sub-edit-rule-content"
                class="flex flex-1 items-center gap-2 text-left cursor-pointer"
            >
                <div class="flex items-center gap-2">
                    <svg
                        class="w-4 h-4 text-gray-500 transition-transform duration-200"
                        :class="{ 'rotate-90': isRuleExpanded }"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                    <span
                        class="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                        >{{ t('subscriptions.includeExclude') }}</span
                    >
                    <span
                        v-if="selectedRules.length > 0"
                        class="px-1.5 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
                    >
                        {{ selectedRules.length }}
                    </span>
                </div>
            </button>
            <div class="flex items-center gap-2" @click.stop>
                <button
                    v-if="!isAdvancedMode"
                    @click="switchToAdvanced"
                    class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                    {{ t('subscriptions.advancedMode') }}
                </button>
                <button
                    v-else
                    @click="switchToVisual"
                    class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                    {{ t('subscriptions.visualMode') }}
                </button>
            </div>
        </div>

        <!-- 内容区域 -->
        <Transition name="collapse">
            <div
                v-show="isRuleExpanded"
                id="sub-edit-rule-content"
                class="px-4 py-3 border-t border-gray-200 dark:border-gray-700"
            >
                <!-- 可视化模式 -->
                <div v-if="!isAdvancedMode" class="space-y-3">
                    <!-- 模式选择（保留白名单 vs 剔除黑名单） -->
                    <div class="flex gap-2">
                        <button
                            type="button"
                            @click="ruleModeModel = 'keep'"
                            :aria-pressed="ruleModeModel === 'keep'"
                            :class="[
                                'flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium misub-radius-md transition-all !min-h-0 !min-w-0 cursor-pointer',
                                ruleModeModel === 'keep'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 ring-1 ring-emerald-400 dark:ring-emerald-600 font-semibold'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                            ]"
                        >
                            <span>{{ t('subscriptions.keepMode') }}</span>
                            <span
                                v-if="effectiveKeepRules.length > 0"
                                class="px-1.5 py-0.2 rounded-full text-xs bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100"
                            >
                                {{ effectiveKeepRules.length }}
                            </span>
                        </button>
                        <button
                            type="button"
                            @click="ruleModeModel = 'exclude'"
                            :aria-pressed="ruleModeModel === 'exclude'"
                            :class="[
                                'flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium misub-radius-md transition-all !min-h-0 !min-w-0 cursor-pointer',
                                ruleModeModel === 'exclude'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 ring-1 ring-amber-400 dark:ring-amber-600 font-semibold'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                            ]"
                        >
                            <span>{{ t('subscriptions.excludeMode') }}</span>
                            <span
                                v-if="effectiveExcludeRules.length > 0"
                                class="px-1.5 py-0.2 rounded-full text-xs bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100"
                            >
                                {{ effectiveExcludeRules.length }}
                            </span>
                        </button>
                    </div>

                    <!-- 地区标签 -->
                    <div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                            📍 {{ t('subscriptions.region') }}
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            <button
                                v-for="tag in presetRegions"
                                :key="tag.pattern"
                                type="button"
                                @click="toggleTag(tag, 'region')"
                                :aria-pressed="isSelected(tag.pattern)"
                                :class="[
                                    'px-2.5 py-1 text-xs sm:text-sm font-medium misub-radius-md transition-all !min-h-0 !min-w-0 cursor-pointer',
                                    isSelected(tag.pattern)
                                        ? ruleModeModel === 'keep'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 ring-1 ring-emerald-400 dark:ring-emerald-600'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 ring-1 ring-amber-400 dark:ring-amber-600'
                                        : isOtherSelected(tag.pattern)
                                          ? 'bg-gray-50 text-gray-500 dark:bg-gray-800/80 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100'
                                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                                ]"
                            >
                                {{ tag.icon }} {{ tag.label }}
                            </button>
                        </div>
                    </div>

                    <!-- 协议标签 -->
                    <div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                            📡 {{ t('subscriptions.protocol') }}
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            <button
                                v-for="tag in presetProtocols"
                                :key="tag.pattern"
                                type="button"
                                @click="toggleTag(tag, 'protocol')"
                                :aria-pressed="isSelected(tag.pattern)"
                                :class="[
                                    'px-2.5 py-1 text-xs sm:text-sm font-medium misub-radius-md transition-all !min-h-0 !min-w-0 cursor-pointer',
                                    isSelected(tag.pattern)
                                        ? ruleModeModel === 'keep'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 ring-1 ring-emerald-400 dark:ring-emerald-600'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 ring-1 ring-amber-400 dark:ring-amber-600'
                                        : isOtherSelected(tag.pattern)
                                          ? 'bg-gray-50 text-gray-500 dark:bg-gray-800/80 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100'
                                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                                ]"
                            >
                                {{ tag.label }}
                            </button>
                        </div>
                    </div>

                    <!-- 关键词标签 -->
                    <div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                            🏷️ {{ t('subscriptions.keyword') }}
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            <button
                                v-for="tag in presetKeywords"
                                :key="tag.pattern"
                                type="button"
                                @click="toggleTag(tag, 'keyword')"
                                :aria-pressed="isSelected(tag.pattern)"
                                :class="[
                                    'px-2.5 py-1 text-xs sm:text-sm font-medium misub-radius-md transition-all !min-h-0 !min-w-0 cursor-pointer',
                                    isSelected(tag.pattern)
                                        ? ruleModeModel === 'keep'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 ring-1 ring-emerald-400 dark:ring-emerald-600'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 ring-1 ring-amber-400 dark:ring-amber-600'
                                        : isOtherSelected(tag.pattern)
                                          ? 'bg-gray-50 text-gray-500 dark:bg-gray-800/80 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100'
                                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                                ]"
                            >
                                {{ tag.label }}
                            </button>
                        </div>
                    </div>

                    <!-- 自定义关键字输入 -->
                    <div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                            ✏️ {{ t('subscriptions.customKeyword') }}
                        </div>
                        <div class="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                v-model="customKeywordModel"
                                @keyup.enter="addCustomKeyword"
                                :placeholder="t('subscriptions.keywordPlaceholder')"
                                class="w-full sm:flex-1 min-w-0 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-indigo-500 dark:text-white"
                                :aria-label="t('subscriptions.keywordPlaceholder')"
                            />
                            <button
                                type="button"
                                @click="addCustomKeyword"
                                class="w-full sm:w-auto flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 misub-radius-md transition-colors !min-h-0 !min-w-0 cursor-pointer"
                            >
                                {{ t('subscriptions.addKeyword') }}
                            </button>
                        </div>
                    </div>

                    <!-- 已选规则展示：保留与剔除两组清晰列出 -->
                    <div
                        v-if="effectiveKeepRules.length > 0 || effectiveExcludeRules.length > 0"
                        class="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700"
                    >
                        <!-- 保留规则列表 -->
                        <div v-if="effectiveKeepRules.length > 0">
                            <div
                                class="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1"
                            >
                                🟢 {{ t('subscriptions.keepRulesTitle') }} ({{
                                    effectiveKeepRules.length
                                }})
                            </div>
                            <div
                                class="flex flex-wrap gap-1.5 p-2 bg-emerald-50/60 dark:bg-emerald-950/20 misub-radius-md border border-emerald-100 dark:border-emerald-900/30"
                            >
                                <span
                                    v-for="(rule, index) in effectiveKeepRules"
                                    :key="'keep-' + index"
                                    class="inline-flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm font-medium misub-radius-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 !min-h-0 !min-w-0"
                                >
                                    {{ rule.icon ? rule.icon + ' ' : '' }}{{ rule.label }}
                                    <button
                                        type="button"
                                        @click="handleRemoveKeep(index)"
                                        class="hover:text-red-500 transition-colors cursor-pointer !min-h-0 !min-w-0"
                                        :aria-label="t('operators.removeRule')"
                                    >
                                        <svg
                                            class="w-3.5 h-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                </span>
                            </div>
                        </div>

                        <!-- 剔除规则列表 -->
                        <div v-if="effectiveExcludeRules.length > 0">
                            <div
                                class="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1"
                            >
                                🔴 {{ t('subscriptions.excludeRulesTitle') }} ({{
                                    effectiveExcludeRules.length
                                }})
                            </div>
                            <div
                                class="flex flex-wrap gap-1.5 p-2 bg-amber-50/60 dark:bg-amber-950/20 misub-radius-md border border-amber-100 dark:border-amber-900/30"
                            >
                                <span
                                    v-for="(rule, index) in effectiveExcludeRules"
                                    :key="'exclude-' + index"
                                    class="inline-flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm font-medium misub-radius-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 !min-h-0 !min-w-0"
                                >
                                    {{ rule.icon ? rule.icon + ' ' : '' }}{{ rule.label }}
                                    <button
                                        type="button"
                                        @click="handleRemoveExclude(index)"
                                        class="hover:text-red-500 transition-colors cursor-pointer !min-h-0 !min-w-0"
                                        :aria-label="t('operators.removeRule')"
                                    >
                                        <svg
                                            class="w-3.5 h-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- 提示 -->
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{
                            ruleModeModel === 'keep'
                                ? t('subscriptions.keepHint')
                                : t('subscriptions.excludeHint')
                        }}
                    </p>
                </div>

                <!-- 高级模式（简化版文本编辑器） -->
                <div v-else>
                    <div class="flex items-center gap-2 mb-2">
                        <span
                            :class="['text-xs px-2 py-0.5 rounded-full', excludeRuleState.tagClass]"
                            >{{ excludeRuleState.tag }}</span
                        >
                    </div>
                    <textarea
                        id="sub-edit-exclude"
                        :aria-invalid="excludeRuleState.errors.length > 0 ? 'true' : 'false'"
                        :aria-describedby="
                            excludeRuleState.errors.length ? 'sub-edit-exclude-error' : undefined
                        "
                        v-model="editingSubscription.exclude"
                        :placeholder="t('subscriptions.excludePlaceholder')"
                        rows="8"
                        class="w-full px-3 py-2 misub-radius-md sm:text-sm font-mono dark:text-white leading-6 resize-none bg-white dark:bg-gray-800"
                        :class="[
                            excludeRuleState.errors.length
                                ? 'border border-red-400 focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:outline-hidden'
                                : 'border border-gray-300 dark:border-gray-600 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-hidden',
                        ]"
                    ></textarea>
                    <div
                        v-if="excludeRuleState.errors.length"
                        id="sub-edit-exclude-error"
                        role="alert"
                        class="mt-2 text-xs text-red-600 dark:text-red-400"
                    >
                        {{
                            t('subscriptions.ruleInvalid', { message: excludeRuleState.errorsText })
                        }}
                    </div>
                    <div class="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <p>
                            {{ t('subscriptions.ruleLineHelp') }}
                            <code class="font-mono">proto:</code>
                        </p>
                        <p>{{ t('subscriptions.ruleKeepHelp') }}</p>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
    .collapse-enter-active,
    .collapse-leave-active {
        transition: all 0.2s ease;
        overflow: hidden;
    }

    .collapse-enter-from,
    .collapse-leave-to {
        opacity: 0;
        max-height: 0;
    }

    .collapse-enter-to,
    .collapse-leave-from {
        opacity: 1;
        max-height: 600px;
    }
</style>
