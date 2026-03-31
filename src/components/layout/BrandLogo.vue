<script setup>
defineProps({
  textSizeClass: {
    type: String,
    default: 'text-lg'
  },
  iconSize: {
    type: Number,
    default: 28
  }
});
</script>

<template>
  <router-link to="/" class="nav-brand-wrap">
    <div class="nav-brand-badge nav-brand-badge-sm" aria-hidden="true">
      <img :width="iconSize" :height="iconSize" src="/logo.png" alt="MiSub" />
    </div>
    <span class="nav-brand-text" :class="textSizeClass">MiSub</span>
  </router-link>
</template>
