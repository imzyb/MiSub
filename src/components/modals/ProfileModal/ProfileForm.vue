<script setup>
import { computed, ref, watch } from 'vue';
import TransformSelector from '../../forms/TransformSelector.vue';
import Input from '../../ui/Input.vue';
import Switch from '../../ui/Switch.vue';
import OperatorChain from '../../features/Operators/OperatorChain.vue';
import { TRANSFORM_ASSETS } from '@/constants/transform-assets';
import { useI18n } from '@/i18n/index.js';

const { t } = useI18n();

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
  return mode === 'external' ? t('profileModal.externalBackend') : t('profileModal.builtinEngine');
});

const globalConfigLabel = computed(() => {
  const mode = props.globalSettings?.transformConfigMode || 'builtin';
  if (mode === 'builtin') return t('profileModal.builtinAutoRoute');
  const url = props.globalSettings?.transformConfig || '';
  const asset = TRANSFORM_ASSETS.configs.find(a => a.url === url);
  return asset ? asset.name : (url ? t('profileModal.customUrl') : t('profileModal.notSet'));
});

const transformModeOptions = [
  { value: 'global', label: t('profileModal.followGlobalSettings') },
  { value: 'preset', label: t('profileModal.selectPreset') },
  { value: 'custom', label: t('profileModal.customTemplateUrl') },
  { value: 'custom_template', label: t('profileModal.customTemplate') }
];

const engineOptions = [
  { value: 'builtin', label: t('profileModal.builtinScriptEngine') },
  { value: 'external', label: t('profileModal.externalBackendConvert') }
];

