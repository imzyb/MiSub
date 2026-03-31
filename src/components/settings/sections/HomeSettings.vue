<script setup>
import Input from '../../ui/Input.vue';
import AnnouncementSettings from './AnnouncementSettings.vue';
import GuestbookManagement from './GuestbookManagement.vue';

defineProps({
  settings: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <div v-if="settings" class="space-y-8">
    <!-- 公开页 Hero 设置 -->
    <div
      class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        公开页 Hero 设置
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Input 
            label="主标题 (第一行)"
            v-model="settings.heroTitle1"
            placeholder="默认：发现"
          />
        </div>
        <div>
          <Input 
            label="主标题 (第二行)"
            v-model="settings.heroTitle2"
            placeholder="默认：优质订阅"
          />
        </div>
        <div class="md:col-span-2">
          <Input 
            label="副标题 / 描述"
            v-model="settings.heroDescription"
            placeholder="默认：浏览并获取由管理员分享的精选订阅组合，一键导入到您的客户端。"
          />
        </div>
      </div>
    </div>

    <!-- Announcement Settings -->
    <AnnouncementSettings :settings="settings" />

    <!-- Guestbook Management -->
    <GuestbookManagement :settings="settings" />
  </div>
</template>
