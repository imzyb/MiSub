<script setup>
import { computed } from 'vue';
import SubConverterSelector from '../../forms/SubConverterSelector.vue';
import NodeTransformSettings from '../../settings/NodeTransformSettings.vue';
import Input from '../../ui/Input.vue';

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
createDefaultNodeTransform: {
type: Function,
required: true
}
});

const emit = defineEmits(['toggle-advanced']);

const nodeTransformMode = computed({
  get: () => (props.localProfile.nodeTransform ? 'custom' : 'global'),
  set: (value) => {
    if (value === 'custom') {
      if (!props.localProfile.nodeTransform) {
        props.localProfile.nodeTransform = props.createDefaultNodeTransform();
      }
    } else {
      props.localProfile.nodeTransform = null;
    }
  }
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
          <label for="profile-subconverter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            自定义后端 (可选)
          </label>
          <SubConverterSelector
            id="profile-subconverter"
            v-model="localProfile.subConverter"
            type="backend"
            placeholder="留空则使用全局设置"
            :allowEmpty="true"
          />
          <p class="text-xs text-gray-400 mt-1">为此订阅组指定一个独立的 SubConverter 后端地址。</p>
        </div>
        <div>
          <label for="profile-subconfig" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            自定义远程配置 (可选)
          </label>
          <SubConverterSelector
            id="profile-subconfig"
            v-model="localProfile.subConfig"
            type="config"
            placeholder="留空则使用全局设置"
            :allowEmpty="true"
          />
          <p class="text-xs text-gray-400 mt-1">为此订阅组指定一个独立的 Subconverter 配置文件。</p>
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

      <!-- Node Transform Settings -->
      <div class="bg-gray-50 dark:bg-gray-800/50 misub-radius-md p-3 border border-gray-100 dark:border-gray-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ uiText.nodeTransformTitle }}</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">净化配置来源</label>
            <select
              v-model="nodeTransformMode"
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="global">使用全局设置</option>
              <option value="custom">自定义</option>
            </select>
          </div>
        </div>
        <NodeTransformSettings
          v-if="nodeTransformMode === 'custom'"
          :model-value="localProfile.nodeTransform"
          @update:model-value="val => localProfile.nodeTransform = val"
        />
      </div>
    </div>
  </div>
</template>
