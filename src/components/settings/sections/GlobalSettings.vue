<script setup>
import { watch } from 'vue';
import NodeTransformSettings from '../NodeTransformSettings.vue';
import Input from '../../ui/Input.vue';

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
});

const prefixToggleOptions = [
  { label: '启用', value: true },
  { label: '禁用', value: false }
];

const buildDefaultPrefixSettings = () => ({
  enableManualNodes: true,
  enableSubscriptions: true,
  manualNodePrefix: '手动节点',
  prependGroupName: false
});

const buildDefaultNodeTransform = () => ({
  enabled: false,
  rename: {
    regex: { enabled: false, rules: [] },
    template: {
      enabled: false,
      template: '{emoji}{region}-{protocol}-{index}',
      indexStart: 1,
      indexPad: 2,
      indexScope: 'regionProtocol',
      regionAlias: {},
      protocolAlias: { hysteria2: 'hy2' }
    }
  },
  dedup: {
    enabled: false,
    mode: 'serverPort',
    includeProtocol: false,
    prefer: { protocolOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] }
  },
  sort: {
    enabled: false,
    nameIgnoreEmoji: true,
    keys: [
      {
        key: 'region',
        order: 'asc',
        customOrder: ['香港', '台湾', '日本', '新加坡', '美国', '韩国', '英国', '德国', '法国', '加拿大']
      },
      { key: 'protocol', order: 'asc', customOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] },
      { key: 'name', order: 'asc' }
    ]
  }
});

function ensureDefaults() {
  if (!props.settings) return;

  if (!props.settings.defaultPrefixSettings) {
    props.settings.defaultPrefixSettings = buildDefaultPrefixSettings();
  } else {
    const prefix = props.settings.defaultPrefixSettings;
    if (typeof prefix.enableManualNodes !== 'boolean') prefix.enableManualNodes = true;
    if (typeof prefix.enableSubscriptions !== 'boolean') prefix.enableSubscriptions = true;
    if (!prefix.manualNodePrefix) prefix.manualNodePrefix = '手动节点';
    if (typeof prefix.prependGroupName !== 'boolean') prefix.prependGroupName = false;
  }

  if (!props.settings.defaultNodeTransform) {
    props.settings.defaultNodeTransform = buildDefaultNodeTransform();
  }
}

watch(() => props.settings, ensureDefaults, { immediate: true });
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-2 border border-gray-100/80 dark:border-white/10 shadow-sm">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 3c-4.418 0-8 3.134-8 7s3.582 7 8 7 8-3.134 8-7-3.582-7-8-7zm0 10.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0 5.5v2m-4-3l-1.5 1.5m9-1.5L16 19.5m-9-9H3m18 0h-4"
          />
        </svg>
        全局设置
      </h3>
      <p class="text-xs text-gray-500 dark:text-gray-400">仅影响默认订阅输出，不会影响已有的自定义订阅组。</p>
    </div>

    <div class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        节点前缀设置
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <Input v-model="settings.defaultPrefixSettings.manualNodePrefix" label="手动节点前缀" />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">手动节点前缀</label>
          <div class="relative">
            <select
              v-model="settings.defaultPrefixSettings.enableManualNodes"
              class="w-full bg-white/70 dark:bg-gray-800/80 border border-gray-200/80 dark:border-white/10 misub-radius-lg py-3 px-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/40 focus:outline-none transition-all appearance-none"
            >
              <option
                v-for="option in prefixToggleOptions"
                :key="String(option.value)"
                :value="option.value"
                class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {{ option.label }}
              </option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">机场订阅前缀</label>
          <div class="relative">
            <select
              v-model="settings.defaultPrefixSettings.enableSubscriptions"
              class="w-full bg-white/70 dark:bg-gray-800/80 border border-gray-200/80 dark:border-white/10 misub-radius-lg py-3 px-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/40 focus:outline-none transition-all appearance-none"
            >
              <option
                v-for="option in prefixToggleOptions"
                :key="String(option.value)"
                :value="option.value"
                class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {{ option.label }}
              </option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">分组名称前缀</label>
          <div class="relative">
            <select
              v-model="settings.defaultPrefixSettings.prependGroupName"
              class="w-full bg-white/70 dark:bg-gray-800/80 border border-gray-200/80 dark:border-white/10 misub-radius-lg py-3 px-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/40 focus:outline-none transition-all appearance-none"
            >
              <option
                v-for="option in prefixToggleOptions"
                :key="String(option.value)"
                :value="option.value"
                class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {{ option.label }}
              </option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-1">启用后，手动节点输出时会在名称前添加分组名称。注：开启节点净化管道后失效</p>
        </div>
      </div>
    </div>

    <div class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h10M4 18h6" />
        </svg>
        节点净化管道
      </h3>
      <NodeTransformSettings :model-value="settings.defaultNodeTransform" @update:model-value="val => settings.defaultNodeTransform = val" />
    </div>
  </div>
</template>
