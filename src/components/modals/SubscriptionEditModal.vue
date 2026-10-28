<script setup>
    import { computed, ref, watch } from 'vue';
    import { useToastStore } from '../../stores/toast.js';
    import { useI18n } from '../../i18n/index.js';
    import Modal from '../forms/Modal.vue';
    import EditForm from './SubscriptionEditModal/EditForm.vue';
    import RuleSection from './SubscriptionEditModal/RuleSection.vue';
    import AdvancedOptions from './SubscriptionEditModal/AdvancedOptions.vue';
    const props = defineProps({
        show: Boolean,
        isNew: Boolean,
        editingSubscription: Object,
    });

    const emit = defineEmits(['update:show', 'confirm']);
    const { showToast } = useToastStore();
    const { t } = useI18n();

    // === 可视化规则编辑器 ===
    const isAdvancedMode = ref(false);
    const isRuleExpanded = ref(false); // 折叠状态
    const ruleMode = ref('exclude'); // 'exclude' | 'keep'
    const customKeyword = ref('');

    // 预设标签
    const presetRegions = [
        { label: '香港', pattern: '(香港|HK|Hong Kong)', icon: '🇭🇰' },
        { label: '台湾', pattern: '(台湾|TW|Taiwan)', icon: '🇨🇳' },
        { label: '日本', pattern: '(日本|JP|Japan)', icon: '🇯🇵' },
        { label: '新加坡', pattern: '(新加坡|SG|Singapore)', icon: '🇸🇬' },
        { label: '美国', pattern: '(美国|US|USA)', icon: '🇺🇸' },
        { label: '韩国', pattern: '(韩国|KR|Korea)', icon: '🇰🇷' },
        { label: '德国', pattern: '(德国|DE|Germany)', icon: '🇩🇪' },
        { label: '英国', pattern: '(英国|UK|Britain)', icon: '🇬🇧' },
    ];

    const presetProtocols = [
        { label: 'SS', pattern: 'proto:ss' },
        { label: 'VMess', pattern: 'proto:vmess' },
        { label: 'VLESS', pattern: 'proto:vless' },
        { label: 'Trojan', pattern: 'proto:trojan' },
        { label: 'Hysteria', pattern: 'proto:hysteria' },
    ];

    const presetKeywords = [
        { label: '官网', pattern: '官网' },
        { label: '过期', pattern: '过期' },
        { label: '剩余', pattern: '(剩余|流量)' },
        { label: '倍率', pattern: '倍率' },
        { label: '测试', pattern: '测试' },
        { label: '维护', pattern: '维护' },
        { label: 'GB', pattern: 'GB' },
        { label: '2026', pattern: '2026' },
    ];

    // 规则池：分别管理保留规则和剔除规则
    const keepRules = ref([]);
    const excludeRules = ref([]);

    // 活跃规则列表（根据当前 tab 切换）
    const currentRulePool = computed(() => {
        return ruleMode.value === 'keep' ? keepRules.value : excludeRules.value;
    });

    // 选中规则总集（兼容外部组件与计数）
    const selectedRules = computed(() => {
        return [...keepRules.value, ...excludeRules.value];
    });

    // 检查标签在当前激活模式中是否已选中
    const isSelected = (pattern) => {
        return currentRulePool.value.some((rule) => rule.pattern === pattern);
    };

    // 检查标签在另一个模式中是否已选中
    const isOtherSelected = (pattern) => {
        const otherPool = ruleMode.value === 'keep' ? excludeRules.value : keepRules.value;
        return otherPool.some((rule) => rule.pattern === pattern);
    };

    // 辅助函数：根据 pattern 转换为规范规则对象
    const createRuleItem = (tag, type) => {
        const normalizedPattern =
            type === 'protocol' && !String(tag.pattern).toLowerCase().startsWith('proto:')
                ? `proto:${String(tag.pattern).toLowerCase()}`
                : tag.pattern;
        return {
            ...tag,
            pattern: normalizedPattern,
            type,
        };
    };

    // 切换标签选择
    const toggleTag = (tag, type) => {
        const pool = currentRulePool.value;
        const otherPool = ruleMode.value === 'keep' ? excludeRules.value : keepRules.value;

        const index = pool.findIndex((rule) => rule.pattern === tag.pattern);
        if (index !== -1) {
            pool.splice(index, 1);
        } else {
            // 如果已在另一个规则池中，将其从另一个池移除，避免同一标签同时存在
            const otherIdx = otherPool.findIndex((rule) => rule.pattern === tag.pattern);
            if (otherIdx !== -1) {
                otherPool.splice(otherIdx, 1);
            }
            pool.push(createRuleItem(tag, type));
        }
        syncToText();
    };

    // 添加自定义关键字
    const addCustomKeyword = () => {
        const keyword = customKeyword.value.trim();
        if (!keyword) return;

        const pool = currentRulePool.value;
        if (pool.some((rule) => rule.pattern === keyword || rule.label === keyword)) {
            showToast(t('subscriptions.duplicateKeyword'), 'warning');
            return;
        }

        // 如果在另一个池中存在，先移除
        const otherPool = ruleMode.value === 'keep' ? excludeRules.value : keepRules.value;
        const otherIdx = otherPool.findIndex(
            (rule) => rule.pattern === keyword || rule.label === keyword
        );
        if (otherIdx !== -1) {
            otherPool.splice(otherIdx, 1);
        }

        pool.push({
            label: keyword,
            pattern: keyword,
            type: 'custom',
        });
        customKeyword.value = '';
        syncToText();
    };

    // 移除规则
    const removeKeepRule = (index) => {
        keepRules.value.splice(index, 1);
        syncToText();
    };

    const removeExcludeRule = (index) => {
        excludeRules.value.splice(index, 1);
        syncToText();
    };

    const removeRule = (index, targetPool = null) => {
        if (targetPool === 'keep') {
            removeKeepRule(index);
        } else if (targetPool === 'exclude') {
            removeExcludeRule(index);
        } else {
            currentRulePool.value.splice(index, 1);
            syncToText();
        }
    };

    // 将可视化选择同步到文本格式（保留与剔除同时支持）
    const syncToText = () => {
        if (!props.editingSubscription) return;

        const exPatterns = excludeRules.value.map((r) => r.pattern);
        const kpPatterns = keepRules.value.map((r) => r.pattern);

        if (exPatterns.length === 0 && kpPatterns.length === 0) {
            props.editingSubscription.exclude = '';
            return;
        }

        if (kpPatterns.length === 0) {
            props.editingSubscription.exclude = exPatterns.join('\n');
            return;
        }

        if (exPatterns.length === 0) {
            props.editingSubscription.exclude = kpPatterns.map((p) => `keep:${p}`).join('\n');
            return;
        }

        // 两者并存：使用标准 --- 分隔线
        props.editingSubscription.exclude = [
            ...exPatterns,
            '---',
            ...kpPatterns.map((p) => `keep:${p}`),
        ].join('\n');
    };

    const resolvePreset = (pattern) => {
        const protocolPreset = presetProtocols.find(
            (p) => p.pattern.toLowerCase() === pattern.toLowerCase()
        );
        if (protocolPreset) {
            return { ...protocolPreset, type: 'protocol' };
        }

        const allPresets = [...presetRegions, ...presetProtocols, ...presetKeywords];
        const preset = allPresets.find((p) => p.pattern === pattern);
        if (preset) {
            const type = presetRegions.includes(preset)
                ? 'region'
                : presetProtocols.includes(preset)
                  ? 'protocol'
                  : 'keyword';
            return { ...preset, type };
        }

        return {
            label: pattern,
            pattern: pattern,
            type: 'custom',
        };
    };

    // 从文本解析到可视化状态
    const parseFromText = () => {
        keepRules.value = [];
        excludeRules.value = [];

        if (!props.editingSubscription?.exclude) {
            return;
        }

        const text = props.editingSubscription.exclude;
        const lines = text
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);

        if (lines.length === 0) return;

        const dividerIndex = lines.findIndex((line) => line === '---');
        const hasDivider = dividerIndex !== -1;

        const rawExcludePatterns = [];
        const rawKeepPatterns = [];

        lines.forEach((line, index) => {
            if (line === '---') return;

            if (hasDivider) {
                if (index < dividerIndex) {
                    if (line.toLowerCase().startsWith('keep:')) {
                        rawKeepPatterns.push(line.substring(5).trim());
                    } else {
                        rawExcludePatterns.push(line);
                    }
                } else {
                    if (line.toLowerCase().startsWith('keep:')) {
                        rawKeepPatterns.push(line.substring(5).trim());
                    } else {
                        rawKeepPatterns.push(line);
                    }
                }
            } else {
                if (line.toLowerCase().startsWith('keep:')) {
                    rawKeepPatterns.push(line.substring(5).trim());
                } else {
                    rawExcludePatterns.push(line);
                }
            }
        });

        rawKeepPatterns.filter(Boolean).forEach((pattern) => {
            keepRules.value.push(resolvePreset(pattern));
        });

        rawExcludePatterns.filter(Boolean).forEach((pattern) => {
            excludeRules.value.push(resolvePreset(pattern));
        });

        if (keepRules.value.length > 0 && excludeRules.value.length === 0) {
            ruleMode.value = 'keep';
        } else if (excludeRules.value.length > 0 && keepRules.value.length === 0) {
            ruleMode.value = 'exclude';
        }
    };

    // 监听弹窗显示或编辑订阅变化，解析现有规则
    watch(
        [() => props.show, () => props.editingSubscription],
        ([showVal, subVal]) => {
            if (showVal && subVal) {
                parseFromText();
            }
        },
        { immediate: true }
    );

    // === 高级模式相关（保留原有逻辑） ===
    const excludeRuleTextarea = ref(null);
    const excludeRuleHighlight = ref(null);

    const excludeRuleLines = computed(() => {
        const text = props.editingSubscription?.exclude ?? '';
        const lines = text.split('\n');
        return lines.length ? lines : [''];
    });

    const excludeRuleState = computed(() => {
        const text = props.editingSubscription?.exclude ?? '';
        const rawLines = text.split('\n');
        const lines = rawLines.map((line) => line.trim());
        const hasContent = lines.some((line) => line);
        const dividerIndex = lines.findIndex((line) => line === '---');
        const hasDivider = dividerIndex !== -1;
        const hasKeepPrefix = lines.some((line) => line.toLowerCase().startsWith('keep:'));

        let tagKey = 'unset';
        if (hasContent) {
            const hasExclude = lines.some(
                (l) => l && l !== '---' && !l.toLowerCase().startsWith('keep:')
            );
            const hasKeep =
                lines.some((l) => l && l.toLowerCase().startsWith('keep:')) ||
                (hasDivider && lines.slice(dividerIndex + 1).some((l) => l));

            if (hasDivider || (hasExclude && hasKeep)) tagKey = 'mixed';
            else if (hasKeep) tagKey = 'keepOnly';
            else tagKey = 'exclude';
        }

        const tagClassMap = {
            unset: 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300',
            exclude: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
            keepOnly:
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
            mixed: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
        };

        const errors = [];
        rawLines.forEach((rawLine, index) => {
            let line = rawLine.trim();
            if (!line) return;
            if (line === '---') return;

            if (line.toLowerCase().startsWith('keep:')) {
                line = line.substring('keep:'.length).trim();
                if (!line) {
                    errors.push({ line: index + 1, message: t('subscriptions.keepEmptyError') });
                    return;
                }
            }

            if (line.toLowerCase().startsWith('proto:')) {
                const protocols = line
                    .substring('proto:'.length)
                    .split(',')
                    .map((p) => p.trim())
                    .filter(Boolean);
                if (protocols.length === 0) {
                    errors.push({ line: index + 1, message: t('subscriptions.protoEmptyError') });
                }
                return;
            }

            try {
                new RegExp(line);
            } catch (e) {
                errors.push({ line: index + 1, message: t('subscriptions.regexInvalid') });
            }
        });

        return {
            tagKey,
            tag: t(`subscriptions.ruleTag.${tagKey}`),
            tagClass: tagClassMap[tagKey] || tagClassMap.unset,
            errors,
            errorsText: errors
                .map((item) =>
                    t('subscriptions.ruleLineError', { line: item.line, message: item.message })
                )
                .join('；'),
        };
    });

    const excludeRuleErrorLines = computed(
        () => new Set(excludeRuleState.value.errors.map((item) => item.line))
    );

    const syncExcludeRuleScroll = () => {
        if (!excludeRuleTextarea.value || !excludeRuleHighlight.value) return;
        excludeRuleHighlight.value.scrollTop = excludeRuleTextarea.value.scrollTop;
        excludeRuleHighlight.value.scrollLeft = excludeRuleTextarea.value.scrollLeft;
    };

    const handleConfirm = () => {
        if (isAdvancedMode.value && excludeRuleState.value.errors.length > 0) {
            showToast(t('subscriptions.ruleErrorFixFirst'), 'error');
            return;
        }
        emit('confirm');
    };

    // 切换到高级模式
    const switchToAdvanced = () => {
        isAdvancedMode.value = true;
    };

    // 切换到可视化模式
    const switchToVisual = () => {
        isAdvancedMode.value = false;
        parseFromText();
    };