const flagOptions = [
  { key: 'udp', label: t('profileModal.udpForward'), icon: '⚡️' },
  { key: 'emoji', label: t('profileModal.emojiSwitch'), icon: '🎨' },
  { key: 'scv', label: t('profileModal.skipCert'), icon: '🛡️' },
  { key: 'sort', label: t('profileModal.nodeSort'), icon: '🔢' },
  { key: 'tfo', label: 'TCP Fast Open', icon: '🚀' },
  { key: 'list', label: t('profileModal.outputList'), icon: '📋' }
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

  if (props.localProfile.transformConfigMode === 'builtin' || props.localProfile.transformConfigMode === 'custom_template') {
    props.localProfile.transformConfigMode = 'preset';
  }

  if (/^(builtin|custom):/.test(String(props.localProfile.transformConfig || ''))) {
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
        :label="t('profiles.nameLabel')"
        :placeholder="t('profiles.namePlaceholder')"
      />
    </div>
    <div>
      <Input
        id="profile-custom-id"
        v-model="localProfile.customId"
        :label="t('profiles.customIdLabel')"
        :placeholder="t('profiles.customIdPlaceholder')"
      />
      <p class="text-xs text-gray-400 mt-1 ml-1">{{ t('profiles.customIdHint') }}</p>
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
          {{ t('profiles.publicDisplay') }}
        </label>
      </div>
      <span class="text-xs text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full" v-if="localProfile.isPublic">
        {{ t('profiles.publicVisible') }}
      </span>
    </div>
    
    <div v-if="localProfile.isPublic" class="animate-fade-in-down">
      <textarea
        id="profile-description"
        v-model="localProfile.description"
        rows="2"
        :placeholder="t('profiles.descriptionPlaceholder')"
        class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
      ></textarea>
    </div>
    <div v-else class="text-xs text-gray-400">
      {{ t('profiles.publicDisplayHint') }}
    </div>
  </div>

  <!-- Advanced Settings Toggle -->
  <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
    <button 
      type="button" 
      @click="emit('toggle-advanced')"
      class="flex items-center text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-hidden"
    >
      <span>{{ t('profiles.advancedTitle') }}</span>
      <svg :class="{ 'rotate-180': showAdvanced }" class="w-4 h-4 ml-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    
    <div v-show="showAdvanced" class="mt-4 space-y-8 animate-fade-in-down">
      <!-- === 区块 A：渲染核心配置 (Core Logic) === -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 border-l-4 border-indigo-500 pl-3">
          <h3 class="text-sm font-bold text-gray-900 dark:text-white">{{ t('profileModal.coreConfig') }}</h3>
          <span class="text-[10px] text-gray-400">{{ t('profileModal.coreConfigDesc') }}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-white dark:bg-gray-800/40 p-4 border border-gray-100 dark:border-gray-700 misub-radius-lg shadow-sm">
          <!-- 引擎选择 -->
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('profileModal.engineLabel') }}</label>
            <select
              v-model="localProfile.subconverter.engineMode"
              class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md focus:ring-indigo-500 sm:text-sm dark:text-white transition-all font-medium"
            >
              <option value="">{{ t('profileModal.followGlobalConfig') }}</option>
              <option v-for="opt in engineOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div v-if="localProfile.subconverter.engineMode === ''" class="flex items-center gap-1.5 mt-1.5">
               <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
               <span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-tight">
                  {{ t('profileModal.currentGlobal', { value: globalEngineLabel }) }}
               </span>
            </div>
          </div>

          <!-- 方案选择 -->
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('profileModal.schemeLabel') }}</label>
            <select
              v-model="localProfile.transformConfigMode"
              class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md focus:ring-indigo-500 sm:text-sm dark:text-white"
            >
              <option value="global">{{ t('profileModal.followGlobalScheme') }}</option>
              <option value="builtin" :disabled="isExternalEngine">{{ t('profileModal.builtinAutoRoute') }}</option>
              <option
                v-for="option in transformModeOptions.slice(1)"
                :key="option.value"
                :value="option.value"
                :disabled="option.value === 'custom_template' && isExternalEngine"
              >
                {{ option.label }}
              </option>
            </select>
            <p v-if="isExternalEngine" class="mt-1 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
              {{ t('profileModal.externalEngineHint') }}
            </p>
            <div v-if="localProfile.transformConfigMode === 'global'" class="flex items-center gap-1.5 mt-1.5">
               <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
               <span class="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-tight">
                  {{ t('profileModal.currentGlobal', { value: globalConfigLabel }) }}
               </span>
            </div>
          </div>

          <!-- 引擎为第三方时的 URL 输入 -->
          <div v-if="isExternalEngine" class="sm:col-span-2 animate-fade-in-down border-t border-gray-50 dark:border-gray-700/50 pt-3">
            <label class="block text-xs font-medium text-orange-600 dark:text-orange-400 mb-1.5">{{ t('profileModal.backendOverride') }}</label>
            <input
              type="text"
              v-model="localProfile.subconverter.backend"
              :placeholder="t('profileModal.backendPlaceholder')"
              class="block w-full px-3 py-2 bg-orange-50/20 dark:bg-orange-900/10 border border-orange-200/50 dark:border-orange-500/20 misub-radius-md sm:text-sm dark:text-white focus:ring-orange-500"
            />
            <p class="mt-1.5 text-[10px] leading-relaxed text-gray-400">
              {{ t('profileModal.backendHint') }}
            </p>
            <div v-if="!localProfile.subconverter.backend" class="flex items-center gap-1.5 mt-1.5">
               <span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
               <span class="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-tight">
                  {{ t('profileModal.currentGlobal', { value: globalSettings?.subconverter?.defaultBackend || t('profileModal.notSet') }) }}
               </span>
            </div>

          </div>

          <!-- 规则配置选择器 -->
          <div v-if="localProfile.transformConfigMode !== 'global' && localProfile.transformConfigMode !== 'builtin'" class="sm:col-span-2 animate-fade-in-down border-t border-gray-50 dark:border-gray-700/50 pt-3">
            <label class="block text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1.5">{{ t('profileModal.templateLabel') }}</label>
            <TransformSelector
              v-model="localProfile.transformConfig"
              @select-asset="selectedTransformAsset = $event"
              type="config"
              :placeholder="t('profileModal.presetPlaceholder')"
              :custom-placeholder="t('profileModal.remoteTemplatePlaceholder')"
              :force-custom="localProfile.transformConfigMode === 'custom'"
              :custom-templates-only="localProfile.transformConfigMode === 'custom_template'"
              :allowEmpty="false"
              :exclude-builtin-assets="isExternalEngine"
            />
            <p v-if="localProfile.transformConfigMode === 'custom_template'" class="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] leading-relaxed text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {{ t('profileModal.customTemplateHint') }}
            </p>
          </div>
        </div>
      </div>

      <!-- === 区块 B：参数微调与后处理 (Parameter Tuning) === -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
          <h3 class="text-sm font-bold text-gray-900 dark:text-white">{{ t('profileModal.tuningTitle') }}</h3>
          <span class="text-[10px] text-gray-400">{{ t('profileModal.tuningDesc') }}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-white dark:bg-gray-800/40 p-4 border border-gray-100 dark:border-gray-700 misub-radius-lg shadow-sm">
          <!-- 到期时间 -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ t('profileModal.expiresLabel') }}</label>
            <input
              type="date"
              v-model="localProfile.expiresAt"
              class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md sm:text-sm dark:text-white"
            >
          </div>

          <!-- 内置规则等级 (当切换到内置引擎，或切换到第三方引擎但使用内置分流方案时显示) -->
          <div v-if="!isExternalEngine">

            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ t('profileModal.ruleLevelLabel') }}</label>
            <select
              v-model="localProfile.ruleLevel"
              :disabled="localProfile.transformConfigMode !== 'builtin' && localProfile.transformConfigMode !== 'global'"
              :class="{ 'opacity-50 cursor-not-allowed': localProfile.transformConfigMode !== 'builtin' && localProfile.transformConfigMode !== 'global' }"
              class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md sm:text-sm dark:text-white transition-all"
            >
              <option value="">{{ t('profileModal.followGlobalLevel') }}</option>
              <option value="base">{{ t('profileModal.ruleBase') }}</option>
              <option value="std">{{ t('profileModal.ruleStandard') }}</option>
              <option value="full">{{ t('profileModal.ruleFull') }}</option>
              <option value="relay">{{ t('profileModal.ruleRelay') }}</option>
            </select>
          </div>

          <!-- 节点前缀设置 (合并) -->
          <div class="sm:col-span-2 space-y-3 pt-2 border-t border-gray-50 dark:border-gray-700/50">
             <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">{{ t('profileModal.nodeNameVisibility') }}</label>
             <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- 手动节点文本前缀 -->
                <Input
                  v-model="localProfile.prefixSettings.manualNodePrefix"
                  :label="t('profileModal.manualPrefixText')"
                  :placeholder="t('profileModal.followGlobalEmpty')"
                  size="sm"
                />
                
                <!-- {{ t('profileModal.manualNodeDisplay') }}开关 -->
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-gray-500">{{ t('profileModal.manualNodeDisplay') }}</label>
                    <select v-model="localProfile.prefixSettings.enableManualNodes" class="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:ring-1 focus:ring-indigo-500">
                        <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
                    </select>
                </div>

                <!-- 机场订阅展示开关 (自动机场名) -->
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-gray-500">{{ t('profileModal.subscriptionPrefix') }}</label>
                    <select v-model="localProfile.prefixSettings.enableSubscriptions" class="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:ring-1 focus:ring-indigo-500">
                        <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
                    </select>
                </div>

                <!-- 组名前缀开关 -->
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-gray-500">{{ t('profileModal.groupPrefix') }}</label>
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
                   <option :value="null">{{ t('profileModal.followGlobal') }}</option>
                   <option :value="true">{{ t('profileModal.on') }}</option>
                   <option :value="false">{{ t('profileModal.off') }}</option>
                 </select>
               </div>
            </div>
          </div>
        </div>
      </div>

      <!-- === 区块 C：处理管道 (Process Workflow) === -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 border-l-4 border-indigo-400 pl-3">
          <h3 class="text-sm font-bold text-gray-900 dark:text-white">{{ t('profileModal.pipelineTitle') }}</h3>
          <span class="text-[10px] text-gray-400">{{ t('profileModal.pipelineDesc') }}</span>
        </div>
        
        <OperatorChain 
          v-model="localProfile.operators"
        />
      </div>
    </div>
  </div>
</template>
