<script setup>
import { ref, watch, nextTick } from 'vue';
import QRCode from 'qrcode';
import Modal from '../forms/Modal.vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  url: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: '二维码'
  }
});

const emit = defineEmits(['update:show']);

const canvasRef = ref(null);

const generateQRCode = async () => {
  if (!props.url || !canvasRef.value) return;
  try {
    await QRCode.toCanvas(canvasRef.value, props.url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR Code generation failed', err);
  }
};

watch(
  () => [props.show, props.url],
  async ([newShow, newUrl]) => {
    if (newShow && newUrl) {
      await nextTick();
      generateQRCode();
    }
  },
  { immediate: true }
);

const downloadQRCode = () => {
  if (!canvasRef.value) return;
  const link = document.createElement('a');
  link.download = `${props.title || 'qrcode'}.png`;
  link.href = canvasRef.value.toDataURL('image/png');
  link.click();
};
</script>

<template>
  <Modal :show="show" @update:show="emit('update:show', $event)">
    <template #title>
      <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ title }}</h3>
    </template>
    <template #body>
      <div class="flex flex-col items-center gap-6 py-4">
        <div class="bg-white p-4 misub-radius-lg shadow-inner border border-gray-100 dark:border-gray-700">
          <canvas ref="canvasRef" class="w-64 h-64 misub-radius-md"></canvas>
        </div>
        
        <p class="text-sm text-center text-gray-500 max-w-xs break-all">
          {{ url }}
        </p>
        
        <button
          @click="downloadQRCode"
          class="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white misub-radius-lg font-medium transition-colors shadow-lg shadow-primary-500/20 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          保存二维码图片
        </button>
      </div>
    </template>
  </Modal>
</template>