</script>

<template>
    <Modal
        v-if="editingSubscription"
        :show="show"
        size="2xl"
        :confirm-disabled="isAdvancedMode && excludeRuleState.errors.length > 0"
        :confirm-button-title="t('subscriptions.fixRulesFirst')"
        @update:show="emit('update:show', $event)"
        @confirm="handleConfirm"
    >
        <template #title>
            <div class="flex items-center gap-3">
                <div class="p-2 misub-radius-lg bg-indigo-500/10">
                    <!-- Standard RSS/Link Icon for Subscription -->
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
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                    </svg>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white">
                        {{ isNew ? t('subscriptions.addTitle') : t('subscriptions.editTitle') }}
                    </h3>
                    <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        {{ t('subscriptions.modalDescription') }}
                    </p>
                </div>
            </div>
        </template>
        <template #body>
            <div class="space-y-4">
                <EditForm :editing-subscription="editingSubscription" />

                <RuleSection
                    :editing-subscription="editingSubscription"
                    :is-rule-expanded="isRuleExpanded"
                    :is-advanced-mode="isAdvancedMode"
                    :rule-mode="ruleMode"
                    :custom-keyword="customKeyword"
                    :selected-rules="selectedRules"
                    :keep-rules="keepRules"
                    :exclude-rules="excludeRules"
                    :preset-regions="presetRegions"
                    :preset-protocols="presetProtocols"
                    :preset-keywords="presetKeywords"
                    :exclude-rule-state="excludeRuleState"
                    :toggle-tag="toggleTag"
                    :is-selected="isSelected"
                    :is-other-selected="isOtherSelected"
                    :add-custom-keyword="addCustomKeyword"
                    :remove-rule="removeRule"
                    :remove-keep-rule="removeKeepRule"
                    :remove-exclude-rule="removeExcludeRule"
                    :switch-to-advanced="switchToAdvanced"
                    :switch-to-visual="switchToVisual"
                    @toggle-expand="isRuleExpanded = !isRuleExpanded"
                    @update:rule-mode="ruleMode = $event"
                    @update:custom-keyword="customKeyword = $event"
                />

                <AdvancedOptions :editing-subscription="editingSubscription" />
            </div>
        </template>
    </Modal>
</template>
