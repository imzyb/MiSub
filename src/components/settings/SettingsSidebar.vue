<script setup>
const props = defineProps({
  activeTab: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:activeTab']);

const tabs = [
  { id: 'basic', label: '基础设置' },
  { id: 'home', label: '首页设置' },
  { id: 'custom-page', label: '自定义公开页' },
  { id: 'global', label: '全局设置' },
  { id: 'service', label: '服务集成' },
  { id: 'client', label: '客户端管理' },
  { id: 'system', label: '系统设置' },
];
</script>

<template>
  <nav class="grid grid-cols-2 gap-2 p-1 md:flex md:flex-col md:space-y-1 md:gap-0 md:p-0">
    <button v-for="tab in tabs" :key="tab.id" @click="emit('update:activeTab', tab.id)"
      class="relative flex items-center justify-center md:justify-start px-4 py-3 text-sm font-medium misub-radius-lg transition-all duration-200"
      :class="activeTab === tab.id
        ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25 border border-white/10'
        : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-200'">
      <span v-if="activeTab === tab.id" class="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-white/90"></span>
      <svg class="mr-2 md:mr-3 flex-shrink-0 h-5 w-5 md:h-6 md:w-6"
        :class="activeTab === tab.id ? 'text-white' : 'text-gray-400 dark:text-gray-500'"
        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path v-if="tab.id === 'basic'" stroke-linecap="round" stroke-linejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path v-if="tab.id === 'basic'" stroke-linecap="round" stroke-linejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />

          <path v-if="tab.id === 'home'" stroke-linecap="round" stroke-linejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />

          <path v-if="tab.id === 'global'" stroke-linecap="round" stroke-linejoin="round"
            d="M12 3c-4.418 0-8 3.134-8 7s3.582 7 8 7 8-3.134 8-7-3.582-7-8-7zm0 10.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0 5.5v2m-4-3l-1.5 1.5m9-1.5L16 19.5m-9-9H3m18 0h-4" />

          <path v-if="tab.id === 'service'" stroke-linecap="round" stroke-linejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z" />

          <path v-if="tab.id === 'client'" stroke-linecap="round" stroke-linejoin="round"
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />

          <path v-if="tab.id === 'system'" stroke-linecap="round" stroke-linejoin="round"
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2-2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />

          <path v-if="tab.id === 'custom-page'" stroke-linecap="round" stroke-linejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {{ tab.label }}
    </button>
  </nav>
</template>
