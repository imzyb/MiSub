<script setup>
import { computed, ref, watch } from 'vue';
import { TRANSFORM_ASSETS } from '@/constants/transform-assets';

const props = defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, required: true }, // 'config'
  placeholder: { type: String, default: '' },
  allowEmpty: { type: Boolean, default: true }, // Whether empty selection is allowed (e.g. for "Use Global")
  forceCustom: { type: Boolean, default: false },
  customPlaceholder: { type: String, default: '输入外部规则模板 URL' }
});

const emit = defineEmits(['update:modelValue', 'select-asset']);

const assets = computed(() => {
  return TRANSFORM_ASSETS.configs;
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
    if (props.forceCustom) {
        isCustom.value = true;
        selectedUrl.value = 'custom';
        emit('select-asset', null);
        return;
    }

    if (isCustom.value && (newVal !== '' && newVal !== selectedUrl.value)) return; 

    const found = assets.value.find(item => item.url === newVal);
    if (found) {
        selectedUrl.value = newVal;
        isCustom.value = false;
        emit('select-asset', found);
    } else if (newVal && newVal.trim() !== '') {
        selectedUrl.value = 'custom';
        isCustom.value = true;
        emit('select-asset', null);
    } else {
        // Value is empty
        selectedUrl.value = '';
        isCustom.value = false;
        emit('select-asset', null);
    }
}, { immediate: true });

watch(() => props.forceCustom, (newVal) => {
    if (newVal) {
        isCustom.value = true;
        selectedUrl.value = 'custom';
        emit('select-asset', null);
    } else if (!props.modelValue) {
        isCustom.value = false;
        selectedUrl.value = '';
        emit('select-asset', null);
    }
}, { immediate: true });

const handleSelectChange = (e) => {
    if (props.forceCustom) return;

    const val = e.target.value;
    if (val === 'custom') {
        isCustom.value = true;
        // Don't clear immediately if we want to keep previous value to edit? 
        // Usually custom starts clean or with placeholder.
        emit('select-asset', null);
        emit('update:modelValue', ''); 
    } else {
        isCustom.value = false;
        selectedUrl.value = val;
        emit('select-asset', assets.value.find(item => item.url === val) || null);
        emit('update:modelValue', val);
    }
};

const handleCustomInput = (e) => {
    emit('update:modelValue', e.target.value);
};

const switchToSelect = () => {
    if (props.forceCustom) return;

    isCustom.value = false;
    selectedUrl.value = '';
    emit('select-asset', null);
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
        
        <optgroup v-for="(items, groupName) in groupedConfigs" :key="groupName" :label="groupName">
            <option v-for="item in items" :key="item.id" :value="item.url">
                {{ item.name }}
            </option>
        </optgroup>

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
                      :placeholder="customPlaceholder"
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

    <div v-if="type === 'config'" class="mt-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-xs dark:border-gray-700 dark:bg-gray-800/40">
      <div class="flex items-center justify-between gap-3">
        <p class="font-medium text-gray-700 dark:text-gray-200">模板变量说明</p>
        <span class="text-[11px] text-gray-400">适用于统一模板渲染</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div v-for="group in TEMPLATE_VARIABLE_GROUPS" :key="group.title" class="rounded-lg border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/20">
          <p class="font-medium text-gray-700 dark:text-gray-200">{{ group.title }}</p>
          <div class="mt-2 space-y-2">
            <div v-for="item in group.items" :key="item.key">
              <code class="text-[11px] text-indigo-600 dark:text-indigo-300">{{ item.key }}</code>
              <p class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">示例：{{ item.example }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
