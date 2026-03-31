<script setup>
defineProps({
  path: {
    type: String,
    required: true
  },
  viewBox: {
    type: String,
    default: '0 0 24 24'
  },
  className: {
    type: String,
    default: ''
  }
});
</script>

<template>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    :viewBox="viewBox" 
    fill="none" 
    stroke="currentColor" 
    :class="className"
  >
    <path 
      stroke-linecap="round" 
      stroke-linejoin="round" 
      stroke-width="2" 
      :d="path" 
    />
  </svg>
</template>
