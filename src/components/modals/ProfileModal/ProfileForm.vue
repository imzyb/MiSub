<script setup>
import { computed, ref } from 'vue';
import TransformSelector from '../../forms/TransformSelector.vue';
import Input from '../../ui/Input.vue';
import OperatorChain from '../../features/Operators/OperatorChain.vue';

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
  }
});

const transformModeOptions = [
  { value: 'global', label: '跟随全局设置' },
  { value: 'preset', label: '引用全局方案' },
  { value: 'custom', label: '自定义规则模板' }
];

const selectedTransformAsset = ref(null);

const emit = defineEmits(['toggle-advanced']);

const isRemoteConfig = computed(() => ['preset', 'custom'].includes(props.localProfile.transformConfigMode));

const transformModeHint = computed(() => {
  if (props.localProfile.transformConfigMode === 'global') return '继承全局规则来源，适合绝大多数订阅组。';
  if (props.localProfile.transformConfigMode === 'builtin') return '当前订阅组强制使用内置模板与统一渲染逻辑。';
  if (props.localProfile.transformConfigMode === 'preset') return '系统会按客户端自动适配，预设模板将通过统一模板主线输出。';
  return '系统会按客户端自动适配，自定义 URL 会在兼容的目标客户端上走统一模板渲染。';
});
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
      <p class="text-xs text-gray-400 mt-1 ml-1">设置后，订阅链接会更短，如 /token/home</p>
    </div>
  </div>

  <!-- Public Display & Description -->
  <div class="bg-gray-50 dark:bg-gray-800/50 misub-radius-md p-4 border border-gray-100 dark:border-gray-700">
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
      <label for="profile-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        公开页描述 / 简介
      </label>
      <textarea
        id="profile-description"
        v-model="localProfile.description"
        rows="2"
        placeholder="简要介绍此订阅组的内容，将在公开页面展示。"
        class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
      ></textarea>
    </div>
    <div v-else class="text-xs text-gray-400">
      开启后，任何人均可通过公开页面查看此订阅组的名称和简介，并获取订阅链接。
    </div>
  </div>

  <!-- Advanced Settings Toggle -->
  <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
    <button 
      type="button" 
      @click="emit('toggle-advanced')"
      class="flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-hidden"
    >
      <span>高级设置</span>
      <svg :class="{ 'rotate-180': showAdvanced }" class="w-4 h-4 ml-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    
    <div v-show="showAdvanced" class="mt-4 space-y-4 animate-fade-in-down">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="profile-transform-config" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            规则来源
          </label>
          <select
            id="profile-transform-config-mode"
            v-model="localProfile.transformConfigMode"
            class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          >
            <option v-for="option in transformModeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div v-if="localProfile.transformConfigMode !== 'global' && localProfile.transformConfigMode !== 'builtin'">
          <label for="profile-transform-config-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            外部规则模板 / 配置
          </label>
          <TransformSelector
            id="profile-transform-config-url"
            v-model="localProfile.transformConfig"
            @select-asset="selectedTransformAsset = $event"
            type="config"
            placeholder="选择预设模板"
            custom-placeholder="输入外部规则模板 URL"
            :force-custom="localProfile.transformConfigMode === 'custom'"
            :allowEmpty="localProfile.transformConfigMode !== 'custom'"
          />
          <p class="text-xs text-gray-400 mt-1">可为该订阅组单独指定预设模板或外部 URL；留空时按当前来源模式回退。</p>
          <p class="text-xs text-gray-400 mt-1">{{ transformModeHint }}</p>
          <div v-if="selectedTransformAsset" class="mt-2 rounded-lg border border-indigo-200/70 dark:border-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-500/5 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300">
            <p class="font-medium">{{ selectedTransformAsset.name }}</p>
            <p class="mt-1">来源类型：{{ selectedTransformAsset.sourceType === 'builtin-preset' ? '内置预设' : '远程预设' }}</p>
            <p class="mt-1">{{ selectedTransformAsset.description }}</p>
            <p class="mt-1">适用客户端：{{ selectedTransformAsset.compatibleClients.join(' / ') }}</p>
          </div>
        </div>
        <div>
          <label for="profile-expires-at" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            到期时间 (可选)
          </label>
          <input
            type="date"
            id="profile-expires-at"
            v-model="localProfile.expiresAt"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          >
          <p class="text-xs text-gray-400 mt-1">设置此订阅组的到期时间，到期后将返回默认节点。</p>
        </div>
        <div>
          <label for="profile-rule-level" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            规则等级
          </label>
          <select
            id="profile-rule-level"
            v-model="localProfile.ruleLevel"
            :disabled="isRemoteConfig"
            :class="{ 'bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed opacity-70': isRemoteConfig }"
            class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white transition-all"
          >
            <option value="">跟随全局设置</option>
            <option value="base">精简版 Base</option>
            <option value="std">标准版 Standard</option>
            <option value="full">完整版 Full</option>
            <option value="relay">链式版 Relay</option>
          </select>
          <p class="text-xs mt-1" :class="isRemoteConfig ? 'text-indigo-500 font-medium' : 'text-gray-400'">
            {{ isRemoteConfig ? '检测到自定义配置，内置规则等级已禁用' : '为此订阅组指定独立的统一规则等级。' }}
          </p>
        </div>
      </div>

      <!-- Prefix Settings -->
      <div class="bg-gray-50 dark:bg-gray-800/50 misub-radius-md p-3 border border-gray-100 dark:border-gray-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ uiText.prefixTitle }}</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{{ uiText.manualPrefixLabel }}</label>
            <input
              type="text"
              v-model="localProfile.prefixSettings.manualNodePrefix"
              placeholder="留空则使用全局前缀"
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{{ uiText.manualPrefixToggle }}</label>
            <select
              v-model="localProfile.prefixSettings.enableManualNodes"
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
<div>
<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{{ uiText.subscriptionPrefixToggle }}</label>
<select
v-model="localProfile.prefixSettings.enableSubscriptions"
class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
>
<option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">
{{ option.label }}
</option>
</select>
</div>
<div class="sm:col-span-2">
<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">分组名称前缀</label>
<select
v-model="localProfile.prefixSettings.prependGroupName"
class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
>
<option v-for="option in groupPrefixToggleOptions" :key="String(option.value)" :value="option.value">
{{ option.label }}
</option>
</select>
<p class="text-xs text-gray-400 mt-1">启用后，手动节点输出时会在名称前添加分组名称（如"香港 - 节点名"）</p>
</div>
</div>
      </div>

      <!-- Operator Chain -->
      <div class="bg-indigo-50/20 dark:bg-indigo-900/10 misub-radius-lg p-5 border border-indigo-100 dark:border-indigo-500/10 shadow-sm mt-4">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
             <div class="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
             </div>
             <div>
                 <h3 class="text-sm font-bold text-gray-900 dark:text-white">节点处理工作流</h3>
                 <p class="text-[10px] text-gray-400 mt-0.5">链式处理流水线，留空则自动跟随全局操作符链。</p>
              </div>
           </div>
        </div>
        
        <OperatorChain 
          v-model="localProfile.operators"
          :legacy-data="localProfile.nodeTransform"
        />
      </div>
    </div>
  </div>
</template>
