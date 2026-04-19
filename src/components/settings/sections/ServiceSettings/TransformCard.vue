<script setup>
import { computed, ref, watch } from 'vue';
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
  { value: 'builtin', label: '使用内置自动分流' },
  { value: 'preset', label: '选择预设规则模板' },
  { value: 'custom', label: '自定义远程规则 URL' }
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
    defaultBackend: "https://subapi.cmliussss.net/sub?",
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

const isBuiltinMode = computed(() => props.settings.transformConfigMode === 'builtin');

const modeHint = computed(() => {
  if (isBuiltinMode.value) {
    return '推荐方案。系统根据目标客户端自动选择最佳的内置规则模板，无需额外配置。';
  }
  if (props.settings.transformConfigMode === 'preset') {
    return '从库中选择成熟的规则方案（如 ACL4SSR）。支持内置渲染及第三方后端转换。';
  }
  return '高级模式。使用您指定的远程 .ini 配置文件作为转换基准（适用于第三方后端及部分内置环境）。';
});

const isBuiltinEngine = computed(() => props.settings.subconverter.engineMode === 'builtin' || props.settings.subconverter.engineMode === '');
const isExternalEngine = computed(() => props.settings.subconverter.engineMode === 'external');

watch(isExternalEngine, (enabled) => {
  if (!enabled) return;

  if (props.settings.transformConfigMode === 'builtin') {
    props.settings.transformConfigMode = 'preset';
  }

  if (String(props.settings.transformConfig || '').startsWith('builtin:')) {
    props.settings.transformConfig = '';
    selectedAsset.value = null;
  }
}, { immediate: true });

</script>

