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
  }
});

const emit = defineEmits(['update:modelValue']);

const updateValue = (event) => {
  emit('update:modelValue', event.target.value);
};

const hasIcon = computed(() => props.icon !== null);
const hasPrefix = computed(() => props.prefix !== '');
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
      {{ label }}
    </label>
    <div class="relative group">
      <!-- Icon Slot/Prop -->
      <div v-if="hasIcon" class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
        <slot name="icon">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="icon" />
          </svg>
        </slot>
      </div>

      <!-- Prefix Slot/Prop -->
      <div v-else-if="hasPrefix" class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors duration-200 text-gray-500 dark:text-gray-400">
        <slot name="prefix">
          <span class="text-sm font-medium">{{ prefix }}</span>
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
        class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 dark:focus:border-primary-500 focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        :class="[
            hasIcon ? 'pl-10 pr-4' : (hasPrefix ? 'pl-10 pr-4' : 'px-4'),
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' : ''
        ]"
      />
      
      <!-- Focus Glow -->
      <div class="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300 opacity-0 group-focus-within:opacity-100 ring-1 ring-primary-500/20"></div>
    </div>
    
    <p v-if="error" class="mt-1 text-xs text-red-500 ml-1">
      {{ error }}
    </p>
  </div>
</template>
