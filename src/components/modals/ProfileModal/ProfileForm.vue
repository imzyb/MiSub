<script setup>
import { computed, ref, watch } from 'vue';
import TransformSelector from '../../forms/TransformSelector.vue';
import Input from '../../ui/Input.vue';
import Switch from '../../ui/Switch.vue';
import OperatorChain from '../../features/Operators/OperatorChain.vue';
import { TRANSFORM_ASSETS } from '@/constants/transform-assets';

const props = defineProps({
  localProfile: {
    type: Object,
    required: true
  },
  showAdvanced: {
    type: Boolean,
    default: false
  },
  uiText: {
    type: Object,
    required: true
  },
  prefixToggleOptions: {
    type: Array,
    default: () => []
  },
  groupPrefixToggleOptions: {
    type: Array,
    default: () => []
  },
  globalSettings: {
    type: Object,
    default: () => ({})
  }
});

const globalEngineLabel = computed(() => {
  const mode = props.globalSettings?.subconverter?.engineMode || 'builtin';
  return mode === 'external' ? '第三方后端' : '内置渲染引擎';
});

const globalConfigLabel = computed(() => {
  const mode = props.globalSettings?.transformConfigMode || 'builtin';
  if (mode === 'builtin') return '内置自动分流';
  const url = props.globalSettings?.transformConfig || '';
  const asset = TRANSFORM_ASSETS.configs.find(a => a.url === url);
  return asset ? asset.name : (url ? '自定义 URL' : '未设置');
});

const transformModeOptions = [
  { value: 'global', label: '跟随全局设置' },
  { value: 'preset', label: '选择预设方案' },
  { value: 'custom', label: '自定义规则模板 URL' }
];

const engineOptions = [
  { value: 'builtin', label: '内置脚本引擎' },
  { value: 'external', label: '第三方后端转换' }
];

const flagOptions = [
  { key: 'udp', label: 'UDP 转发', icon: '⚡️' },
  { key: 'emoji', label: 'Emoji 开关', icon: '🎨' },
  { key: 'scv', label: '跳过证书校验', icon: '🛡️' },
  { key: 'sort', label: '节点排序', icon: '🔢' },
  { key: 'tfo', label: 'TCP Fast Open', icon: '🚀' },
  { key: 'list', label: '输出为列表', icon: '📋' }
];

const selectedTransformAsset = ref(null);
const emit = defineEmits(['toggle-advanced']);

const isExternalEngine = computed(() => {
  const localMode = props.localProfile?.subconverter?.engineMode || '';
  if (localMode === 'external') return true;
  if (localMode === 'builtin') return false;
  return (props.globalSettings?.subconverter?.engineMode || 'builtin') === 'external';
});

const enforceExternalSchemeConstraints = () => {
  const enabled = isExternalEngine.value;
  if (!enabled) return;

  if (props.localProfile.transformConfigMode === 'builtin') {
    props.localProfile.transformConfigMode = 'preset';
  }

  if (String(props.localProfile.transformConfig || '').startsWith('builtin:')) {
    props.localProfile.transformConfig = '';
    selectedTransformAsset.value = null;
  }
};

watch(
  () => [
    isExternalEngine.value,
    props.localProfile,
    props.localProfile?.transformConfigMode,
    props.localProfile?.transformConfig,
    props.localProfile?.subconverter?.engineMode
  ],
  enforceExternalSchemeConstraints,
  { immediate: true }
);

