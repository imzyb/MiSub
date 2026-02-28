<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Transition } from 'vue';

const props = defineProps({
  show: Boolean,
  confirmKeyword: String,
  size: {
    type: String,
    default: 'sm',
  },
  // --- 新增 props ---
  confirmDisabled: { // 用於接收外部傳入的禁用狀態
    type: Boolean,
    default: false,
  },
  confirmButtonTitle: { // 用於在禁用時顯示提示
    type: String,
    default: '确认'
  },
  confirmText: {
    type: String,
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
  }
});

const emit = defineEmits(['update:show', 'confirm']);

const confirmInput = ref('');

const handleKeydown = (e) => {
    if (e.key === 'Escape') {
        emit('update:show', false);
    }
};

const handleConfirm = () => {
  emit('confirm');
  emit('update:show', false);
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<template>
<Transition name="modal-fade">
<div
v-if="show"
class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
@click="emit('update:show', false)"
role="dialog"
aria-modal="true"
>
      <Transition name="modal-inner">
        <div
          v-if="show"
          class="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full text-left ring-1 ring-black/5 dark:ring-white/10 flex flex-col max-h-[85vh] border border-white/20 dark:border-white/5"
          :class="{
            'max-w-sm': size === 'sm',
            'max-w-md': size === 'md',
            'max-w-lg': size === 'lg',
            'max-w-xl': size === 'xl',
            'max-w-2xl': size === '2xl',
            'max-w-4xl': size === '4xl',
            'max-w-5xl': size === '5xl',
            'max-w-6xl': size === '6xl'
          }"
          @click.stop
        >
          <div class="p-6 pb-4 shrink-0">
            <slot name="title">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white">确认操作</h3>
            </slot>
          </div>
          
          <div class="px-6 pb-6 grow overflow-y-auto">
             <slot name="body">
                <p class="text-sm text-gray-500 dark:text-gray-400">你确定要继续吗？</p>
            </slot>
          </div>

          <div class="p-6 pt-4 flex justify-end space-x-3 shrink-0 border-t border-gray-200 dark:border-gray-700">
            <slot name="footer">
              <button @click="emit('update:show', false)" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold text-sm rounded-xl transition-colors">{{ cancelText }}</button>
              <button 
                  @click="handleConfirm" 
                  :disabled="confirmDisabled || (confirmKeyword && confirmInput !== confirmKeyword)"
                  :title="confirmDisabled ? confirmButtonTitle : '确认'"
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:opacity-70 disabled:cursor-not-allowed"
              >{{ confirmText }}</button>
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