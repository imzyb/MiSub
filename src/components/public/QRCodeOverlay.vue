<script setup>
const props = defineProps({
  profile: {
    type: Object,
    required: true
  },
  isExpanded: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'download', 'register-canvas']);
</script>

<template>
  <Teleport to="body">
    <Transition name="qr-overlay">
      <div
        v-if="isExpanded"
        @click.self="emit('close')"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
      >
        <div class="relative bg-white dark:bg-gray-800 misub-radius-lg p-8 shadow-2xl max-w-sm w-full mx-4 transform transition-all border border-gray-100 dark:border-gray-700"
          @click.stop>
          <!-- Close Button -->
          <button
            @click="emit('close')"
            class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="flex flex-col items-center pt-2">
            <h4 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ profile.name }}</h4>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">扫描二维码导入订阅</p>

            <div class="bg-white p-3 misub-radius-lg shadow-inner border border-gray-100 w-64 h-64 flex items-center justify-center">
              <canvas
                :ref="el => { if (el) emit('register-canvas', profile.id, el); }"
                class="max-w-full h-auto misub-radius-md"
              ></canvas>
            </div>

            <button
              @click="emit('download')"
              class="mt-8 w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 misub-radius-lg transition-all shadow-lg shadow-primary-600/20 active:scale-95"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载二维码
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.qr-overlay-enter-active .bg-white,
.qr-overlay-leave-active .bg-white,
.qr-overlay-enter-active .dark\:bg-gray-800,
.qr-overlay-leave-active .dark\:bg-gray-800 {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.qr-overlay-enter-from {
  opacity: 0;
}

.qr-overlay-enter-from > div {
  transform: scale(0.9);
  opacity: 0;
}

.qr-overlay-leave-to {
  opacity: 0;
}

.qr-overlay-leave-to > div {
  transform: scale(0.9);
  opacity: 0;
}
</style>
