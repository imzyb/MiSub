<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps({
  teleportToBody: {
    type: Boolean,
    default: false
  },
  menuWidthClass: {
    type: String,
    default: 'w-36'
  }
});

const isOpen = ref(false);
const triggerRef = ref(null);
const menuRef = ref(null);

const fixedMenuPosition = computed(() => {
  if (!props.teleportToBody || !triggerRef.value) return {};

  const buttonRect = triggerRef.value.getBoundingClientRect();
  return {
    top: `${buttonRect.bottom}px`,
    right: `${window.innerWidth - buttonRect.right}px`
  };
});

function toggleMenu() {
  isOpen.value = !isOpen.value;
}

function closeMenu() {
  isOpen.value = false;
}

function handleClickOutside(event) {
  const isClickInTrigger = triggerRef.value && triggerRef.value.contains(event.target);
  const isClickInMenu = menuRef.value && menuRef.value.contains(event.target);

  if (!isClickInTrigger && !isClickInMenu) {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="triggerRef" class="relative shrink-0">
    <button @click="toggleMenu" class="p-2.5 misub-radius-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
    </button>

    <Transition name="slide-fade-sm">
      <div
        v-if="!teleportToBody && isOpen"
        ref="menuRef"
        :class="['absolute right-0 mt-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm misub-radius-lg shadow-lg dark:shadow-2xl z-50 ring-1 ring-black/5', menuWidthClass]"
      >
        <slot name="menu" :close="closeMenu" />
      </div>
    </Transition>

    <Teleport v-if="teleportToBody" to="body">
      <Transition name="slide-fade-sm">
        <div
          v-if="isOpen"
          ref="menuRef"
          :class="['fixed mt-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm misub-radius-lg shadow-lg dark:shadow-2xl ring-1 ring-black/5', menuWidthClass]"
          style="z-index: 999999;"
          :style="fixedMenuPosition"
          @click.stop
        >
          <slot name="menu" :close="closeMenu" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.slide-fade-sm-enter-active,
.slide-fade-sm-leave-active {
  transition: all 0.2s ease-out;
}

.slide-fade-sm-enter-from,
.slide-fade-sm-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
