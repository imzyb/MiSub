<script setup>
import { watch } from 'vue';
import OperatorChain from '../../features/Operators/OperatorChain.vue';
import Input from '../../ui/Input.vue';
import SectionHeader from '../SectionHeader.vue';

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

function ensureDefaults() {
  if (!props.settings) return;

  if (!props.settings.defaultPrefixSettings) {
    props.settings.defaultPrefixSettings = buildDefaultPrefixSettings();
  }
  
  if (!Array.isArray(props.settings.defaultOperators)) {
    props.settings.defaultOperators = [];
  }
}

watch(() => props.settings, ensureDefaults, { immediate: true });
</script>

<template>
  <div class="space-y-8">
    <!-- Announcement & Info Section -->
    <div class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 shadow-sm dark:border-indigo-500/10 dark:bg-indigo-900/10">
      <SectionHeader title="配置说明" description="这里的全局默认设置会作为所有订阅组的基础处理逻辑。" tone="indigo">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </template>
      </SectionHeader>
      <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            这里的“全局默认”设置将作为所有订阅组的基础处理逻辑。
            您可以为特定订阅组定义独立的操作符链，此时全局设置将被完全覆盖。
      </p>
    </div>

    <!-- Node Prefix Settings -->
    <div class="rounded-xl border border-gray-100 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
      <SectionHeader title="通用节点设置" description="统一管理手动节点前缀与默认展示策略。" tone="blue">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </template>
      </SectionHeader>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div class="sm:col-span-2">
          <Input v-model="settings.defaultPrefixSettings.manualNodePrefix" label="手动节点前缀文本" />
        </div>

        <div>
          <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">手动节点显示</label>
          <div class="relative">
            <select
              v-model="settings.defaultPrefixSettings.enableManualNodes"
              class="w-full bg-gray-50 dark:bg-gray-800 border border-transparent dark:border-gray-700 misub-radius-md py-2.5 px-4 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all appearance-none"
            >
              <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">服务商订阅展示</label>
          <div class="relative">
            <select
              v-model="settings.defaultPrefixSettings.enableSubscriptions"
              class="w-full bg-gray-50 dark:bg-gray-800 border border-transparent dark:border-gray-700 misub-radius-md py-2.5 px-4 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all appearance-none"
            >
              <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">节点国旗 EMOJI</label>
          <div class="relative">
            <select
              v-model="settings.enableFlagEmoji"
              class="w-full bg-gray-50 dark:bg-gray-800 border border-transparent dark:border-gray-700 misub-radius-md py-2.5 px-4 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all appearance-none"
            >
              <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unified Operator Chain -->
    <div class="rounded-xl border border-gray-100 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
      <div class="flex items-start justify-between gap-3">
        <SectionHeader title="默认转换操作符链" description="统一设置全局默认的节点处理流程，未单独覆盖的订阅组会继承此配置。" tone="green">
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h10M4 18h6" /></svg>
          </template>
        </SectionHeader>
        <span class="rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">全局默认</span>
      </div>

      <OperatorChain
        v-model="settings.defaultOperators"
        :legacy-data="settings.defaultNodeTransform"
      />
    </div>
  </div>
</template>
