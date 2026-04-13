<script setup>
import QRCodeOverlay from './QRCodeOverlay.vue';
import BaseIcon from '../ui/BaseIcon.vue';

const props = defineProps({
  profile: {
    type: Object,
    required: true
  },
  isQrExpanded: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'quick-import',
  'toggle-qr',
  'preview',
  'copy-link',
  'download-qr',
  'register-canvas'
]);

// Icon Paths
const ICONS = {
  import: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  qr: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
  preview: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1'
};
</script>

<template>
  <div class="group relative flex h-full flex-col rounded-[1.5rem] border border-gray-100 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary-500/20 hover:shadow-xl hover:shadow-primary-500/5 dark:border-white/5 dark:bg-[#1a1d29]">
    <!-- Header: Icon & Title -->
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center gap-4">
         <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 transition-transform duration-300 group-hover:scale-105 dark:border-white/5 dark:bg-white/5">
          <span class="text-2xl drop-shadow-sm">🚀</span>
        </div>
        <h3
          class="text-lg font-bold text-gray-900 dark:text-white line-clamp-1"
          :title="profile.name"
        >
          {{ profile.name }}
        </h3>
      </div>
      
<!-- QR Toggle (Small Top Right) -->
      <button
        @click.stop="emit('toggle-qr', profile)"
        class="rounded-lg border border-gray-200 p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-primary-600 dark:border-gray-700 dark:hover:bg-white/10 dark:hover:text-primary-400"
        title="显示二维码"
        :class="{ 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400': isQrExpanded }"
        aria-label="显示二维码"
      >
        <BaseIcon :path="ICONS.qr" className="w-5 h-5" />
      </button>
    </div>

    <!-- Body: Description -->
    <div class="flex-1 mb-6">
       <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed line-clamp-3">
        {{ profile.description || '暂无简介' }}
      </p>
    </div>

    <!-- Footer: Action Bar -->
    <div class="mt-auto pt-4 border-t border-gray-100 dark:border-white/5 flex items-center gap-3">
<!-- Primary Action: Import -->
      <button
        @click="emit('quick-import', profile)"
        class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        aria-label="一键导入订阅"
      >
        <BaseIcon :path="ICONS.import" className="w-4 h-4" />
        一键导入
      </button>

<!-- Secondary Actions -->
      <button
        @click="emit('preview', profile)"
        class="rounded-lg border border-gray-200 p-2.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-primary-600 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-primary-400"
        title="预览节点"
        aria-label="预览节点"
      >
        <BaseIcon :path="ICONS.preview" className="w-5 h-5" />
      </button>

      <button
        @click="emit('copy-link', profile)"
        class="rounded-lg border border-gray-200 p-2.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-primary-600 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-primary-400"
        title="复制链接"
        aria-label="复制订阅链接"
      >
        <BaseIcon :path="ICONS.link" className="w-5 h-5" />
      </button>
    </div>

    <QRCodeOverlay
      :profile="profile"
      :is-expanded="isQrExpanded"
      @close="emit('toggle-qr', profile)"
      @download="emit('download-qr', profile)"
      @register-canvas="(id, el) => emit('register-canvas', id, el)"
    />
  </div>
</template>
