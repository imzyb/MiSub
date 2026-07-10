<script setup>
import { computed } from 'vue';
import { useI18n } from '../../i18n/index.js';

const { locale, setLocale, t } = useI18n();

const isZh = computed(() => locale.value === 'zh-CN');

function toggleLocale() {
  setLocale(isZh.value ? 'en-US' : 'zh-CN');
}
</script>

<template>
  <button
    @click="toggleLocale"
    class="nav-action-btn nav-action-btn-neutral rounded-full"
    :title="isZh ? t('common.switchToEnglish') : t('common.switchToChinese')"
    :aria-label="isZh ? t('common.switchToEnglish') : t('common.switchToChinese')"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  </button>
</template>