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

const flagOptions = [
  { key: 'udp', label: 'UDP 转发', icon: '⚡️' },
  { key: 'emoji', label: 'Emoji 开关', icon: '🎨' },
  { key: 'scv', label: '跳过证书校验', icon: '🛡️' },
  { key: 'sort', label: '节点排序', icon: '🔢' },
  { key: 'tfo', label: 'TCP Fast Open', icon: '🚀' },
  { key: 'list', label: '输出为列表', icon: '📋' }
];

// 数据结构迁移与兜底
if (!props.settings.subconverter) {
  props.settings.subconverter = {
    defaultBackend: "https://sub.id9.cc/sub?",
    defaultOptions: {
      udp: true,
      emoji: true,
      scv: true,
      tfo: false,
      sort: false,
      list: false
    }
  };
} else if (!props.settings.subconverter.defaultOptions) {
  props.settings.subconverter.defaultOptions = {
    udp: true,
    emoji: true,
    scv: true,
    tfo: false,
    sort: false,
    list: false
  };
}

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
const isBuiltinEngine = computed(() => props.settings.subconverter.engineMode === 'builtin' || props.settings.subconverter.engineMode === '');
const isExternalEngine = computed(() => props.settings.subconverter.engineMode === 'external');

</script>

<template>
  <div class="space-y-6">
    <!-- === Block 0: 核心总控 (Global Master Switch) === -->
    <div class="bg-indigo-600 dark:bg-indigo-500 misub-radius-lg p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div>
          <h3 class="text-white font-bold text-base">默认转换引擎</h3>
          <p class="text-indigo-100 text-[10px]">控制未指定特定引擎的请求（如主订阅）如何处理。</p>
        </div>
      </div>
      
      <div class="flex bg-white/10 p-1 rounded-lg border border-white/20">
        <button 
          @click="settings.subconverter.engineMode = 'builtin'"
          :class="isBuiltinEngine ? 'bg-white text-indigo-600 shadow-sm' : 'text-white hover:bg-white/10'"
          class="px-5 py-1.5 text-xs font-bold rounded-md transition-all duration-200">
          内置引擎
        </button>
        <button 
          @click="settings.subconverter.engineMode = 'external'"
          :class="isExternalEngine ? 'bg-white text-indigo-600 shadow-sm' : 'text-white hover:bg-white/10'"
          class="px-5 py-1.5 text-xs font-bold rounded-md transition-all duration-200">
          第三方转换
        </button>
      </div>
    </div>

    <!-- === Block 1: 内置转换引擎 (Built-in Engine) === -->
    <div 
      :class="[
        isBuiltinEngine 
          ? 'border-purple-500/50 shadow-purple-500/5' 
          : 'opacity-50 grayscale pointer-events-none select-none shadow-none transition-opacity duration-300'
      ]"
      class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-xs dark:border-white/10 dark:bg-gray-900/70">
      <SectionHeader title="内置转换引擎" description="MiSub Core 驱动的流式渲染引擎，无需第三方后端，极速且隐私。" tone="purple">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </template>
      </SectionHeader>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <!-- 规则来源 (Rule Source) -->
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            1. 规则来源选择
          </label>
          <select v-model="settings.transformConfigMode"
            class="block w-full px-4 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200">
            <option v-for="option in modeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <p class="mt-2 text-[10px] leading-relaxed text-gray-400">
            {{ modeHint }}
          </p>
        </div>

        <!-- 规则等级 (Rule Level) -->
        <div :class="{ 'opacity-60': !isBuiltin }" class="transition-opacity">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
            2. 内置分流等级
            <span v-if="isBuiltin" class="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-400 ring-1 ring-inset ring-purple-700/10">生效中</span>
          </label>
          <select v-model="settings.ruleLevel" :disabled="!isBuiltin"
            :class="{ 'bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed opacity-70': !isBuiltin }"
            class="block w-full px-4 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-all duration-200">
            <option value="base">精简版 Base (仅基础分流)</option>
            <option value="std">标准版 Standard (推荐，全能型)</option>
            <option value="full">全量版 Full (细化服务分类)</option>
            <option value="relay">链式版 Relay (中转链路优化)</option>
          </select>
        </div>

        <!-- 模板选择器 (Template Selector) -->
        <div v-if="!isBuiltin" class="md:col-span-2">
          <label class="block text-xs font-medium text-indigo-500 dark:text-indigo-400 mb-1.5 uppercase tracking-wider">
            3. 外部模板 URL (应用于内置渲染)
          </label>
          <TransformSelector
            v-model="settings.transformConfig"
            @select-asset="selectedAsset = $event"
            type="config"
            :force-custom="settings.transformConfigMode === 'custom'"
            placeholder="搜索内置预设..."
            custom-placeholder="输入远程规则 URL"
            :allowEmpty="settings.transformConfigMode !== 'custom'"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div class="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg shadow-xs">
          <div>
            <p class="text-xs font-bold text-gray-800 dark:text-gray-200">内置：禁用证书校验</p>
            <p class="text-[10px] text-gray-500 mt-0.5">builtin-scv</p>
          </div>
          <Switch v-model="settings.builtinSkipCertVerify" />
        </div>
        <div class="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg shadow-xs">
          <div>
            <p class="text-xs font-bold text-gray-800 dark:text-gray-200">内置：强制开启 UDP</p>
            <p class="text-[10px] text-gray-500 mt-0.5">builtin-udp</p>
          </div>
          <Switch v-model="settings.builtinEnableUdp" />
        </div>
      </div>
    </div>

    <!-- === Block 2: 第三方服务设置 (External Service) === -->
    <div 
      :class="[
        isExternalEngine 
          ? 'border-indigo-500/50 shadow-indigo-500/5 bg-indigo-50/20' 
          : 'opacity-50 grayscale pointer-events-none select-none shadow-none transition-opacity duration-300'
      ]"
      class="rounded-xl border border-indigo-100/50 bg-indigo-50/10 p-6 dark:border-indigo-500/10 dark:bg-indigo-900/10 relative">
      <div class="flex items-center gap-3 mb-6">
        <div class="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <div>
          <h4 class="text-sm font-bold text-gray-900 dark:text-indigo-100">第三方转换服务 (Subconverter)</h4>
          <p class="text-[10px] text-gray-500">外部后端模式，将自动重定向至指定的公网后端处理请求。</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="md:col-span-2">
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">默认后端地址 (Default Backend)</label>
          <input
            type="text"
            v-model="settings.subconverter.defaultBackend"
            placeholder="https://sub.id9.cc/sub?"
            class="block w-full px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all"
          />
        </div>

        <div class="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div v-for="flag in flagOptions" :key="flag.key" class="flex items-center justify-between p-3 bg-white/80 dark:bg-gray-800/80 rounded-xl border border-gray-100/60 dark:border-gray-700/60 shadow-xs">
            <div class="flex items-center gap-2">
              <span class="text-sm">{{ flag.icon }}</span>
              <span class="text-[11px] font-medium text-gray-700 dark:text-gray-300">{{ flag.label }}</span>
            </div>
            <Switch v-model="settings.subconverter.defaultOptions[flag.key]" />
          </div>
        </div>
      </div>
    </div>
    
    <div class="pt-2 flex flex-wrap gap-4 justify-center text-[10px] opacity-40 hover:opacity-100 transition-opacity">
      <div class="flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-indigo-500"></span> Clash: 模型驱动</div>
      <div class="flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-indigo-500"></span> Surge: 模型驱动</div>
      <div class="flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-indigo-500"></span> Loon: 模型驱动</div>
      <div class="flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-indigo-500"></span> QX/Sing-Box: 模型驱动</div>
    </div>
  </div>
</template>
