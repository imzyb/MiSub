<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const toggle = () => {
  if (props.disabled) return;
  const newValue = !props.modelValue;
  emit('update:modelValue', newValue);
  emit('change', newValue);
};
</script>

<template>
  <label class="relative inline-flex items-center cursor-pointer tap-effect select-none" :class="{ 'opacity-50 cursor-not-allowed': disabled }">
    <input 
      type="checkbox" 
      class="sr-only peer" 
      :checked="modelValue" 
      :disabled="disabled"
      @change="toggle"
    >
    <div 
      class="w-11 h-6 bg-gray-200/80 dark:bg-white/10 peer-focus:outline-none rounded-full peer 
             after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
             after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all 
             after:shadow-md after:shadow-black/10 
             peer-checked:after:translate-x-full peer-checked:bg-primary-600 dark:peer-checked:bg-primary-500
             peer-checked:shadow-[0_0_0_3px_rgba(124,58,237,0.28)] 
             transition-all duration-300"
    ></div>
    <span v-if="label" class="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </span>
  </label>
</template>

<style scoped>
/* Optional: Add active press effect */
.tap-effect:active .after {
  width: 24px;
}
</style>
