<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const isVisible = ref(false);
const scrollThreshold = 300;

const handleScroll = () => {
  isVisible.value = window.scrollY > scrollThreshold;
};

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <Transition name="scroll-top">
    <button
      v-if="isVisible"
      @click="scrollToTop"
      class="fixed z-50 bottom-24 md:bottom-8 right-4 md:right-8 p-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white misub-radius-lg shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-sm border border-white/20"
      aria-label="滚动到顶部"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  </Transition>
</template>

<style scoped>
.scroll-top-enter-active,
.scroll-top-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.scroll-top-enter-from,
.scroll-top-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.8);
}

@media (prefers-reduced-motion: reduce) {
  .scroll-top-enter-active,
  .scroll-top-leave-active {
    transition: opacity 0.2s ease;
  }
  
  .scroll-top-enter-from,
  .scroll-top-leave-to {
    transform: none;
  }
}
</style>
