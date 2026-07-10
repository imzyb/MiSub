<script setup>
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { TRANSFORM_ASSETS } from '@/constants/transform-assets';
import { useDataStore } from '@/stores/useDataStore.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, required: true },
  placeholder: { type: String, default: '' },
  allowEmpty: { type: Boolean, default: true },
  forceCustom: { type: Boolean, default: false },
  customPlaceholder: { type: String, default: '输入外部规则模板 URL' },
  excludeBuiltinAssets: { type: Boolean, default: false },
  customTemplatesOnly: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'select-asset']);
const dataStore = useDataStore();
const { ruleTemplates } = storeToRefs(dataStore);

const TEMPLATE_VARIABLE_GROUPS = [
  {
    title: '基础变量',
    items: [
      { key: '<%proxies%>', example: '代理节点片段' },
      { key: '<%rules%>', example: '规则片段' },
      { key: '<%file_name%>', example: '配置文件名（同 <%fileName%>）' },
      { key: '<%target_format%>', example: '目标格式（同 <%targetFormat%>）' },
      { key: '<%node_count%>', example: '节点数量（同 <%nodeCount%>）' }
    ]
  },
  {
    title: '策略组变量',
    items: [
      { key: '<%primary_strategy_chain%>', example: '主策略组完整候选链（同 <%primaryStrategyChain%>）' },
      { key: '<%region_strategy_chain%>', example: '地区策略组候选链（同 <%regionStrategyChain%>）' },
      { key: '<%protocol_strategy_chain%>', example: '协议策略组候选链（同 <%protocolStrategyChain%>）' },
      { key: '<%all_strategy_groups%>', example: '所有策略组名称集合（同 <%allStrategyGroups%>）' }
    ]
  },
  {
    title: '分组明细变量',
    items: [
      { key: '<%region_group_names%>', example: '地区策略组名称列表（同 <%regionGroupNames%>）' },
      { key: '<%region_group_counts%>', example: '地区策略组节点数量（同 <%regionGroupCounts%>）' },
      { key: '<%region_group_list%>', example: '地区策略组逐行清单（同 <%regionGroupList%>）' },
      { key: '<%protocol_group_names%>', example: '协议策略组名称列表（同 <%protocolGroupNames%>）' },
      { key: '<%protocol_group_counts%>', example: '协议策略组节点数量（同 <%protocolGroupCounts%>）' },
      { key: '<%protocol_group_list%>', example: '协议策略组逐行清单（同 <%protocolGroupList%>）' }
    ]
  }
];

const customTemplateAssets = computed(() => {
  if (props.excludeBuiltinAssets) return [];

  return (ruleTemplates.value || [])
    .filter(item => item && item.enabled !== false && item.id)
    .map(item => ({
      id: `custom:${item.id}`,
      name: item.name || '未命名自定义规则模板',
      url: `custom:${item.id}`,
      group: '自定义规则模板',
      sourceType: 'custom-template',
      description: item.description || '本地保存的自定义规则模板'
    }));
});

const assets = computed(() => {
  if (props.customTemplatesOnly) return customTemplateAssets.value;

  const builtinAndRemote = TRANSFORM_ASSETS.configs.filter((item) => {
    if (!props.excludeBuiltinAssets) return true;
    return !String(item.url || '').startsWith('builtin:');
  });
  return [...customTemplateAssets.value, ...builtinAndRemote];
});

const missingCustomTemplateValue = computed(() => {
  const value = String(props.modelValue || '').trim();
  if (!props.customTemplatesOnly || !value.startsWith('custom:')) return '';
  return customTemplateAssets.value.some(item => item.url === value) ? '' : value;
});

const groupedConfigs = computed(() => {
  if (props.type !== 'config') return {};

  const groups = {};
  assets.value.forEach((item) => {
    const group = item.group || '其他';
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
    return '仅可选择已保存的 custom: 自定义规则模板。';
  }
  if (props.excludeBuiltinAssets) {
    return '第三方订阅转换仅支持远程模板 URL，无法兼容 MiSub 内置规则、内置预设和本地 custom: 模板。';
  }
  return '适用于统一模板渲染。';
});
</script>

<template>
  <div>
    <div
      v-if="type === 'config' && excludeBuiltinAssets"
      class="mb-3 rounded-lg border border-amber-300/60 bg-amber-50/90 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200"
    >
      使用第三方订阅转换时，无法兼容 MiSub 内置规则、内置预设和本地 custom: 模板。
      请使用远程预设模板或自定义 URL。
    </div>

    <div v-if="!isCustom" class="relative">
      <select
        :value="selectedUrl"
        @change="handleSelectChange"
        class="block w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        <option value="">
          {{ placeholder || (allowEmpty ? '默认 / 全局设置' : '请选择...') }}
        </option>

        <optgroup
          v-for="(items, groupName) in groupedConfigs"
          :key="groupName"
          :label="groupName"
        >
          <option
            v-for="item in items"
            :key="item.id"
            :value="item.url"
          >
            {{ item.name }}
          </option>
        </optgroup>

        <option
          v-if="!customTemplatesOnly"
          value="custom"
          class="border-t font-bold text-indigo-600 dark:text-indigo-400"
        >
          自定义输入...
        </option>
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
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
            :placeholder="customPlaceholder"
            class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <button
          @click="switchToSelect"
          class="flex-shrink-0 rounded-lg bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 hover:text-indigo-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-indigo-400"
          title="返回列表选择"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      <p v-if="modelValue" class="mt-1 truncate text-xs text-indigo-500" title="当前自定义值">
        当前值: {{ modelValue }}
      </p>
    </div>

    <div
      v-if="missingCustomTemplateValue"
      class="mt-2 rounded-lg border border-amber-300/60 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200"
    >
      当前引用的自定义规则模板不存在或已停用：<code class="font-mono">{{ missingCustomTemplateValue }}</code>。请选择一个已保存且启用的 custom: 模板。
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
          <span class="font-medium text-gray-700 dark:text-gray-200">模板变量说明</span>
          <span class="ml-2 text-[11px] text-gray-400">{{ helperText }}</span>
        </span>
        <svg
          class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform"
          :class="showTemplateVariables ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-if="showTemplateVariables" class="grid gap-3 border-t border-gray-200 p-3 md:grid-cols-2 dark:border-gray-700">
        <div
          v-for="group in TEMPLATE_VARIABLE_GROUPS"
          :key="group.title"
          class="rounded-lg border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/20"
        >
          <p class="font-medium text-gray-700 dark:text-gray-200">{{ group.title }}</p>
          <div class="mt-2 space-y-2">
            <div v-for="item in group.items" :key="item.key">
              <code class="text-[11px] text-indigo-600 dark:text-indigo-300">{{ item.key }}</code>
              <p class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">示例: {{ item.example }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
