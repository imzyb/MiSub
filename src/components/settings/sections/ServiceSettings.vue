<script setup>
import TransformCard from './ServiceSettings/TransformCard.vue';
import TelegramCard from './ServiceSettings/TelegramCard.vue';
import CronCard from './ServiceSettings/CronCard.vue';

defineProps({
  settings: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <div class="space-y-8">
    <TransformCard :settings="settings" />
    <TelegramCard :settings="settings" />
    <CronCard :settings="settings" />
  </div>
</template>
