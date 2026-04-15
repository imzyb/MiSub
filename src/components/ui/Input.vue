<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  },
  error: {
    type: String,
    default: ''
  },
  id: {
    type: String,
    default: () => `input-${Math.random().toString(36).substr(2, 9)}`
  },
  prefix: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  autocomplete: {
    type: String,
    default: 'off'
  },
  name: {
    type: String,
    default: undefined
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  }
});

const emit = defineEmits(['update:modelValue']);

const updateValue = (event) => {
  emit('update:modelValue', event.target.value);
};

const hasIcon = computed(() => props.icon !== null);
const hasPrefix = computed(() => props.prefix !== '');

// 尺寸映射支持
const sizeMap = {
  sm: {
    input: 'py-1.5 text-xs misub-radius-md px-2',
    label: 'text-xs mb-1 ml-1',
    icon: 'h-4 w-4'
  },
  md: {
    input: 'py-2 text-sm misub-radius-md px-3',
    label: 'text-sm mb-1.5 ml-1',
    icon: 'h-4 w-4'
  },
  lg: {
    input: 'py-3 text-base misub-radius-lg px-4',
    label: 'text-sm mb-1.5 ml-1',
    icon: 'h-5 w-5'
  }
};

const currentSize = computed(() => sizeMap[props.size] || sizeMap.md);
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="block font-medium text-gray-700 dark:text-gray-300" :class="currentSize.label">
      {{ label }}
    </label>
    <div class="relative group">
      <!-- Icon Slot/Prop -->
      <div v-if="hasIcon" class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
        <slot name="icon">
          <svg class="h-4 w-4" :class="currentSize.icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="icon" />
          </svg>
        </slot>
      </div>

      <!-- Prefix Slot/Prop -->
      <div v-else-if="hasPrefix" class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors duration-200 text-gray-500 dark:text-gray-400">
        <slot name="prefix">
          <span class="font-medium" :class="props.size === 'sm' ? 'text-[10px]' : 'text-sm'">{{ prefix }}</span>
        </slot>
      </div>
      
      <input
        :id="id"
        :name="name"
        :autocomplete="autocomplete"
        :value="modelValue"
        @input="updateValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 dark:focus:border-primary-500 focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        :class="[
            currentSize.input,
            hasIcon || hasPrefix ? 'pl-9' : '',
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' : ''
        ]"
      />
      
      <!-- Focus Glow -->
      <div class="absolute inset-0 misub-radius-lg pointer-events-none transition-opacity duration-300 opacity-0 group-focus-within:opacity-100 ring-1 ring-primary-500/20"></div>
    </div>
    
    <p v-if="error" class="mt-1 text-xs text-red-500 ml-1">
      {{ error }}
    </p>
  </div>
</template>
