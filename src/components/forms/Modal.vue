<script setup>
import { ref, watch, nextTick, onUnmounted, computed } from 'vue';
import { useI18n } from '@/i18n/index.js';
import { useBackdropDismiss } from '@/composables/useBackdropDismiss.js';

const props = defineProps({
  show: Boolean,
  confirmKeyword: String,
  size: {
    type: String,
    default: 'sm',
  },
  confirmDisabled: {
    type: Boolean,
    default: false,
  },
  confirmButtonTitle: {
    type: String,
    default: ''
  },
  closeOnConfirm: {
    type: Boolean,
    default: true,
  },
  confirmText: {
    type: String,
    default: ''
  },
  cancelText: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:show', 'confirm']);
const { t } = useI18n();
const confirmLabel = computed(() => props.confirmText || t('actions.confirm'));
const cancelLabel = computed(() => props.cancelText || t('actions.cancel'));
const confirmTitle = computed(() => props.confirmButtonTitle || t('actions.confirm'));

const confirmInput = ref('');
const modalPanelRef = ref(null);
const titleId = `modal-title-${Math.random().toString(36).slice(2, 10)}`;

// 记录打开弹窗前的焦点元素，关闭时还原
let previouslyFocused = null;

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements() {
  return modalPanelRef.value
    ? Array.from(modalPanelRef.value.querySelectorAll(FOCUSABLE))
    : [];
}

// Focus trap：Tab / Shift+Tab 循环限制在弹窗内，Escape 关闭
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    emit('update:show', false);
    return;
  }
  if (e.key !== 'Tab') return;

  const focusable = getFocusableElements();
  if (!focusable.length) { e.preventDefault(); return; }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
};

watch(() => props.show, async (val) => {
  if (val) {
    previouslyFocused = document.activeElement;
    window.addEventListener('keydown', handleKeydown);
    await nextTick();
    // 优先聚焦第一个可交互元素，否则聚焦弹窗面板本身
    const focusable = getFocusableElements();
    if (focusable.length) {
      focusable[0].focus();
    } else {
      modalPanelRef.value?.focus();
    }
  } else {
    window.removeEventListener('keydown', handleKeydown);
    // 还原焦点到触发元素
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  }
});

onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

const handleConfirm = async () => {
  await emit('confirm');
  if (props.closeOnConfirm) {
    emit('update:show', false);
  }
};

const {
  handleBackdropPointerDown,
  handleBackdropClick
} = useBackdropDismiss(() => emit('update:show', false));
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="show" class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      @pointerdown.capture="handleBackdropPointerDown" @click="handleBackdropClick" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <Transition name="modal-inner">
        <div v-if="show"
          ref="modalPanelRef"
          tabindex="-1"
          class="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl misub-radius-lg shadow-2xl w-full text-left ring-1 ring-black/5 dark:ring-white/10 flex flex-col max-h-[85vh] lg:max-h-[90vh] border border-white/20 dark:border-white/5 focus:outline-none"
          :class="{
            'max-w-sm': size === 'sm',
            'max-w-md': size === 'md',
            'max-w-lg': size === 'lg',
            'max-w-xl': size === 'xl',
            'max-w-2xl': size === '2xl',
            'max-w-4xl': size === '4xl',
            'max-w-5xl': size === '5xl',
            'max-w-6xl': size === '6xl',
            'max-w-7xl': size === '7xl'
          }" @click.stop>
          <div :id="titleId" class="p-6 pb-4 shrink-0">
            <slot name="title">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('common.confirmAction') }}</h3>
            </slot>
          </div>

          <div class="px-6 pb-6 grow overflow-y-auto">
            <slot name="body">
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.confirmContinue') }}</p>
            </slot>
          </div>

          <div class="p-6 pt-4 flex justify-end space-x-3 shrink-0 border-t border-gray-200 dark:border-gray-700">
            <slot name="footer">
              <button @click="emit('update:show', false)"
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold text-sm misub-radius-lg transition-colors">{{
                cancelLabel }}</button>
              <button @click="handleConfirm"
                :disabled="confirmDisabled || (confirmKeyword && confirmInput !== confirmKeyword)"
                :title="confirmDisabled ? confirmTitle : t('actions.confirm')"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm misub-radius-lg transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:opacity-70 disabled:cursor-not-allowed">{{
                confirmLabel }}</button>
            </slot>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-inner-enter-active,
.modal-inner-leave-active {
  transition: all 0.3s ease-out;
}

.modal-inner-enter-active,
.modal-inner-leave-active {
  transition: all 0.25s ease;
}

.modal-inner-enter-from,
.modal-inner-leave-to {
  opacity: 0;
  transform: translateY(50px);
}

@media (min-width: 768px) {

  .modal-inner-enter-from,
  .modal-inner-leave-to {
    opacity: 0;
    transform: scale(0.95);
  }
}
</style>
