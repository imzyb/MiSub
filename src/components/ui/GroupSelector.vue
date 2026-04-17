<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  groups: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '选择或输入分组...'
  }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const inputRef = ref(null);
const containerRef = ref(null);
const dropdownStyle = ref({ top: '0px', left: '0px', width: '0px' });

// Filter groups based on input
const filteredGroups = computed(() => {
  const query = (props.modelValue || '').toLowerCase();
  if (!query) return props.groups;
  return props.groups.filter(g => g && String(g).toLowerCase().includes(query));
});

const updatePosition = () => {
  if (inputRef.value) {
    const rect = inputRef.value.getBoundingClientRect();
    dropdownStyle.value = {
      top: `${rect.bottom + window.scrollY + 4}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`
    };
  }
};

const handleInput = (e) => {
  emit('update:modelValue', e.target.value);
  isOpen.value = true;
};

const handleFocus = () => {
  isOpen.value = true;
};

const selectGroup = (group) => {
  emit('update:modelValue', group);
  isOpen.value = false;
};

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const handleClickOutside = (e) => {
  if (containerRef.value && !containerRef.value.contains(e.target)) {
    // Check if clicking inside the dropdown (which is teleported)
    const dropdownEl = document.getElementById('group-selector-dropdown');
    if (dropdownEl && dropdownEl.contains(e.target)) {
      return;
    }
    isOpen.value = false;
  }
};

const handleScroll = () => {
  if (isOpen.value) {
    updatePosition();
  }
};

watch(isOpen, (val) => {
  if (val) {
    nextTick(() => {
      updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', updatePosition);
    });
  } else {
    window.removeEventListener('scroll', handleScroll, true);
    window.removeEventListener('resize', updatePosition);
  }
});

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true);
  window.removeEventListener('scroll', handleScroll, true);
  window.removeEventListener('resize', updatePosition);
});
</script>

<template>
  <div ref="containerRef" class="relative group w-full">
    <div class="relative w-full">
      <input
        ref="inputRef"
        :value="modelValue"
        type="text"
        :placeholder="placeholder"
        class="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 misub-radius-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all h-[42px] dark:text-white placeholder-gray-400"
        @input="handleInput"
        @focus="handleFocus"
        @keydown.enter="isOpen = false"
      />
      <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <slot name="icon">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
            <path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
        </slot>
      </div>
      
      <!-- Arrow Icon -->
      <div 
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer transition-transform duration-200 hover:text-gray-600 dark:hover:text-gray-300" 
        :class="{ 'rotate-180': isOpen }"
        @click.stop="toggleDropdown"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <!-- Dropdown -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen && (groups.length > 0 || modelValue)"
          id="group-selector-dropdown"
          class="absolute z-[9999] bg-white dark:bg-gray-800 misub-radius-lg shadow-lg border border-gray-100 dark:border-gray-700 max-h-60 overflow-auto py-1 custom-scrollbar"
          :style="dropdownStyle"
        >
          <button
            v-if="modelValue && !groups.some(g => g && String(g).toLowerCase() === String(modelValue).toLowerCase())" 
            class="w-full text-left pl-10 pr-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 block transition-colors"
            @click="selectGroup(modelValue)"
          >
            创建新分组 "{{ modelValue }}"
          </button>
          <button
            v-for="group in filteredGroups"
            :key="group"
            class="w-full text-left pl-10 pr-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-between group-item"
            :class="{ 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400': modelValue === group }"
            @click="selectGroup(group)"
          >
            <span>{{ group }}</span>
            <svg v-if="modelValue === group" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.8);
}
</style>
