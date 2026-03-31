import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

export function useVirtualScroll({
  items,
  itemHeight = 52,
  containerHeight = 400,
  overscan = 5
}) {
  const scrollTop = ref(0);
  const containerRef = ref(null);

  const updateScrollTop = () => {
    if (containerRef.value) {
      scrollTop.value = containerRef.value.scrollTop;
    }
  };

  onMounted(() => {
    if (containerRef.value) {
      containerRef.value.addEventListener('scroll', updateScrollTop, { passive: true });
    }
  });

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('scroll', updateScrollTop);
    }
  });

  const visibleItems = computed(() => {
    const totalItems = items.value.length;
    if (totalItems === 0) return { items: [], startIndex: 0, endIndex: 0 };

    const startIndex = Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(totalItems, startIndex + visibleCount + overscan * 2);

    return {
      items: items.value.slice(startIndex, endIndex).map((item, index) => ({
        ...item,
        _virtualIndex: startIndex + index
      })),
      startIndex,
      endIndex
    };
  });

  const totalHeight = computed(() => items.value.length * itemHeight);

  const offsetY = computed(() => visibleItems.value.startIndex * itemHeight);

  const setContainerRef = (el) => {
    if (el) {
      containerRef.value = el;
      if (el.scrollTop !== scrollTop.value) {
        el.scrollTop = scrollTop.value;
      }
    }
  };

  return {
    containerRef: setContainerRef,
    visibleItems,
    totalHeight,
    offsetY,
    itemHeight
  };
}