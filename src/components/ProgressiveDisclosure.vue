<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    default: ''
  },
  expanded: {
    type: Boolean,
    default: false
  },
  collapsible: {
    type: Boolean,
    default: true
  },
  level: {
    type: Number,
    default: 1,
    validator: (value) => value >= 1 && value <= 3
  }
});

const emit = defineEmits(['toggle']);

const isExpanded = ref(props.expanded);

const toggleExpanded = () => {
  if (props.collapsible) {
    isExpanded.value = !isExpanded.value;
    emit('toggle', isExpanded.value);
  }
};

const levelClasses = computed(() => {
  const levels = {
    1: {
      title: 'text-lg font-bold text-gray-900 dark:text-white',
      container: 'bg-white/90 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl card-shadow',
      padding: 'p-6'
    },
    2: {
      title: 'text-base font-semibold text-gray-800 dark:text-gray-200',
      container: 'bg-gray-50/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl',
      padding: 'p-4'
    },
    3: {
      title: 'text-sm font-medium text-gray-700 dark:text-gray-300',
      container: 'bg-gray-25/60 dark:bg-gray-700/40 rounded-lg',
      padding: 'p-3'
    }
  };
  return levels[props.level];
});
</script>

<template>
  <div 
    :class="[
      levelClasses.container,
      levelClasses.padding,
      'smooth-all ring-1 ring-black/5 dark:ring-white/10'
    ]"
  >
    <!-- 标题和摘要 -->
    <div 
      class="flex items-center justify-between cursor-pointer"
      :class="{ 'mb-4': isExpanded }"
      @click="toggleExpanded"
    >
      <div class="flex-1 min-w-0">
        <h3 :class="levelClasses.title" class="truncate">
          {{ title }}
        </h3>
        <p 
          v-if="summary" 
          class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate"
        >
          {{ summary }}
        </p>
      </div>
      
      <!-- 展开/收起图标 -->
      <button 
        v-if="collapsible"
        class="ml-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 smooth-all"
      >
        <svg 
          class="w-5 h-5 text-gray-400 smooth-transform"
          :class="{ 'rotate-180': isExpanded }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
    
    <!-- 详细内容 -->
    <Transition
      name="disclosure"
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="isExpanded" class="space-y-4">
        <slot name="content" />
        
        <!-- 操作区域 -->
        <div v-if="$slots.actions" class="pt-4 border-t border-gray-200 dark:border-gray-700">
          <slot name="actions" />
        </div>
      </div>
    </Transition>
  </div>
</template>