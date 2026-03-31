/**
 * 共享拖拽列表组件
 * @author MiSub Team
 */

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  itemKey: {
    type: String,
    default: 'id'
  },
  draggable: {
    type: Boolean,
    default: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  height: {
    type: String,
    default: 'auto'
  },
  maxHeight: {
    type: String,
    default: '400px'
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  showHandle: {
    type: Boolean,
    default: true
  },
  animation: {
    type: Boolean,
    default: true
  },
  ghostClass: {
    type: String,
    default: 'ghost'
  },
  chosenClass: {
    type: String,
    default: 'chosen'
  },
  dragClass: {
    type: String,
    default: 'drag'
  }
});

const emit = defineEmits(['update:items', 'reorder', 'itemClick', 'itemAdd', 'itemRemove', 'dragStart', 'dragEnd']);

const listRef = ref(null);
const draggedIndex = ref(-1);
const draggedOverIndex = ref(-1);
const dragState = ref({
  isDragging: false,
  startIndex: -1,
  endIndex: -1
});

// 计算列表样式
const listStyle = computed(() => ({
  height: props.height === 'auto' ? 'auto' : props.height,
  maxHeight: props.maxHeight
}));

// 计算拖拽动画样式
const itemStyle = (index) => {
  if (!props.animation || !dragState.value.isDragging) return {};

  // 简单的拖拽预览动画
  if (index === dragState.value.startIndex) {
    return {
      opacity: 0.5,
      transform: 'scale(1.05)'
    };
  }

  return {};
};

// 计算项目的类名
const itemClasses = (index, item) => [
  'drag-drop-item',
  {
    'cursor-move': props.draggable && !props.disabled,
    'cursor-not-allowed': props.disabled,
    [props.ghostClass]: index === draggedOverIndex.value && draggedIndex.value !== index,
    [props.chosenClass]: index === draggedIndex.value,
    [props.dragClass]: dragState.value.isDragging && index === draggedIndex.value,
    'drag-over': index === draggedOverIndex.value && draggedIndex.value !== index
  }
];

// 处理拖拽开始
const handleDragStart = (event, index, item) => {
  if (!props.draggable || props.disabled) {
    event.preventDefault();
    return;
  }

  draggedIndex.value = index;
  dragState.value = {
    isDragging: true,
    startIndex: index,
    endIndex: index
  };

  // 设置拖拽数据
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/html', event.target.outerHTML);
  event.dataTransfer.setData('text/plain', JSON.stringify(item));

  // 设置自定义拖拽图片
  if (event.dataTransfer.setDragImage) {
    const dragImage = event.target.cloneNode(true);
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(5deg)';
    event.dataTransfer.setDragImage(dragImage, event.offsetX, event.offsetY);
  }

  emit('dragStart', { event, index, item });
};

// 处理拖拽结束
const handleDragEnd = (event) => {
  draggedIndex.value = -1;
  draggedOverIndex.value = -1;

  if (dragState.value.isDragging) {
    emit('dragEnd', { event, ...dragState.value });

    // 如果位置发生变化，触发重排序事件
    if (dragState.value.startIndex !== dragState.value.endIndex) {
      const reorderedItems = [...props.items];
      const [movedItem] = reorderedItems.splice(dragState.value.startIndex, 1);
      reorderedItems.splice(dragState.value.endIndex, 0, movedItem);

      emit('update:items', reorderedItems);
      emit('reorder', {
        fromIndex: dragState.value.startIndex,
        toIndex: dragState.value.endIndex,
        item: movedItem,
        items: reorderedItems
      });
    }
  }

  dragState.value = {
    isDragging: false,
    startIndex: -1,
    endIndex: -1
  };
};

// 处理拖拽悬停
const handleDragOver = (event, index) => {
  if (!props.draggable || props.disabled) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  draggedOverIndex.value = index;
};

// 处理拖拽进入
const handleDragEnter = (event, index) => {
  if (!props.draggable || props.disabled) return;

  event.preventDefault();
  draggedOverIndex.value = index;

  // 更新目标位置
  if (draggedIndex.value !== -1 && draggedIndex.value !== index) {
    dragState.value.endIndex = index;
  }
};

// 处理拖拽离开
const handleDragLeave = (event) => {
  // 防止频繁触发
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX;
  const y = event.clientY;

  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
    draggedOverIndex.value = -1;
  }
};

// 处理放置
const handleDrop = (event, index) => {
  if (!props.draggable || props.disabled) return;

  event.preventDefault();
  event.stopPropagation();

  draggedOverIndex.value = -1;

  // 更新最终位置
  if (draggedIndex.value !== -1) {
    dragState.value.endIndex = index;
  }
};

// 处理项目点击
const handleItemClick = (item, index) => {
  if (props.disabled) return;
  emit('itemClick', { item, index });
};

// 添加项目
const addItem = (item) => {
  if (props.disabled) return;

  const newItems = [...props.items, item];
  emit('update:items', newItems);
  emit('itemAdd', { item, items: newItems });
};

