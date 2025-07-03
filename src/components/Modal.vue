<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Transition } from 'vue';

const props = defineProps({
  show: Boolean,
  confirmKeyword: String,
  // [新增] 尺寸属性，'sm' 为小，'2xl' 为大
  size: {
    type: String,
    default: 'sm', // 默认为小尺寸
  },
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
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4"
      @click="emit('update:show', false)"
    >
      <Transition name="modal-inner">
        <div
          v-if="show"
          class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full text-left ring-1 ring-black/5 dark:ring-white/10 flex flex-col max-h-[85vh]"
          :class="{
            'max-w-sm': size === 'sm',
            'max-w-2xl': size === '2xl'
          }"
          @click.stop
        >
          <div class="p-6 pb-4 flex-shrink-0">
            <slot name="title">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white">确认操作</h3>
            </slot>
          </div>
          
          <div class="px-6 pb-6 flex-grow overflow-y-auto">
             <slot name="body">
                <p class="text-sm text-gray-500 dark:text-gray-400">你确定要继续吗？</p>
            </slot>
          </div>

          <div class="p-6 pt-4 flex justify-end space-x-3 flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
            <button @click="emit('update:show', false)" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold text-sm rounded-lg transition-colors">取消</button>
            <button 
                @click="handleConfirm" 
                :disabled="confirmKeyword && confirmInput !== confirmKeyword"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition-colors disabled:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >确认</button>
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
  transition: all 0.25s ease;
}
.modal-inner-enter-from,
.modal-inner-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>