<script setup>
import { computed, ref, watch } from 'vue';
import { SUBCONVERTER_ASSETS } from '@/constants/subconverter-assets';

const props = defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, required: true }, // 'backend' or 'config'
  placeholder: { type: String, default: '' },
  allowEmpty: { type: Boolean, default: true } // Whether empty selection is allowed (e.g. for "Use Global")
});

const emit = defineEmits(['update:modelValue']);

const assets = computed(() => {
  return props.type === 'backend' ? SUBCONVERTER_ASSETS.backends : SUBCONVERTER_ASSETS.configs;
});

const groupedConfigs = computed(() => {
  if (props.type !== 'config') return {};
  const groups = {};
  assets.value.forEach(item => {
    const group = item.group || '其他';
    if (!groups[group]) groups[group] = [];
    groups[group].push(item);
  });
  return groups;
});

const isCustom = ref(false);
const selectedUrl = ref('');

// Watch mechanism to sync internal state with external modelValue
watch(() => props.modelValue, (newVal) => {
    if (isCustom.value && (newVal !== '' && newVal !== selectedUrl.value)) return; 

    const found = assets.value.find(item => item.url === newVal);
    if (found) {
        selectedUrl.value = newVal;
        isCustom.value = false;
    } else if (newVal && newVal.trim() !== '') {
        selectedUrl.value = 'custom';
        isCustom.value = true;
    } else {
        // Value is empty
        selectedUrl.value = '';
        isCustom.value = false;
    }
}, { immediate: true });

const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === 'custom') {
        isCustom.value = true;
        // Don't clear immediately if we want to keep previous value to edit? 
        // Usually custom starts clean or with placeholder.
        emit('update:modelValue', ''); 
    } else {
        isCustom.value = false;
        selectedUrl.value = val;
        emit('update:modelValue', val);
    }
};

const handleCustomInput = (e) => {
    emit('update:modelValue', e.target.value);
};

const switchToSelect = () => {
    isCustom.value = false;
    selectedUrl.value = '';
    emit('update:modelValue', '');
};
</script>

<template>
  <div>
    <div v-if="!isCustom" class="relative">
      <select 
        :value="selectedUrl" 
        @change="handleSelectChange"
        class="block w-full px-3 py-2 pr-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-lg shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white appearance-none"
      >
        <option value="">{{ placeholder || (allowEmpty ? '默认 / 全局设置' : '请选择...') }}</option>
        
        <template v-if="type === 'backend'">
            <option v-for="item in assets" :key="item.id" :value="item.url">
                {{ item.name }}
            </option>
        </template>
        
        <template v-else>
            <optgroup v-for="(items, groupName) in groupedConfigs" :key="groupName" :label="groupName">
                <option v-for="item in items" :key="item.id" :value="item.url">
                    {{ item.name }}
                </option>
            </optgroup>
        </template>

        <option value="custom" class="font-bold text-indigo-600 dark:text-indigo-400 border-t">✍️ 自定义输入...</option>
      </select>
      <!-- Custom Arrow -->
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
    </div>
    
    <div v-else class="w-full">
         <div class="flex items-center gap-2">
            <div class="relative flex-grow">
                 <input 
                     type="text" 
                     :value="modelValue"
                     @input="handleCustomInput"
                     :placeholder="type === 'backend' ? '输入 SubConverter 后端地址 (不带 https://)' : '输入远程配置 URL'"
                     class="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-lg shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
                 />
            </div>
            <button 
                @click="switchToSelect"
                class="flex-shrink-0 p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 misub-radius-lg transition-colors"
                title="返回列表选择"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
         </div>
         <p v-if="modelValue" class="mt-1 text-xs text-indigo-500 truncate" title="当前自定义值">
            当前值: {{ modelValue }}
         </p>
    </div>
  </div>
</template>
