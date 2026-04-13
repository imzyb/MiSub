<script setup>
import { computed, ref } from 'vue';
import TransformSelector from '@/components/forms/TransformSelector.vue';
import Switch from '@/components/ui/Switch.vue';
import SectionHeader from '../../SectionHeader.vue';

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
});

const modeOptions = [
  { value: 'builtin', label: '仅使用内置规则' },
  { value: 'preset', label: '使用预设模板' },
  { value: 'custom', label: '使用自定义 URL' }
];

const selectedAsset = ref(null);

const isBuiltin = computed(() => props.settings.transformConfigMode === 'builtin');

const modeHint = computed(() => {
  if (isBuiltin.value) {
    return '推荐方案。系统根据目标客户端自动选择内置的规则模板进行流式渲染。';
  }
  if (props.settings.transformConfigMode === 'preset') {
    return '使用云端预设模板。系统会尝试从远程获取 .ini 配置文件参与生成。';
  }
  return '高级模式。系统将完全信任并加载您指定的远程 URL 作为渲染基准。';
});

</script>

<template>
  <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
    <SectionHeader title="内置转换引擎" description="统一管理规则来源、模板选择和规则等级，兼顾桌面端与移动端配置体验。" tone="purple">
      <template #icon>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </template>
    </SectionHeader>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 规则来源 (Rule Source) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          1. 规则来源
        </label>
        <select v-model="settings.transformConfigMode"
          class="block w-full px-4 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200">
          <option v-for="option in modeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <p class="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-500">
          {{ modeHint }}
        </p>
      </div>

      <!-- 模板选择 (Template Selector) -->
      <div v-if="!isBuiltin">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          2. 选择外部模板
        </label>
        <TransformSelector
          v-model="settings.transformConfig"
          @select-asset="selectedAsset = $event"
          type="config"
          :force-custom="settings.transformConfigMode === 'custom'"
          placeholder="选择预设模板..."
          custom-placeholder="输入外部规则模板 URL"
          :allowEmpty="settings.transformConfigMode !== 'custom'"
        />
        
        <div v-if="selectedAsset" class="mt-2 rounded-lg border border-indigo-200/50 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-500/5 px-3 py-2 text-[11px] text-indigo-700 dark:text-indigo-300">
          <div class="flex justify-between items-start">
            <span class="font-semibold">{{ selectedAsset.name }}</span>
            <span class="opacity-70">{{ selectedAsset.sourceType === 'builtin-preset' ? '内置' : '远程' }}</span>
          </div>
          <p class="mt-1 opacity-80">{{ selectedAsset.description }}</p>
        </div>
      </div>

      <!-- 规则等级 (Rule Level) -->
      <div :class="{ 'opacity-60': !isBuiltin }" class="transition-opacity">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
          {{ isBuiltin ? '2.' : '3.' }} 规则等级
          <span v-if="isBuiltin" class="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-400 ring-1 ring-inset ring-purple-700/10">当前生效</span>
        </label>
        <select v-model="settings.ruleLevel"
          class="block w-full px-4 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200">
          <option value="base">精简版 Base (仅基础分流)</option>
          <option value="std">标准版 Standard (推荐，全能型)</option>
          <option value="full">全量版 Full (细化服务分类)</option>
          <option value="relay">链式版 Relay (中转链路优化)</option>
        </select>
        
        <div v-if="!isBuiltin" class="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-500/10 flex gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625l6.28-10.875zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <p class="text-[10px] leading-tight text-amber-700 dark:text-amber-500/80">
                当前使用的是外部模板。大多数外部模板会硬编码自己的规则集，因此此处的“等级”选项可能失效。
            </p>
        </div>
        <p v-else class="mt-2 text-[11px] text-gray-500 dark:text-gray-500">
          此选项将控制内置统一规则模型的复杂度（节点数越多，建议等级越低以提升加载速度）。
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-200">禁用证书校验 (scv)</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">仅在内置转换需要时启用</p>
        </div>
        <Switch v-model="settings.builtinSkipCertVerify" />
      </div>
      <div
        class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-200">全量开启 UDP</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">生成配置时强制为所有节点开启 UDP</p>
        </div>
        <Switch v-model="settings.builtinEnableUdp" />
      </div>
    </div>
    
    <div class="pt-2 border-t border-gray-100 dark:border-white/5 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
      <div class="text-gray-400 dark:text-gray-500">Clash: 统一模型驱动</div>
      <div class="text-gray-400 dark:text-gray-500">Surge: 统一模型驱动</div>
      <div class="text-gray-400 dark:text-gray-500">Loon: 统一模型驱动</div>
      <div class="text-gray-400 dark:text-gray-500">QX/Sing-Box: 统一模型驱动</div>
    </div>
  </div>
</template>
