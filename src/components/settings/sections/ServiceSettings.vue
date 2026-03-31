<script setup>
import SubConverterCard from './ServiceSettings/SubConverterCard.vue';
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
    <SubConverterCard :settings="settings" />
    <TelegramCard :settings="settings" />
    <CronCard :settings="settings" />
  </div>
</template>
