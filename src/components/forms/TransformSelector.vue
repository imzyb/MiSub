<script setup>
import { computed, ref, watch } from 'vue';
import { TRANSFORM_ASSETS } from '@/constants/transform-assets';

const props = defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, required: true },
  placeholder: { type: String, default: '' },
  allowEmpty: { type: Boolean, default: true },
  forceCustom: { type: Boolean, default: false },
  customPlaceholder: { type: String, default: '输入外部规则模板 URL' },
  excludeBuiltinAssets: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'select-asset']);

const TEMPLATE_VARIABLE_GROUPS = [
  {
    title: '基础变量',
    items: [
      { key: '<%proxies%>', example: '代理节点片段' },
      { key: '<%rules%>', example: '规则片段' },
      { key: '<%file_name%>', example: '配置文件名' },
      { key: '<%target_format%>', example: 'clash / surge / quanx 等' }
    ]
  },
  {
    title: '分组变量',
    items: [
      { key: '<%region_strategy_chain%>', example: '地区策略组链' },
      { key: '<%protocol_strategy_chain%>', example: '协议策略组链' },
      { key: '<%all_strategy_groups%>', example: '所有策略组名称集合' }
    ]
  }
];

const assets = computed(() =>
  TRANSFORM_ASSETS.configs.filter((item) => {
    if (!props.excludeBuiltinAssets) return true;
    return !String(item.url || '').startsWith('builtin:');
  })
);

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

watch(
  () => props.modelValue,
  (newVal) => {
    if (props.forceCustom) {
      isCustom.value = true;
      selectedUrl.value = 'custom';
      emit('select-asset', null);
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
  if (val === 'custom') {
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
  if (props.excludeBuiltinAssets) {
    return '第三方订阅转换仅支持远程模板 URL，无法兼容 MiSub 内置规则与内置预设。';
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
      使用第三方订阅转换时，无法兼容 MiSub 内置规则。
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

        <option value="custom" class="border-t font-bold text-indigo-600 dark:text-indigo-400">
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
      v-if="type === 'config'"
      class="mt-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-xs dark:border-gray-700 dark:bg-gray-800/40"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="font-medium text-gray-700 dark:text-gray-200">模板变量说明</p>
        <span class="text-[11px] text-gray-400">{{ helperText }}</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
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
