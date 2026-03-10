<script setup>
defineProps({
  textSizeClass: {
    type: String,
    default: 'text-lg'
  },
  iconSize: {
    type: Number,
    default: 20
  }
});
</script>

<template>
  <div class="nav-brand-wrap">
    <div class="nav-brand-badge nav-brand-badge-sm" aria-hidden="true">
      <svg :width="iconSize" :height="iconSize" viewBox="0 0 128 128" fill="currentColor">
        <path d="M64 128a64 64 0 1 1 64-64a64.07 64.07 0 0 1-64 64Zm0-122a58 58 0 1 0 58 58A58.07 58.07 0 0 0 64 6Z" />
        <path d="M64 100a36 36 0 1 1 36-36a36 36 0 0 1-36 36Zm0-66a30 30 0 1 0 30 30a30 30 0 0 0-30-30Z" />
      </svg>
    </div>
    <span class="nav-brand-text" :class="textSizeClass">MiSub</span>
  </div>
</template>
