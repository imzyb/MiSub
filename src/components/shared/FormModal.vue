/**
 * 共享表单模态框组件
 * @author MiSub Team
 */

<script setup>
import { ref, watch, nextTick, computed } from 'vue';
import { t } from '../../i18n/index.js';
import { useBackdropDismiss } from '../../composables/useBackdropDismiss.js';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large', 'xlarge'].includes(value)
  },
  closable: {
    type: Boolean,
    default: true
  },
  maskClosable: {
    type: Boolean,
    default: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  showFooter: {
    type: Boolean,
    default: true
  },
  confirmText: {
    type: String,
    default: ''
  },
  cancelText: {
    type: String,
    default: ''
  },
  confirmDisabled: {
    type: Boolean,
    default: false
  },
  confirmButtonClass: {
    type: String,
    default: ''
  },
  cancelButtonClass: {
    type: String,
    default: ''
  },
  maxWidth: {
    type: String,
    default: ''
  },
  maxHeight: {
    type: String,
    default: ''
  },
  zIndex: {
    type: Number,
    default: 50
  }
});

const emit = defineEmits(['update:show', 'confirm', 'cancel', 'close', 'opened', 'closed']);

const modalRef = ref(null);
const contentRef = ref(null);

// 尺寸样式映射
const sizeClasses = {
  small: 'max-w-md',
  medium: 'max-w-lg',
  large: 'max-w-2xl',
  xlarge: 'max-w-4xl'
};

// 计算样式
const modalClasses = computed(() => [
  'relative transform overflow-hidden rounded-[var(--misub-radius-lg)] bg-white dark:bg-[#0f1011] text-left shadow-xl border border-gray-200 dark:border-white/10 transition-opacity duration-150',
  sizeClasses[props.size] || sizeClasses.medium,
  props.maxWidth ? `max-w-[${props.maxWidth}]` : ''
]);

const contentStyle = computed(() => {
  const styles = {};
  if (props.maxHeight) {
    styles.maxHeight = props.maxHeight;
  }
  return styles;
});

const resolvedConfirmText = computed(() => props.confirmText || t('actions.confirm'));
const resolvedCancelText = computed(() => props.cancelText || t('actions.cancel'));

// 监听显示状态变化
watch(() => props.show, async (newVal) => {
  if (newVal) {
    await nextTick();
    emit('opened');
    // 自动聚焦到第一个输入框
    if (contentRef.value) {
      const firstInput = contentRef.value.querySelector('input, textarea, select');
      if (firstInput) {
        firstInput.focus();
      }
    }
  } else {
    emit('closed');
  }
});

// 处理关闭
const handleClose = () => {
  if (props.disabled || props.loading) return;
  emit('update:show', false);
  emit('close');
};

// 处理遮罩点击
const {
  handleBackdropPointerDown: handleMaskPointerDown,
  handleBackdropClick: handleMaskClick
} = useBackdropDismiss(
  handleClose,
  () => props.maskClosable && !props.disabled && !props.loading
);

// 处理确认
const handleConfirm = () => {
  if (props.disabled || props.loading || props.confirmDisabled) return;
  emit('confirm');
};

// 处理取消
const handleCancel = () => {
  if (props.disabled || props.loading) return;
  emit('cancel');
  handleClose();
};

// 键盘事件处理
const handleKeydown = (event) => {
  if (!props.show) return;

  switch (event.key) {
    case 'Escape':
      if (!props.disabled && !props.loading) {
        handleClose();
      }
      break;
    case 'Enter':
      if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd + Enter 确认
        if (!props.disabled && !props.loading && !props.confirmDisabled) {
          handleConfirm();
        }
      }
      break;
  }
};

// 暴露方法给父组件
defineExpose({
  focus: () => {
    if (modalRef.value) {
      modalRef.value.focus();
    }
  },
  getContentElement: () => contentRef.value
});
</script>

<template>
  <teleport to="body">
    <div
      v-if="show"
      ref="modalRef"
      class="fixed inset-0 overflow-y-auto"
      :style="{ zIndex }"
      @keydown="handleKeydown"
    >
      <!-- 遮罩层 -->
      <div
        class="flex min-h-full items-center justify-center p-4 text-center sm:p-0"
        :class="{ 'bg-black/60 backdrop-blur-sm': show }"
        @pointerdown.capture="handleMaskPointerDown"
        @click="handleMaskClick"
      >
        <!-- 模态框 -->
        <div
          :class="modalClasses"
          class="w-full"
          @click.stop
        >
          <!-- 头部 -->
          <div
            v-if="title || closable"
            class="border-b border-gray-200 dark:border-white/10 px-6 py-4"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                {{ title }}
              </h3>

              <!-- 关闭按钮 -->
              <button
                v-if="closable"
                type="button"
                :disabled="disabled || loading"
                class="rounded-[var(--misub-radius-md)] bg-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed p-2 transition-colors duration-150"
                @click="handleClose"
              >
                <span class="sr-only">关闭</span>
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 内容区域 -->
          <div
            ref="contentRef"
            class="px-6 py-4 overflow-y-auto"
            :style="contentStyle"
          >
            <!-- 默认插槽 -->
            <slot />
          </div>

          <!-- 底部按钮 -->
          <div
            v-if="showFooter || $slots.footer"
            class="border-t border-gray-200 dark:border-white/10 px-6 py-4 bg-gray-50 dark:bg-white/[0.02]"
          >
            <!-- 自定义底部插槽 -->
            <slot name="footer">
              <!-- 默认按钮组 -->
              <div class="flex justify-end space-x-3">
                <button
                  type="button"
                  :disabled="disabled || loading"
                  :class="cancelButtonClass"
                  class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-white/10 text-sm font-medium rounded-[var(--misub-radius-md)] text-gray-700 dark:text-gray-300 bg-white dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                  @click="handleCancel"
                >
                  {{ resolvedCancelText }}
                </button>

                <button
                  type="button"
                  :disabled="disabled || loading || confirmDisabled"
                  :class="[confirmButtonClass, { 'opacity-50 cursor-not-allowed': confirmDisabled }]"
                  class="inline-flex items-center px-4 py-2 border border-primary-500/70 text-sm font-medium rounded-[var(--misub-radius-md)] text-white bg-primary-600 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                  @click="handleConfirm"
                >
                  <!-- 加载图标 -->
                  <svg
                    v-if="loading"
                    class="animate-spin -ml-1 mr-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>

                  {{ resolvedConfirmText }}
                </button>
              </div>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>