<template>
  <div class="space-y-6">
    <!-- === Section 1: 核心引擎选择 (Step 1: Choose Engine) === -->
    <div class="bg-indigo-600 dark:bg-indigo-500 misub-radius-lg p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <h3 class="text-white font-bold text-base">默认转换引擎</h3>
          <p class="text-indigo-100 text-[10px]">核心决策器：由谁负责节点转换？</p>
        </div>
      </div>
      
      <div class="flex bg-white/10 p-1 rounded-lg border border-white/20">
        <button 
          @click="settings.subconverter.engineMode = 'builtin'"
          :class="isBuiltinEngine ? 'bg-white text-indigo-600 shadow-sm' : 'text-white hover:bg-white/10'"
          class="px-5 py-1.5 text-xs font-bold rounded-md transition-all duration-200">
          内置渲染
        </button>
        <button 
          @click="settings.subconverter.engineMode = 'external'"
          :class="isExternalEngine ? 'bg-white text-indigo-600 shadow-sm' : 'text-white hover:bg-white/10'"
          class="px-5 py-1.5 text-xs font-bold rounded-md transition-all duration-200">
          第三方后端
        </button>
      </div>
    </div>

    <!-- === Section 2: 配置方案设置 (Step 2: Config Scheme) === -->
    <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-xs dark:border-white/10 dark:bg-gray-900/70">
      <SectionHeader title="规则与配置方案" description="决定节点如何分流和过滤，无论引擎是谁，此配置逻辑均生效。" tone="purple">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </template>
      </SectionHeader>
      
      <div class="flex flex-col gap-6 mt-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- 规则来源 (Rule Source) -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              1. 规则来源
            </label>
            <select v-model="settings.transformConfigMode"
              class="block w-full px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200 shadow-sm">
              <option
                v-for="option in modeOptions"
                :key="option.value"
                :value="option.value"
                :disabled="option.value === 'builtin' && isExternalEngine"
              >
                {{ option.label }}
              </option>
            </select>
            <p class="mt-2 text-[10px] leading-relaxed text-gray-400">
              {{ modeHint }}
            </p>
            <p v-if="isExternalEngine" class="mt-1 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
              第三方后端不支持 MiSub 内置规则源与内置模板，请使用预设远程模板或自定义 URL。
            </p>
          </div>

          <!-- 模板选择器 (Template Selection) -->
          <div :class="{ 'opacity-50 pointer-events-none': isBuiltinMode }" class="transition-all">
            <label class="block text-xs font-medium text-purple-600 dark:text-purple-400 mb-1.5 uppercase tracking-wider">
              2. 模板配置
            </label>
            <TransformSelector
              v-model="settings.transformConfig"
              @select-asset="selectedAsset = $event"
              type="config"
              :force-custom="settings.transformConfigMode === 'custom'"
              placeholder="选择预设规则配置..."
              custom-placeholder="输入远程 .ini 配置文件 URL"
              :allowEmpty="settings.transformConfigMode === 'builtin'"
              :exclude-builtin-assets="isExternalEngine"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- === Section 3: 引擎专属细节 (Step 3: Engine Detail) === -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
       <!-- Built-in Specifics -->
       <div 
         :class="isBuiltinEngine ? 'border-indigo-500/30' : 'opacity-40 grayscale pointer-events-none select-none'"
         class="rounded-xl border border-gray-100 bg-white p-5 dark:border-white/5 dark:bg-gray-900/40 relative overflow-hidden transition-all duration-300">
         <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold text-gray-900 dark:text-indigo-200 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" v-if="isBuiltinEngine"></span>
                内置引擎参数
            </h4>
            <span class="text-[10px] font-medium text-gray-400">builtin-core</span>
         </div>
         
         <div class="space-y-4">
            <div :class="{ 'opacity-60': !isBuiltinMode }" class="transition-opacity">
              <label class="block text-[11px] font-medium text-gray-500 mb-1.5">分流详细等级 (仅自动分流生效)</label>
              <select v-model="settings.ruleLevel" :disabled="!isBuiltinMode || isExternalEngine"
                class="block w-full px-3 py-2 text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                <option value="base">精简版 Base</option>
                <option value="std">标准版 Standard (推荐)</option>
                <option value="full">全量版 Full (全场景覆盖)</option>
                <option value="relay">链式版 Relay (中转链优化)</option>
              </select>
            </div>
            
            <div class="grid grid-cols-1 gap-3">
              <div class="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg">
                <span class="text-[11px] font-medium text-gray-700 dark:text-gray-300">内置：跳过证书校验</span>
                <Switch v-model="settings.builtinSkipCertVerify" size="sm" />
              </div>
              <div class="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg">
                <span class="text-[11px] font-medium text-gray-700 dark:text-gray-300">内置：强制开启 UDP</span>
                <Switch v-model="settings.builtinEnableUdp" size="sm" />
              </div>
            </div>
         </div>
       </div>

       <!-- External Specifics -->
       <div 
         :class="isExternalEngine ? 'border-orange-500/30' : 'opacity-40 grayscale pointer-events-none select-none'"
         class="rounded-xl border border-gray-100 bg-white p-5 dark:border-white/5 dark:bg-gray-900/40 relative overflow-hidden transition-all duration-300">
         <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold text-gray-900 dark:text-orange-200 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-orange-500 animate-pulse" v-if="isExternalEngine"></span>
                第三方后端参数
            </h4>
            <span class="text-[10px] font-medium text-gray-400">subconverter</span>
         </div>
         
         <div class="space-y-4">
            <div>
              <label class="block text-[11px] font-medium text-gray-500 mb-1.5">后端接口 URL (Backend API)</label>
              <input type="text" v-model="settings.subconverter.defaultBackend" placeholder="https://..."
                class="block w-full px-3 py-2 text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-orange-500 focus:border-orange-500" />
            </div>
            
            <div class="grid grid-cols-2 gap-2 mt-2">
              <div v-for="flag in flagOptions" :key="flag.key" class="flex items-center justify-between p-1.5 bg-gray-50/30 dark:bg-white/5 border border-gray-100/50 dark:border-white/5 rounded-md">
                <span class="text-[10px] text-gray-600 dark:text-gray-400 truncate" :title="flag.label">{{ flag.icon }} {{ flag.label }}</span>
                <Switch v-model="settings.subconverter.defaultOptions[flag.key]" size="xs" />
              </div>
            </div>
         </div>
       </div>
    </div>
  </div>
</template>
