<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  minItemWidth: {
    type: Number,
    default: 300
  },
  gap: {
    type: Number,
    default: 16
  },
  maxColumns: {
    type: Number,
    default: 4
  }
});

const containerRef = ref(null);
const containerWidth = ref(0);

const gridColumns = computed(() => {
  if (containerWidth.value === 0) return 1;
  
  const availableWidth = containerWidth.value - (props.gap * 2); // 左右边距
  const itemsPerRow = Math.floor(availableWidth / (props.minItemWidth + props.gap));
  
  return Math.max(1, Math.min(itemsPerRow, props.maxColumns));
});

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${gridColumns.value}, 1fr)`,
  gap: `${props.gap}px`,
  padding: `${props.gap}px`
}));

const updateContainerWidth = () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.offsetWidth;
  }
};

onMounted(() => {
  updateContainerWidth();
  window.addEventListener('resize', updateContainerWidth);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerWidth);
});
</script>

<template>
  <div ref="containerRef" class="w-full">
    <div :style="gridStyle" class="smooth-all">
      <div 
        v-for="(item, index) in items" 
        :key="item.id || index"
        class="list-item-animation"
        :style="{ '--delay-index': index }"
      >
        <slot :item="item" :index="index" />
      </div>
    </div>
  </div>
</template>