</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <Input 
        id="profile-name"
        v-model="localProfile.name"
        label="订阅组名称"
        placeholder="例如：家庭共享"
      />
    </div>
    <div>
      <Input
        id="profile-custom-id"
        v-model="localProfile.customId"
        label="自定义 ID (可选)"
        placeholder="如: home, game (限字母、数字、-、_)"
      />
      <p class="text-xs text-gray-400 mt-1 ml-1">订阅链接后缀，如 /token/home</p>
    </div>
  </div>

  <!-- Public Display & Description -->
  <div class="bg-gray-50 dark:bg-gray-800/50 misub-radius-md p-4 border border-gray-100 dark:border-gray-700 mt-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center">
        <input
          type="checkbox"
          id="profile-is-public"
          v-model="localProfile.isPublic"
          class="h-4 w-4 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label for="profile-is-public" class="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          公开展示 (Public)
        </label>
      </div>
      <span class="text-xs text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full" v-if="localProfile.isPublic">
        将在公开页显示
      </span>
    </div>
    
    <div v-if="localProfile.isPublic" class="animate-fade-in-down">
      <textarea
        id="profile-description"
        v-model="localProfile.description"
        rows="2"
        placeholder="简要介绍此订阅组的内容..."
        class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
      ></textarea>
    </div>
    <div v-else class="text-xs text-gray-400">
      开启后，任何人均可通过公开页面查看此订阅组并获取链接。
    </div>
  </div>

  <!-- Advanced Settings Toggle -->
  <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
    <button 
      type="button" 
      @click="emit('toggle-advanced')"
      class="flex items-center text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-hidden"
    >
      <span>核心配置与高级设置</span>
      <svg :class="{ 'rotate-180': showAdvanced }" class="w-4 h-4 ml-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    
    <div v-show="showAdvanced" class="mt-4 space-y-8 animate-fade-in-down">
      <!-- === 区块 A：渲染核心配置 (Core Logic) === -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 border-l-4 border-indigo-500 pl-3">
          <h3 class="text-sm font-bold text-gray-900 dark:text-white">渲染核心配置</h3>
          <span class="text-[10px] text-gray-400">决定订阅如何转换与分流</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-white dark:bg-gray-800/40 p-4 border border-gray-100 dark:border-gray-700 misub-radius-lg shadow-sm">
          <!-- 引擎选择 -->
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">转换引擎 (Engine)</label>
            <select
              v-model="localProfile.subconverter.engineMode"
              class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md focus:ring-indigo-500 sm:text-sm dark:text-white transition-all font-medium"
            >
              <option value="">跟随全局配置</option>
              <option v-for="opt in engineOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div v-if="localProfile.subconverter.engineMode === ''" class="flex items-center gap-1.5 mt-1.5">
               <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
               <span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-tight">
                  当前全局：{{ globalEngineLabel }}
               </span>
            </div>
          </div>

          <!-- 方案选择 -->
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">配置规则方案 (Scheme)</label>
            <select
              v-model="localProfile.transformConfigMode"
              class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md focus:ring-indigo-500 sm:text-sm dark:text-white"
            >
              <option value="global">跟随全局方案</option>
              <option value="builtin" :disabled="isExternalEngine">内置自动分流</option>
              <option v-for="option in transformModeOptions.slice(1)" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <p v-if="isExternalEngine" class="mt-1 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
              第三方后端不支持 MiSub 内置规则源与内置模板，请选择预设远程模板或自定义 URL。
            </p>
            <div v-if="localProfile.transformConfigMode === 'global'" class="flex items-center gap-1.5 mt-1.5">
               <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
               <span class="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-tight">
                  当前全局：{{ globalConfigLabel }}
               </span>
            </div>
          </div>

          <!-- 引擎为第三方时的 URL 输入 -->
          <div v-if="isExternalEngine" class="sm:col-span-2 animate-fade-in-down border-t border-gray-50 dark:border-gray-700/50 pt-3">
            <label class="block text-xs font-medium text-orange-600 dark:text-orange-400 mb-1.5">第三方后端地址 (Backend URL Override)</label>
            <input
              type="text"
              v-model="localProfile.subconverter.backend"
              placeholder="留空则使用全局默认后端"
              class="block w-full px-3 py-2 bg-orange-50/20 dark:bg-orange-900/10 border border-orange-200/50 dark:border-orange-500/20 misub-radius-md sm:text-sm dark:text-white focus:ring-orange-500"
            />
            <div v-if="!localProfile.subconverter.backend" class="flex items-center gap-1.5 mt-1.5">
               <span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
               <span class="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-tight">
                  当前全局：{{ globalSettings?.subconverter?.defaultBackend || '未设置' }}
               </span>
            </div>

          </div>

          <!-- 规则配置选择器 -->
          <div v-if="localProfile.transformConfigMode !== 'global' && localProfile.transformConfigMode !== 'builtin'" class="sm:col-span-2 animate-fade-in-down border-t border-gray-50 dark:border-gray-700/50 pt-3">
            <label class="block text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1.5">定制化规则模板 (Config Template URL)</label>
            <TransformSelector
              v-model="localProfile.transformConfig"
              @select-asset="selectedTransformAsset = $event"
              type="config"
              placeholder="选择预设方案..."
              custom-placeholder="输入远程 .ini 规则配置 URL"
              :force-custom="localProfile.transformConfigMode === 'custom'"
              :allowEmpty="false"
              :exclude-builtin-assets="isExternalEngine"
            />
          </div>
        </div>
      </div>

      <!-- === 区块 B：参数微调与后处理 (Parameter Tuning) === -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
          <h3 class="text-sm font-bold text-gray-900 dark:text-white">参数微调与后处理</h3>
          <span class="text-[10px] text-gray-400">细化控制转换参数与结果</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-white dark:bg-gray-800/40 p-4 border border-gray-100 dark:border-gray-700 misub-radius-lg shadow-sm">
          <!-- 到期时间 -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">到期时间 (过期后回退原始订阅)</label>
            <input
              type="date"
              v-model="localProfile.expiresAt"
              class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md sm:text-sm dark:text-white"
            >
          </div>

          <!-- 内置规则等级 (当切换到内置引擎，或切换到第三方引擎但使用内置分流方案时显示) -->
          <div v-if="!isExternalEngine">

            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">内置规则等级 (仅内置自动分流生效)</label>
            <select
              v-model="localProfile.ruleLevel"
              :disabled="localProfile.transformConfigMode !== 'builtin' && localProfile.transformConfigMode !== 'global'"
              :class="{ 'opacity-50 cursor-not-allowed': localProfile.transformConfigMode !== 'builtin' && localProfile.transformConfigMode !== 'global' }"
              class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md sm:text-sm dark:text-white transition-all"
            >
              <option value="">跟随全局等级</option>
              <option value="base">精简版 Base</option>
              <option value="std">标准版 Standard</option>
              <option value="full">完整版 Full</option>
              <option value="relay">链式版 Relay</option>
            </select>
          </div>

          <!-- 节点前缀设置 (合并) -->
          <div class="sm:col-span-2 space-y-3 pt-2 border-t border-gray-50 dark:border-gray-700/50">
             <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">节点名称与可见性</label>
             <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- 手动节点文本前缀 -->
                <Input
                  v-model="localProfile.prefixSettings.manualNodePrefix"
                  label="手动节点前缀文本"
                  placeholder="留空则跟随全局"
                  size="sm"
                />
                
                <!-- 手动节点展示开关 -->
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-gray-500">手动节点展示</label>
                    <select v-model="localProfile.prefixSettings.enableManualNodes" class="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:ring-1 focus:ring-indigo-500">
                        <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
                    </select>
                </div>

                <!-- 机场订阅展示开关 (自动机场名) -->
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-gray-500">机场订阅前缀 (自动机场名)</label>
                    <select v-model="localProfile.prefixSettings.enableSubscriptions" class="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:ring-1 focus:ring-indigo-500">
                        <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
                    </select>
                </div>

                <!-- 组名前缀开关 -->
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-gray-500">组名前缀 (Prepend Group Name)</label>
                    <select v-model="localProfile.prefixSettings.prependGroupName" class="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:ring-1 focus:ring-indigo-500">
                        <option v-for="option in groupPrefixToggleOptions" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
                    </select>
                </div>
             </div>
          </div>

          <!-- 第三方开关 (仅第三方引擎显示) -->
          <div v-if="isExternalEngine" class="sm:col-span-2 animate-fade-in-down mt-2">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
               <div v-for="flag in flagOptions" :key="flag.key" class="flex flex-col gap-1.5 p-2 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5">
                 <div class="flex items-center gap-1.5">
                   <span class="text-xs">{{ flag.icon }}</span>
                   <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{{ flag.label }}</span>
                 </div>
                 <select v-model="localProfile.subconverter.options[flag.key]"
                   class="w-full px-1.5 py-1 text-[11px] bg-white dark:bg-gray-700 border-none misub-radius-md focus:ring-1 focus:ring-indigo-500 dark:text-white"
                 >
                   <option :value="null">跟随全局</option>
                   <option :value="true">开启</option>
                   <option :value="false">关闭</option>
                 </select>
               </div>
            </div>
          </div>
        </div>
      </div>

      <!-- === 区块 C：处理管道 (Process Workflow) === -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 border-l-4 border-indigo-400 pl-3">
          <h3 class="text-sm font-bold text-gray-900 dark:text-white">节点处理管道</h3>
          <span class="text-[10px] text-gray-400">流水线式批量处理节点逻辑</span>
        </div>
        
        <OperatorChain 
          v-model="localProfile.operators"
        />
      </div>
    </div>
  </div>
</template>