// 移除项目
const removeItem = (index) => {
  if (props.disabled || index < 0 || index >= props.items.length) return;

  const newItems = props.items.filter((_, i) => i !== index);
  const removedItem = props.items[index];

  emit('update:items', newItems);
  emit('itemRemove', { item: removedItem, index, items: newItems });
};

// 暴露方法给父组件
defineExpose({
  addItem,
  removeItem,
  // 可以添加其他公共方法
});
</script>

<template>
  <div
    ref="listRef"
    class="drag-drop-list"
    :style="listStyle"
  >
    <!-- 列表容器 -->
    <div class="drag-drop-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="drag-drop-loading">
        <div class="flex items-center justify-center py-8">
          <svg class="animate-spin h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-gray-500 dark:text-gray-400">加载中...</span>
        </div>
      </div>

      <!-- 空数据状态 -->
      <div v-else-if="items.length === 0" class="drag-drop-empty">
        <div class="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
          <svg class="w-12 h-12 mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span>{{ emptyText }}</span>
        </div>
      </div>

      <!-- 列表项目 -->
      <div
        v-else
        class="drag-drop-items"
        :class="{ 'is-dragging': dragState.isDragging }"
      >
        <div
          v-for="(item, index) in items"
          :key="item[itemKey] || index"
          :class="itemClasses(index, item)"
          :style="itemStyle(index)"
          class="drag-drop-item-wrapper"
          draggable="draggable"
          @click="handleItemClick(item, index)"
          @dragstart="handleDragStart($event, index, item)"
          @dragend="handleDragEnd($event)"
          @dragover="handleDragOver($event, index)"
          @dragenter="handleDragEnter($event, index)"
          @dragleave="handleDragLeave($event)"
          @drop="handleDrop($event, index)"
        >
          <!-- 拖拽手柄 -->
          <div v-if="showHandle && draggable && !disabled" class="drag-handle">
            <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 11-4 0 2 2 0 014 0zM7 12a2 2 0 11-4 0 2 2 0 014 0zM7 22a2 2 0 11-4 0 2 2 0 014 0zM17 2a2 2 0 11-4 0 2 2 0 014 0zM17 12a2 2 0 11-4 0 2 2 0 014 0zM17 22a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>

          <!-- 项目内容 -->
          <div class="drag-item-content">
            <!-- 默认插槽 -->
            <slot :item="item" :index="index">
              <div class="flex items-center justify-between w-full">
                <div class="flex items-center space-x-3">
                  <!-- 项目信息 -->
                  <div>
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.name || item.title || `项目 ${index + 1}` }}
                    </h4>
                    <p v-if="item.description" class="text-xs text-gray-500 dark:text-gray-400">
                      {{ item.description }}
                    </p>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="flex items-center space-x-2">
                  <slot name="actions" :item="item" :index="index">
                    <!-- 删除按钮 -->
                    <button
                      v-if="!disabled"
                      type="button"
                      class="p-1 text-red-400 hover:text-red-600 transition-colors"
                      @click.stop="removeItem(index)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </slot>
                </div>
              </div>
            </slot>
          </div>

          <!-- 拖拽插入指示器 -->
          <div
            v-if="draggedOverIndex === index && draggedIndex !== index"
            class="drag-insert-indicator"
          ></div>
        </div>
      </div>
    </div>

    <!-- 底部插槽 -->
    <div v-if="$slots.footer" class="drag-drop-footer mt-4">
      <slot name="footer" :items="items" />
    </div>
  </div>
</template>

<style scoped>
.drag-drop-list {
  @apply w-full;
}

.drag-drop-container {
  @apply border border-gray-200 dark:border-gray-700 misub-radius-md bg-white dark:bg-gray-800 overflow-hidden;
}

.drag-drop-item-wrapper {
  @apply relative flex items-center p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-all duration-200 select-none;
}

.drag-drop-item-wrapper.drag-over {
  @apply bg-gray-50 dark:bg-gray-700;
}

.drag-drop-item-wrapper.ghost {
  @apply opacity-50;
}

.drag-drop-item-wrapper.chosen {
  @apply bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700;
}

.drag-drop-item-wrapper.drag {
  @apply shadow-lg transform scale-105 z-50;
}

.drag-handle {
  @apply mr-3 cursor-move p-1;
}

.drag-item-content {
  @apply flex-1 min-w-0;
}

.drag-insert-indicator {
  @apply absolute top-0 left-0 right-0 h-0.5 bg-indigo-500;
}

.is-dragging .drag-drop-item-wrapper {
  @apply transition-transform duration-200;
}

.drag-drop-empty {
  @apply py-8;
}

.drag-drop-loading {
  @apply py-8;
}

.drag-drop-footer {
  @apply text-sm text-gray-500 dark:text-gray-400;
}

/* 暗黑模式下的拖拽状态 */
.dark .drag-drop-item-wrapper.drag-over {
  @apply bg-gray-700;
}

.dark .drag-drop-item-wrapper.chosen {
  @apply bg-indigo-900/20 border-indigo-700;
}

.dark .drag-handle {
  @apply text-gray-500;
}
</style>